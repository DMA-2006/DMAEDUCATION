from django.shortcuts import render
import random
from rest_framework import generics, views, permissions, filters
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.throttling import AnonRateThrottle
from rest_framework.exceptions import AuthenticationFailed
from jwt import PyJWKClientConnectionError
from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.utils import timezone
from .models import (
    Ecole, Filiere, User, Matiere, Question,
    QuizSession, QuizAnswer, Contribution,
)
from .serializers import (
    EcoleSerializer, FiliereSerializer, UserSerializer, RegisterSerializer,
    MatiereSerializer, QuestionSerializer, QuestionQuizSerializer,
    QuestionSoumissionSerializer,
    DemarrerQuizSerializer, QuizAnswerSubmitSerializer, ReponseExerciceSubmitSerializer,
    QuizSessionSerializer, QuizResultSerializer,
    ContributionSerializer,
)
from .correction_ia import corriger_exercice, CorrectionIndisponible
from .services import otp
from .authentification import session_revoquee
from .services.google_auth import verifier_jeton_google, utilisateur_depuis_google, JetonGoogleInvalide
from django.db.models import Count, Q

# ═════════════════════════════════════════════════════════════
# SECTION 1 — Comptes & structure académique
# ═════════════════════════════════════════════════════════════

def reponse_connexion(user, status=200):
    """
    Réponse finale d'une connexion réussie (code OTP validé, ou Google) : les jetons
    JWT + le profil, pour que le front ait tout en un seul aller-retour.
    """
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        },
        status=status,
    )


class LimiteEnvoiCodes(AnonRateThrottle):
    """Freine l'envoi de codes par e-mail depuis une même adresse IP."""
    rate = "20/hour"


def reponse_otp(user, objet, status=200):
    """Envoie un code par e-mail ; le front doit ensuite appeler auth/otp/verifier/."""
    try:
        return Response(otp.demarrer(user, objet), status=status)
    except otp.ErreurOTP as e:
        return Response({"detail": e.message}, status=400)


class RegisterView(generics.CreateAPIView):
    """
    Inscription d'un nouvel utilisateur. Le compte est créé, puis un code OTP est
    envoyé à son adresse e-mail : la personne n'est connectée qu'après l'avoir saisi.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    # AllowAny : n'importe qui peut s'inscrire, même sans être déjà connecté
    permission_classes = [permissions.AllowAny]
    # Un vieux jeton périmé envoyé par le navigateur ne doit pas bloquer l'inscription
    authentication_classes = []
    throttle_classes = [LimiteEnvoiCodes]

    def create(self, request, *args, **kwargs):
        # Une inscription jamais confirmée (code non saisi) ne doit pas bloquer son
        # nom d'utilisateur pour toujours : on la remplace.
        nom = request.data.get("username")
        if isinstance(nom, str):
            User.objects.filter(
                username__iexact=nom, email_verifie=False, last_login__isnull=True,
                google_sub__isnull=True, is_staff=False,
            ).delete()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return reponse_otp(serializer.save(), "inscription", status=201)


class LoginView(views.APIView):
    """
    Connexion par nom d'utilisateur + mot de passe, 1re étape : si le mot de passe est
    bon, on envoie un code OTP par e-mail. Les jetons ne sont remis qu'à la 2e étape
    (auth/otp/verifier/).
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        # TokenObtainSerializer (SimpleJWT) vérifie les identifiants et que le compte
        # est actif ; il répond 401 sinon.
        serializer = TokenObtainSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed as e:
            return Response({"detail": str(e.detail)}, status=401)
        return reponse_otp(serializer.user, "connexion")


