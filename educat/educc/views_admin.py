"""
Statistiques du dashboard (réservées aux administrateurs) + signal de présence
(« en ligne / hors ligne ») envoyé par le front.

Fichier à placer dans educc/ (à côté de views.py).
"""
import json
from datetime import datetime, time, timedelta

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, views
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken

from .models import CodeOTP, Matiere, Question, QuizAnswer, QuizSession, User

NB_JOURS = 30  # fenêtre des graphiques d'activité

# Le front envoie un signal toutes les 20 s. Sans nouvelle pendant 90 s
# (coupure réseau, navigateur planté...), la personne passe hors ligne.
# 90 s et non 45 s : un onglet resté en arrière-plan est ralenti par le
# navigateur (un signal par minute environ) et ne doit pas "clignoter".
# Quand l'onglet se ferme normalement, HorsLigneView prévient tout de suite.
SEUIL_EN_LIGNE = timedelta(seconds=90)
MAX_INSCRITS = 500  # plafond de la liste envoyée au dashboard


class EstAdmin(permissions.BasePermission):
    """
    Autorise uniquement les administrateurs : rôle "admin" OU superutilisateur
    Django (un compte créé avec createsuperuser garde le rôle "candidat" par
    défaut, mais doit quand même avoir accès au dashboard).
    """

    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and (u.is_superuser or u.role == "admin")
        )


class PingView(views.APIView):
    """
    POST /api/me/ping/ — signal de présence.

    - sans corps            : « je suis là » (envoyé toutes les 20 s par le front)
    - {"hors_ligne": true}  : déconnexion volontaire -> hors ligne immédiatement
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        maintenant = timezone.now()
        a_quitte = bool(request.data.get("hors_ligne"))
        # update() : une seule requête SQL, sans toucher aux autres champs
        User.objects.filter(pk=request.user.pk).update(
            derniere_activite=maintenant, a_quitte=a_quitte
        )
        return Response(status=204)


class HorsLigneView(views.APIView):
    """
    POST /api/me/hors-ligne/ — envoyé à la fermeture de l'onglet.

    Le navigateur utilise navigator.sendBeacon, qui ne peut pas ajouter d'en-tête
    Authorization : le jeton d'accès arrive donc dans le corps de la requête
    ({"access": "..."}), et on le vérifie ici (signature + expiration).
    La réponse est toujours vide : une balise de fermeture ne lit jamais la réponse.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            corps = json.loads(request.body or b"{}")
            user_id = AccessToken(corps.get("access", ""))["user_id"]
        except Exception:
            # jeton absent, invalide ou expiré : on ignore sans rien révéler
            return Response(status=204)

        User.objects.filter(pk=user_id).update(
            derniere_activite=timezone.now(), a_quitte=True
        )
        return Response(status=204)


def _compte_cible(request, user_id):
    """Le compte visé par une action de l'administrateur, ou une erreur claire."""
    cible = User.objects.filter(pk=user_id).first()
    if cible is None:
        raise NotFound("Ce compte n'existe plus.")
    if cible.pk == request.user.pk:
        raise PermissionDenied("Tu ne peux pas faire ça sur ton propre compte.")
    # Un simple administrateur ne peut pas toucher au superutilisateur du site.
    if cible.is_superuser and not request.user.is_superuser:
        raise PermissionDenied("Seul un superutilisateur peut agir sur ce compte.")
    return cible


class DeconnecterCompteView(views.APIView):
    """
    POST /api/admin/utilisateurs/<id>/deconnecter/ — ferme toutes les sessions du
    compte, sur tous ses appareils. La personne peut se reconnecter ensuite.
    """

    permission_classes = [EstAdmin]

    def post(self, request, user_id):
        cible = _compte_cible(request, user_id)
        maintenant = timezone.now()
        User.objects.filter(pk=cible.pk).update(
            sessions_invalides_avant=maintenant,
            derniere_activite=maintenant,
            a_quitte=True,  # hors ligne tout de suite sur le dashboard
        )
        # Une connexion en cours de vérification (code OTP envoyé) est annulée aussi
        CodeOTP.objects.filter(user=cible).delete()
        return Response(status=204)


class SupprimerCompteView(views.APIView):
    """
    DELETE /api/admin/utilisateurs/<id>/ — supprime définitivement le compte, avec
    ses quiz et ses contributions. Les questions qu'il a créées sont conservées.
    """

    permission_classes = [EstAdmin]

    def delete(self, request, user_id):
        _compte_cible(request, user_id).delete()
        return Response(status=204)


def _serie_par_jour(queryset, champ_date, jours, debut):
    """Nombre d'objets créés chaque jour, avec 0 pour les jours sans activité."""
    lignes = (
        queryset.filter(**{f"{champ_date}__gte": debut})
        .annotate(jour=TruncDate(champ_date))
        .values("jour")
        .annotate(n=Count("id"))
    )
    par_jour = {ligne["jour"]: ligne["n"] for ligne in lignes}
    return [par_jour.get(j, 0) for j in jours]