class VerifierOTPView(views.APIView):
    """2e étape : {"ticket": "...", "code": "123456"} -> jetons + profil."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            user = otp.verifier(request.data.get("ticket"), request.data.get("code", ""))
        except otp.ErreurOTP as e:
            return Response({"detail": e.message}, status=400)
        if not user.is_active:
            return Response({"detail": "Ce compte a été désactivé."}, status=403)

        update_last_login(None, user)
        return reponse_connexion(user)


class RenvoyerOTPView(views.APIView):
    """Envoie un nouveau code pour la même demande : {"ticket": "..."}."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            return Response(otp.renvoyer(request.data.get("ticket")))
        except otp.ErreurOTP as e:
            return Response(
                {"detail": e.message, "renvoi_dans_s": e.attente},
                status=429 if e.attente else 400,
            )


class RenouvellementSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        # Un jeton illisible ou expiré lève TokenError, que la vue transforme en 401.
        jeton = RefreshToken(attrs["refresh"])
        user = User.objects.filter(pk=jeton.get("user_id"), is_active=True).first()
        if user is None or session_revoquee(user, jeton):
            raise InvalidToken("Session terminée : reconnecte-toi.")
        return super().validate(attrs)


class RenouvellementView(TokenRefreshView):
    """
    POST /api/token/refresh/ — renouvelle le jeton d'accès, sauf pour un compte
    supprimé, désactivé, ou déconnecté par un administrateur.
    """
    serializer_class = RenouvellementSerializer


class ConfigAuthView(views.APIView):
    """
    Donne au front l'identifiant client Google à utiliser pour afficher le bouton
    « Se connecter avec Google » (il n'est défini qu'à un seul endroit : le .env).
    Vide = connexion Google non configurée : le front n'affiche pas le bouton.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"google_client_id": settings.GOOGLE_CLIENT_ID})


class GoogleLoginView(views.APIView):
    """
    Connexion ET inscription avec Google, en plus du nom d'utilisateur / mot de passe.
    Le front envoie le jeton remis par Google : {"credential": "<jeton>"}.
    On le vérifie, on retrouve ou on crée le compte, puis on renvoie nos propres
    jetons JWT (access + refresh), comme la route de connexion classique.
    """
    permission_classes = [permissions.AllowAny]
    # Un vieux jeton périmé envoyé par le navigateur ne doit pas bloquer la connexion
    authentication_classes = []

    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {"detail": "La connexion Google n'est pas configurée sur le serveur (GOOGLE_CLIENT_ID manquant dans le fichier .env)."},
                status=503,
            )

        jeton = request.data.get("credential")
        if not jeton or not isinstance(jeton, str):
            return Response({"detail": "Jeton Google manquant."}, status=400)

        try:
            infos = verifier_jeton_google(jeton)
        except JetonGoogleInvalide:
            return Response({"detail": "Connexion Google refusée : jeton invalide ou expiré."}, status=401)
        except PyJWKClientConnectionError:
            return Response(
                {"detail": "Impossible de joindre Google pour vérifier la connexion. Réessaie dans un instant."},
                status=503,
            )

        user = utilisateur_depuis_google(infos)
        if not user.is_active:
            return Response({"detail": "Ce compte a été désactivé."}, status=403)

        update_last_login(None, user)
        return reponse_connexion(user)


class MeView(generics.RetrieveUpdateAPIView):
    """
    Profil de l'utilisateur actuellement connecté.
    GET  -> renvoie ses infos
    PUT/PATCH -> permet de les modifier
    """
    queryset = User.objects.all()          # ← à ajouter
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # On renvoie toujours l'utilisateur identifié par son token,
        # jamais un autre : le queryset ci-dessus ne sert qu'à satisfaire DRF.
        return self.request.user


class EcoleListView(generics.ListAPIView):
    """Liste de toutes les écoles disponibles (INPHB, ESATIC...). Accessible à tous."""
    queryset = Ecole.objects.all()
    serializer_class = EcoleSerializer
    permission_classes = [permissions.AllowAny]


class FiliereListView(generics.ListAPIView):
    """
    Liste des filières, filtrable par école via ?ecole=<id> dans l'URL.
    Ex: /api/filieres/?ecole=2 -> uniquement les filières de l'école n°2.
    """
    serializer_class = FiliereSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Filiere.objects.all()
        ecole_id = self.request.query_params.get("ecole")
        if ecole_id:
            qs = qs.filter(ecole_id=ecole_id)
        return qs


# ═════════════════════════════════════════════════════════════
# SECTION 2 — Banque de questions
# ═════════════════════════════════════════════════════════════

class MatiereListView(generics.ListAPIView):
    serializer_class = MatiereSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Matiere.objects.annotate(
            nb_questions=Count("questions", filter=Q(questions__statut="validee"))
        )

    def get_serializer_context(self):
        # Nombre de questions validées par branche, calculé en une seule requête :
        # {id de la matière: {"dev": 8, "reseau": 18}}
        contexte = super().get_serializer_context()
        par_branche = {}
        lignes = (
            Question.objects.filter(statut="validee")
            .exclude(branche="")
            .values("matiere_id", "branche")
            .annotate(n=Count("id"))
        )
        for ligne in lignes:
            par_branche.setdefault(ligne["matiere_id"], {})[ligne["branche"]] = ligne["n"]
        contexte["questions_par_branche"] = par_branche
        return contexte

class QuestionListView(generics.ListAPIView):
    """
    Banque de questions consultable.
    Filtrable via l'URL, ex: /api/questions/?matiere=2&ecole=1&difficulte=facile
    Recherche texte libre via ?search=dérivée (sur le champ 'enonce').
    """
    serializer_class = QuestionSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    filterset_fields = ["ecole", "matiere", "difficulte", "annee_session", "type_question"]
    search_fields = ["enonce"]

    def get_queryset(self):
        # SÉCURITÉ IMPORTANTE : on ne renvoie JAMAIS les questions en_attente
        # ou rejetee. Seules les questions validées par un modérateur sont
        # visibles publiquement — que la question vienne d'une saisie manuelle
        # ou du pipeline d'import automatique (LLM).
        return Question.objects.filter(statut="validee")


class QuestionDetailView(generics.RetrieveAPIView):
    """Détail d'une question précise, identifiée par son ID dans l'URL (/api/questions/5/)."""
    queryset = Question.objects.filter(statut="validee")
    serializer_class = QuestionSerializer
    permission_classes = [permissions.AllowAny]


# ═════════════════════════════════════════════════════════════
# SECTION 3 — Contributions communautaires
# ═════════════════════════════════════════════════════════════

class SoumettreQuestionView(generics.CreateAPIView):
    """
    Un utilisateur connecté propose une nouvelle question.
    Toute la logique (créer la Question avec statut='en_attente', créer les Choix,
    créer la Contribution liée) est dans QuestionSoumissionSerializer.create().
    """
    serializer_class = QuestionSoumissionSerializer
    permission_classes = [permissions.IsAuthenticated]


class MesContributionsView(generics.ListAPIView):
    """Un utilisateur consulte le statut de ses propres contributions (en_attente/validée/rejetée)."""
    serializer_class = ContributionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # On ne montre que les contributions de l'utilisateur connecté,
        # jamais celles des autres.
        return Contribution.objects.filter(contributeur=self.request.user)


# ═════════════════════════════════════════════════════════════
# SECTION 4 — Quiz
# Ces vues ont une logique métier trop spécifique pour les classes
# génériques (ListAPIView, CreateAPIView...) — on utilise APIView brute
# et on écrit nous-mêmes la méthode post().
# ═════════════════════════════════════════════════════════════

class DemarrerQuizView(views.APIView):
    """
    Génère une nouvelle session de quiz.
    Reçoit : matières souhaitées, école (optionnel), nombre de questions, mode,
    et optionnellement un type_question ("qcm" ou "exercice") pour ne piocher
    QUE dans un seul type — évite de mélanger QCM et exercices dans une même
    session, choix fait explicitement par l'utilisateur dans Library.
    Renvoie : l'ID de la session créée + une liste de questions mélangées
    (SANS révéler les bonnes réponses, via QuestionQuizSerializer).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # request.data = le JSON envoyé par le front, ex:
        # {"matieres": [1, 2], "nombre_questions": 10, "mode": "libre", "type_question": "qcm"}
        serializer = DemarrerQuizSerializer(data=request.data)
        # raise_exception=True : si les données sont invalides, DRF renvoie
        # automatiquement une erreur 400 claire, pas besoin de la gérer à la main.
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # On ne pioche que dans les questions déjà validées
        questions_qs = Question.objects.filter(statut="validee")
        if data.get("matieres"):
            questions_qs = questions_qs.filter(matiere__in=data["matieres"])
        if data.get("ecole"):
            questions_qs = questions_qs.filter(ecole_id=data["ecole"])
        if data.get("type_question"):
            # Filtre optionnel : QCM uniquement, ou Exercice uniquement.
            questions_qs = questions_qs.filter(type_question=data["type_question"])
        if data.get("branche") and data["branche"] != "mixte":
            # Une seule branche : pour la matière découpée en branches (Informatique),
            # les questions des autres branches sont écartées. Les autres matières
            # cochées dans le même quiz, elles, restent entières.
            # "mixte" = toute la matière, sans filtre.
            matieres_a_branches = (
                Question.objects.filter(statut="validee", matiere__in=data["matieres"])
                .exclude(branche="")
                .values_list("matiere_id", flat=True)
                .distinct()
            )
            questions_qs = questions_qs.filter(
                Q(branche=data["branche"]) | ~Q(matiere_id__in=list(matieres_a_branches))
            )

        questions = list(questions_qs)
        random.shuffle(questions)  # mélange aléatoire de l'ordre
        questions = questions[: data["nombre_questions"]]  # on garde le nombre demandé

        if not questions:
            # Cas où aucune question ne correspond aux filtres choisis
            return Response(
                {"detail": "Aucune question disponible pour ces critères."},
                status=400,
            )

        # Création de la session en base, liée à l'utilisateur connecté
        session = QuizSession.objects.create(
            utilisateur=request.user,
            ecole_id=data.get("ecole"),
            mode=data["mode"],
            nombre_questions=len(questions),
        )
        # matieres est une relation ManyToMany : on ne peut pas la passer
        # directement dans .create(), on l'associe après avec .set()
        session.matieres.set(data["matieres"])

        return Response({
            "session_id": session.id,  # le front en aura besoin pour envoyer les réponses
            # QuestionQuizSerializer = version SANS la bonne réponse (pas de triche possible)
            "questions": QuestionQuizSerializer(questions, many=True).data,
        })