class AdminStatsView(views.APIView):
    """GET /api/admin/stats/ — vue d'ensemble de la plateforme."""

    permission_classes = [EstAdmin]

    def get(self, request):
        maintenant = timezone.now()
        aujourdhui = timezone.localdate()
        jours = [
            aujourdhui - timedelta(days=NB_JOURS - 1 - i) for i in range(NB_JOURS)
        ]
        debut = timezone.make_aware(datetime.combine(jours[0], time.min))
        il_y_a_7_jours = maintenant - timedelta(days=7)
        limite_presence = maintenant - SEUIL_EN_LIGNE

        # ── Totaux ──
        terminees = QuizSession.objects.filter(termine=True)
        score_moyen = terminees.aggregate(m=Avg("score"))["m"]

        totaux = {
            "utilisateurs": User.objects.count(),
            "en_ligne": User.objects.filter(
                derniere_activite__gte=limite_presence, a_quitte=False
            ).count(),
            "nouveaux_7j": User.objects.filter(date_joined__gte=il_y_a_7_jours).count(),
            "questions_validees": Question.objects.filter(statut="validee").count(),
            "questions_en_attente": Question.objects.filter(statut="en_attente").count(),
            "questions_rejetees": Question.objects.filter(statut="rejetee").count(),
            "quiz_total": QuizSession.objects.count(),
            "quiz_termines": terminees.count(),
            "score_moyen": round(score_moyen or 0, 1),
        }

        # ── Activité des 30 derniers jours ──
        inscriptions = _serie_par_jour(User.objects.all(), "date_joined", jours, debut)
        quiz = _serie_par_jour(QuizSession.objects.all(), "date_debut", jours, debut)
        activite = [
            {"jour": j.isoformat(), "inscriptions": a, "quiz": b}
            for j, a, b in zip(jours, inscriptions, quiz)
        ]

        # ── Par matière : nombre de questions + taux de réussite ──
        lignes_reussite = (
            QuizAnswer.objects.filter(session__termine=True)
            .values("question__matiere")
            .annotate(total=Count("id"), bonnes=Count("id", filter=Q(est_correcte=True)))
        )
        reussite = {
            ligne["question__matiere"]: round(100 * ligne["bonnes"] / ligne["total"])
            for ligne in lignes_reussite
            if ligne["total"]
        }

        matieres = Matiere.objects.annotate(
            nb_questions=Count("questions", filter=Q(questions__statut="validee"))
        ).order_by("-nb_questions", "nom")

        par_matiere = [
            {
                "id": m.id,
                "nom": m.nom,
                "questions": m.nb_questions,
                "reussite": reussite.get(m.id),  # None = pas encore de réponses
            }
            for m in matieres
            if m.nb_questions or m.id in reussite
        ]

        # ── Meilleurs utilisateurs ──
        meilleurs = (
            User.objects.annotate(
                nb=Count("quiz_sessions", filter=Q(quiz_sessions__termine=True)),
                moyenne=Avg("quiz_sessions__score", filter=Q(quiz_sessions__termine=True)),
            )
            .filter(nb__gt=0)
            .order_by("-nb", "-moyenne")[:5]
        )
        top_utilisateurs = [
            {"username": u.username, "quiz": u.nb, "score_moyen": round(u.moyenne or 0)}
            for u in meilleurs
        ]

        # ── Tous les inscrits, avec leur présence ──
        inscrits_qs = User.objects.order_by(
            F("derniere_activite").desc(nulls_last=True), "-date_joined"
        )[:MAX_INSCRITS]

        inscrits = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "admin": u.is_superuser or u.role == "admin",
                # L'administrateur connecté peut-il déconnecter / supprimer ce compte ?
                "modifiable": u.pk != request.user.pk
                and (request.user.is_superuser or not u.is_superuser),
                "date_inscription": timezone.localtime(u.date_joined).date().isoformat(),
                "derniere_activite": (
                    u.derniere_activite.isoformat() if u.derniere_activite else None
                ),
                "en_ligne": bool(
                    u.derniere_activite
                    and not u.a_quitte
                    and u.derniere_activite >= limite_presence
                ),
            }
            for u in inscrits_qs
        ]
        # Les personnes en ligne d'abord (le tri est stable : l'ordre par
        # dernière activité est conservé à l'intérieur de chaque groupe).
        inscrits.sort(key=lambda i: not i["en_ligne"])

        return Response(
            {
                "totaux": totaux,
                "activite": activite,
                "par_matiere": par_matiere,
                "top_utilisateurs": top_utilisateurs,
                "inscrits": inscrits,
            }
        )