class RepondreQuizView(views.APIView):
    """
    Enregistre la réponse de l'utilisateur à UNE question QCM de sa session en cours.
    Renvoie immédiatement si c'était correct + l'explication, et surtout
    le texte de la bonne réponse quand l'utilisateur s'est trompé.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(id=session_id, utilisateur=request.user)
        except QuizSession.DoesNotExist:
            return Response({"detail": "Session introuvable."}, status=404)

        serializer = QuizAnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            question = Question.objects.get(id=data["question_id"])
            choix = question.choix.get(id=data["choix_id"])
        except (Question.DoesNotExist, Exception):
            return Response({"detail": "Question ou choix invalide."}, status=400)

        QuizAnswer.objects.update_or_create(
            session=session,
            question=question,
            defaults={
                "choix_selectionne": choix,
                "est_correcte": choix.est_correct,
                "temps_reponse_secondes": data.get("temps_reponse_secondes"),
            },
        )

        reponse_data = {
            "correcte": choix.est_correct,
            "explication": question.explication,
        }

        # Si l'utilisateur s'est trompé, on lui indique précisément
        # quelle était la bonne réponse, pas juste "c'est faux".
        if not choix.est_correct:
            bonne_reponse = question.choix.filter(est_correct=True).first()
            reponse_data["bonne_reponse"] = bonne_reponse.texte if bonne_reponse else None

        return Response(reponse_data)


class RepondreExerciceView(views.APIView):
    """
    Enregistre et corrige (via IA, voir correction_ia.py) la réponse en texte
    libre d'un utilisateur à une question de type "exercice".

    Contrairement à RepondreQuizView, il n'y a pas de choix_id à comparer :
    la note est déterminée en envoyant à Groq l'énoncé, la solution de
    référence (question.explication) et la réponse de l'utilisateur.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(id=session_id, utilisateur=request.user)
        except QuizSession.DoesNotExist:
            return Response({"detail": "Session introuvable."}, status=404)

        serializer = ReponseExerciceSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            question = Question.objects.get(id=data["question_id"], type_question="exercice")
        except Question.DoesNotExist:
            return Response({"detail": "Question invalide ou n'est pas un exercice."}, status=400)

        try:
            resultat = corriger_exercice(
                enonce=question.enonce,
                solution_reference=question.explication,
                reponse_utilisateur=data["reponse_texte"],
            )
        except CorrectionIndisponible:
            # La correction IA n'est pas disponible pour le moment (quota,
            # erreur réseau, réponse inexploitable...) : on enregistre quand
            # même la réponse comme non notée, et on affiche la solution
            # plutôt que de bloquer l'utilisateur avec une erreur.
            QuizAnswer.objects.update_or_create(
                session=session,
                question=question,
                defaults={
                    "reponse_texte": data["reponse_texte"],
                    "est_correcte": False,
                    "temps_reponse_secondes": data.get("temps_reponse_secondes"),
                },
            )
            return Response({
                "correcte": None,
                "feedback": "La correction automatique est momentanément indisponible.",
                "explication": question.explication,
            })

        QuizAnswer.objects.update_or_create(
            session=session,
            question=question,
            defaults={
                "reponse_texte": data["reponse_texte"],
                "feedback_ia": resultat["feedback"],
                "est_correcte": resultat["correcte"],
                "temps_reponse_secondes": data.get("temps_reponse_secondes"),
            },
        )

        return Response({
            "correcte": resultat["correcte"],
            "feedback": resultat["feedback"],
            "explication": question.explication,
        })


class TerminerQuizView(views.APIView):
    """
    Clôture une session de quiz : calcule le score final, la durée,
    et renvoie le détail complet (question par question) pour l'écran de résultat.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(id=session_id, utilisateur=request.user)
        except QuizSession.DoesNotExist:
            return Response({"detail": "Session introuvable."}, status=404)

        reponses = session.reponses.all()
        total = session.nombre_questions
        correctes = reponses.filter(est_correcte=True).count()

        # Score en pourcentage. Le "if total else 0" évite une division par zéro
        # si jamais nombre_questions valait 0.
        # Les exercices comptent comme les QCM ici : ils sont notés par IA dans
        # RepondreExerciceView et stockent est_correcte comme n'importe quelle
        # réponse — aucun traitement spécial n'est donc nécessaire.
        session.score = round((correctes / total) * 100, 1) if total else 0
        session.date_fin = timezone.now()
        session.termine = True

        # Calcul de la durée totale du quiz en secondes
        if session.date_debut:
            session.duree_secondes = int((session.date_fin - session.date_debut).total_seconds())

        session.save()

        # QuizResultSerializer renvoie le score + le détail de chaque réponse
        # (question, correcte ou non, explication) pour l'écran de résultat.
        return Response(QuizResultSerializer(session).data)


class MesQuizSessionsView(generics.ListAPIView):
    """
    Historique des quiz de l'utilisateur connecté, du plus récent au plus ancien.
    Utilisé pour alimenter le tableau de bord de progression (prévu au cahier des charges).
    """
    serializer_class = QuizSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return QuizSession.objects.filter(
            utilisateur=self.request.user
        ).order_by("-date_debut")  # "-" = ordre décroissant (le plus récent en premier)