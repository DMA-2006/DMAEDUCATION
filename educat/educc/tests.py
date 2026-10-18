import re
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CodeOTP, User
from .services.google_auth import JetonGoogleInvalide

INFOS_GOOGLE = {
    "sub": "google-123",
    "email": "awa.kone@gmail.com",
    "email_verified": True,
    "given_name": "Awa",
    "family_name": "Koné",
}


@override_settings(GOOGLE_CLIENT_ID="client-de-test.apps.googleusercontent.com")
class ConnexionGoogleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def connecter(self, infos=INFOS_GOOGLE):
        with patch("educc.views.verifier_jeton_google", return_value=infos):
            return self.client.post("/api/auth/google/", {"credential": "jeton"}, format="json")

    def test_premiere_connexion_cree_le_compte(self):
        res = self.connecter()
        self.assertEqual(res.status_code, 200)
        user = User.objects.get(google_sub="google-123")
        self.assertEqual(user.email, "awa.kone@gmail.com")
        self.assertEqual(user.username, "awa.kone")
        self.assertFalse(user.has_usable_password())
        self.assertEqual(res.data["user"]["id"], user.id)

        # Le jeton renvoyé donne bien accès au profil
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.assertEqual(self.client.get("/api/me/").data["username"], "awa.kone")

    def test_reconnexion_retrouve_le_meme_compte(self):
        self.connecter()
        # Même compte Google, même si l'adresse e-mail a changé entre-temps
        self.connecter({**INFOS_GOOGLE, "email": "nouvelle@gmail.com"})
        self.assertEqual(User.objects.count(), 1)

    def test_compte_existant_rattache_par_email(self):
        ancien = User.objects.create_user("awa", email="Awa.Kone@gmail.com", password="x", email_verifie=True)
        res = self.connecter()
        self.assertEqual(res.data["user"]["id"], ancien.id)
        self.assertEqual(User.objects.count(), 1)
        ancien.refresh_from_db()
        self.assertEqual(ancien.google_sub, "google-123")

    def test_email_en_double_l_administrateur_est_prioritaire(self):
        User.objects.create_user("awa1", email="awa.kone@gmail.com", password="x", email_verifie=True)
        admin = User.objects.create_superuser("chef", email="awa.kone@gmail.com", password="x", email_verifie=True)
        User.objects.create_user("awa2", email="awa.kone@gmail.com", password="x", email_verifie=True)
        self.assertEqual(self.connecter().data["user"]["id"], admin.id)

    def test_nom_utilisateur_deja_pris(self):
        User.objects.create_user("awa.kone", email="autre@gmail.com", password="x")
        self.connecter()
        self.assertEqual(User.objects.get(google_sub="google-123").username, "awa.kone2")

    def test_jeton_invalide_refuse(self):
        with patch("educc.views.verifier_jeton_google", side_effect=JetonGoogleInvalide("x")):
            res = self.client.post("/api/auth/google/", {"credential": "faux"}, format="json")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(User.objects.count(), 0)

    def test_vrai_controle_refuse_un_jeton_bidon(self):
        # Sans simulation : un texte quelconque n'est pas un jeton Google
        res = self.client.post("/api/auth/google/", {"credential": "pas-un-jeton"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_jeton_manquant(self):
        self.assertEqual(self.client.post("/api/auth/google/", {}, format="json").status_code, 400)

    def test_compte_desactive(self):
        User.objects.create_user("awa", email="awa.kone@gmail.com", password="x", is_active=False, email_verifie=True)
        self.assertEqual(self.connecter().status_code, 403)

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_non_configure(self):
        self.assertEqual(self.connecter().status_code, 503)

    def test_compte_a_l_email_non_verifie_n_est_pas_rattache(self):
        # N'importe qui a pu s'inscrire avec cette adresse sans la prouver :
        # Google ne doit pas ouvrir ce compte-là.
        squatteur = User.objects.create_user("faux", email="awa.kone@gmail.com", password="x")
        res = self.connecter()
        self.assertNotEqual(res.data["user"]["id"], squatteur.id)
        self.assertEqual(User.objects.count(), 2)

    def test_config_donne_l_identifiant_client(self):
        res = self.client.get("/api/auth/config/")
        self.assertEqual(res.data, {"google_client_id": "client-de-test.apps.googleusercontent.com"})



@override_settings(OTP_ENVOI_SYNCHRONE=True)
class CodeOTPTests(TestCase):
    INSCRIPTION = {"username": "awa", "email": "awa@gmail.com", "password": "MotDePasse-42"}

    def setUp(self):
        self.client = APIClient()
        cache.clear()  # remet à zéro la limite d'envois par adresse IP

    def dernier_code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def inscrire(self):
        return self.client.post("/api/register/", self.INSCRIPTION, format="json")

    def verifier(self, ticket, code):
        return self.client.post("/api/auth/otp/verifier/", {"ticket": ticket, "code": code}, format="json")

    def compte_verifie(self):
        return User.objects.create_user("awa", email="awa@gmail.com", password="MotDePasse-42", email_verifie=True)

    def connecter(self, mot_de_passe="MotDePasse-42"):
        return self.client.post("/api/login/", {"username": "awa", "password": mot_de_passe}, format="json")

    def test_inscription_demande_un_code_puis_connecte(self):
        res = self.inscrire()
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["otp_requis"])
        self.assertNotIn("access", res.data)
        self.assertEqual(res.data["email"], "aw***@gmail.com")
        self.assertEqual(mail.outbox[-1].to, ["awa@gmail.com"])
        self.assertFalse(User.objects.get(username="awa").email_verifie)

        res = self.verifier(res.data["ticket"], self.dernier_code())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["username"], "awa")
        self.assertTrue(User.objects.get(username="awa").email_verifie)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.assertEqual(self.client.get("/api/me/").status_code, 200)

    def test_connexion_demande_un_code(self):
        self.compte_verifie()
        res = self.connecter()
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["otp_requis"])
        self.assertNotIn("access", res.data)
        res = self.verifier(res.data["ticket"], self.dernier_code())
        self.assertEqual(res.status_code, 200)
        self.assertIn("refresh", res.data)

    def test_mauvais_mot_de_passe_n_envoie_rien(self):
        self.compte_verifie()
        self.assertEqual(self.connecter("faux").status_code, 401)
        self.assertEqual(len(mail.outbox), 0)

    def test_le_code_n_est_pas_stocke_en_clair(self):
        self.compte_verifie()
        self.connecter()
        self.assertNotIn(self.dernier_code(), CodeOTP.objects.get().code_hache)

    def test_code_faux_puis_bon(self):
        self.compte_verifie()
        ticket = self.connecter().data["ticket"]
        bon = self.dernier_code()
        faux = "000000" if bon != "000000" else "111111"
        res = self.verifier(ticket, faux)
        self.assertEqual(res.status_code, 400)
        self.assertIn("4 essais", res.data["detail"])
        self.assertEqual(self.verifier(ticket, bon).status_code, 200)

    def test_trop_d_essais_bloque_meme_le_bon_code(self):
        self.compte_verifie()
        ticket = self.connecter().data["ticket"]
        bon = self.dernier_code()
        faux = "000000" if bon != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.verifier(ticket, faux).status_code, 400)
        self.assertEqual(self.verifier(ticket, bon).status_code, 400)

    def test_code_utilisable_une_seule_fois(self):
        self.compte_verifie()
        ticket = self.connecter().data["ticket"]
        code = self.dernier_code()
        self.assertEqual(self.verifier(ticket, code).status_code, 200)
        self.assertEqual(self.verifier(ticket, code).status_code, 400)

    def test_code_expire(self):
        self.compte_verifie()
        ticket = self.connecter().data["ticket"]
        CodeOTP.objects.update(expire_le=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verifier(ticket, self.dernier_code()).status_code, 400)

    def test_ticket_invente_refuse(self):
        self.assertEqual(self.verifier("nimporte-quoi", "123456").status_code, 400)

    def test_renvoi_attend_une_minute_puis_remplace_le_code(self):
        self.compte_verifie()
        ticket = self.connecter().data["ticket"]
        premier = self.dernier_code()

        res = self.client.post("/api/auth/otp/renvoyer/", {"ticket": ticket}, format="json")
        self.assertEqual(res.status_code, 429)
        self.assertEqual(len(mail.outbox), 1)

        CodeOTP.objects.update(envoye_le=timezone.now() - timedelta(seconds=61))
        res = self.client.post("/api/auth/otp/renvoyer/", {"ticket": ticket}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        nouveau = self.dernier_code()
        if nouveau != premier:
            self.assertEqual(self.verifier(ticket, premier).status_code, 400)
        self.assertEqual(self.verifier(ticket, nouveau).status_code, 200)

    def test_inscription_jamais_confirmee_ne_bloque_pas_le_nom(self):
        self.inscrire()  # code jamais saisi
        res = self.client.post(
            "/api/register/", {**self.INSCRIPTION, "email": "autre@gmail.com"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(username="awa").email, "autre@gmail.com")

    def test_compte_confirme_n_est_pas_remplacable(self):
        self.compte_verifie()
        self.assertEqual(self.inscrire().status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_email_deja_utilise_par_un_compte_confirme(self):
        self.compte_verifie()
        res = self.client.post("/api/register/", {**self.INSCRIPTION, "username": "autre"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data)

    def test_changer_d_email_retire_la_verification(self):
        user = self.compte_verifie()
        self.client.force_authenticate(user)
        self.client.patch("/api/me/", {"email": "nouvelle@gmail.com"}, format="json")
        user.refresh_from_db()
        self.assertFalse(user.email_verifie)


class BranchesInformatiqueTests(TestCase):
    def setUp(self):
        from .models import Ecole, Matiere, Question

        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user("awa", password="x"))
        ecole = Ecole.objects.create(nom="ESATIC", slug="esatic")
        self.info = Matiere.objects.get_or_create(nom="Informatique")[0]
        self.maths = Matiere.objects.get_or_create(nom="Mathématiques")[0]
        Question.objects.filter(matiere__in=[self.info, self.maths]).delete()

        def creer(matiere, branche, n, **extra):
            for i in range(n):
                Question.objects.create(
                    enonce=f"{branche or 'general'} {i}", matiere=matiere, ecole=ecole, branche=branche, **extra
                )

        creer(self.info, "dev", 3)
        creer(self.info, "reseau", 4)
        creer(self.info, "", 2)  # système d'exploitation, etc.
        creer(self.info, "reseau", 1, statut="en_attente")  # non validée : jamais comptée
        creer(self.maths, "", 5)

    def demarrer(self, **extra):
        donnees = {"matieres": [self.info.id], "nombre_questions": 50, "mode": "libre", **extra}
        res = self.client.post("/api/quiz/demarrer/", donnees, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        from .models import Question

        ids = [q["id"] for q in res.data["questions"]]
        return list(Question.objects.filter(id__in=ids).values_list("branche", flat=True))

    def test_developpement_ne_contient_aucune_question_reseau(self):
        self.assertEqual(self.demarrer(branche="dev"), ["dev"] * 3)

    def test_reseau_ne_contient_que_du_reseau(self):
        self.assertEqual(self.demarrer(branche="reseau"), ["reseau"] * 4)

    def test_mixte_contient_toute_la_matiere(self):
        self.assertEqual(sorted(self.demarrer(branche="mixte")), ["", "", "dev", "dev", "dev"] + ["reseau"] * 4)
        self.assertEqual(len(self.demarrer()), 9)  # sans branche précisée : pareil

    def test_plusieurs_matieres_la_branche_ne_filtre_que_l_informatique(self):
        # Maths + Informatique « réseau » : toutes les maths, et seulement le réseau
        donnees = {
            "matieres": [self.info.id, self.maths.id], "nombre_questions": 50,
            "mode": "libre", "branche": "reseau",
        }
        res = self.client.post("/api/quiz/demarrer/", donnees, format="json")
        from .models import Question

        tirees = Question.objects.filter(id__in=[q["id"] for q in res.data["questions"]])
        self.assertEqual(tirees.filter(matiere=self.maths).count(), 5)
        self.assertEqual(
            list(tirees.filter(matiere=self.info).values_list("branche", flat=True)), ["reseau"] * 4
        )

    def test_branche_inconnue_refusee(self):
        donnees = {"matieres": [self.info.id], "nombre_questions": 5, "branche": "cuisine"}
        self.assertEqual(self.client.post("/api/quiz/demarrer/", donnees, format="json").status_code, 400)

    def test_liste_des_matieres_donne_les_branches(self):
        matieres = {m["nom"]: m for m in self.client.get("/api/matieres/").data}
        self.assertEqual(matieres["Informatique"]["nb_questions"], 9)
        self.assertEqual(
            matieres["Informatique"]["branches"],
            [
                {"code": "dev", "nom": "Développement d'application web", "nb_questions": 3},
                {"code": "reseau", "nom": "Réseau informatique", "nb_questions": 4},
            ],
        )
        self.assertEqual(matieres["Mathématiques"]["branches"], [])


class ActionsAdminTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("chef", password="x", role="admin")
        self.eleve = User.objects.create_user("awa", email="awa@gmail.com", password="x")
        self.api_admin = APIClient()
        self.api_admin.force_authenticate(self.admin)

    def session(self, user, il_y_a_s=60):
        """Jetons d'une connexion faite il y a quelques secondes."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        refresh.set_iat(at_time=timezone.now() - timedelta(seconds=il_y_a_s))
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        return client, str(refresh)

    def test_deconnecter_ferme_la_session_et_empeche_le_renouvellement(self):
        client, refresh = self.session(self.eleve)
        self.assertEqual(client.get("/api/me/").status_code, 200)

        res = self.api_admin.post(f"/api/admin/utilisateurs/{self.eleve.id}/deconnecter/")
        self.assertEqual(res.status_code, 204)

        self.assertEqual(client.get("/api/me/").status_code, 401)
        self.assertEqual(client.post("/api/me/ping/").status_code, 401)
        res = APIClient().post("/api/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 401)
        self.eleve.refresh_from_db()
        self.assertTrue(self.eleve.a_quitte)

    def test_une_page_publique_reste_lisible_sans_jeton(self):
        self.api_admin.post(f"/api/admin/utilisateurs/{self.eleve.id}/deconnecter/")
        self.assertEqual(APIClient().get("/api/matieres/").status_code, 200)

    def test_la_personne_peut_se_reconnecter_apres(self):
        self.api_admin.post(f"/api/admin/utilisateurs/{self.eleve.id}/deconnecter/")
        User.objects.filter(pk=self.eleve.pk).update(
            sessions_invalides_avant=timezone.now() - timedelta(seconds=30)
        )
        client, refresh = self.session(self.eleve, il_y_a_s=0)  # nouvelle connexion
        self.assertEqual(client.get("/api/me/").status_code, 200)
        res = APIClient().post("/api/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_les_autres_comptes_ne_sont_pas_touches(self):
        autre = User.objects.create_user("koffi", password="x")
        client, _ = self.session(autre)
        self.api_admin.post(f"/api/admin/utilisateurs/{self.eleve.id}/deconnecter/")
        self.assertEqual(client.get("/api/me/").status_code, 200)

    def test_supprimer_efface_le_compte_et_ses_jetons(self):
        client, refresh = self.session(self.eleve)
        res = self.api_admin.delete(f"/api/admin/utilisateurs/{self.eleve.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.eleve.pk).exists())
        self.assertEqual(client.get("/api/me/").status_code, 401)
        res = APIClient().post("/api/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_un_eleve_ne_peut_ni_deconnecter_ni_supprimer(self):
        client, _ = self.session(self.eleve)
        self.assertEqual(client.post(f"/api/admin/utilisateurs/{self.admin.id}/deconnecter/").status_code, 403)
        self.assertEqual(client.delete(f"/api/admin/utilisateurs/{self.admin.id}/").status_code, 403)
        self.assertEqual(APIClient().delete(f"/api/admin/utilisateurs/{self.admin.id}/").status_code, 401)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_l_admin_ne_peut_pas_agir_sur_lui_meme(self):
        self.assertEqual(self.api_admin.delete(f"/api/admin/utilisateurs/{self.admin.id}/").status_code, 403)
        self.assertEqual(self.api_admin.post(f"/api/admin/utilisateurs/{self.admin.id}/deconnecter/").status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_un_admin_simple_ne_touche_pas_au_superutilisateur(self):
        patron = User.objects.create_superuser("patron", password="x")
        self.assertEqual(self.api_admin.delete(f"/api/admin/utilisateurs/{patron.id}/").status_code, 403)
        self.assertTrue(User.objects.filter(pk=patron.pk).exists())

    def test_compte_inexistant(self):
        self.assertEqual(self.api_admin.delete("/api/admin/utilisateurs/999999/").status_code, 404)

    def test_la_liste_indique_les_comptes_modifiables(self):
        inscrits = {i["username"]: i for i in self.api_admin.get("/api/admin/stats/").data["inscrits"]}
        self.assertFalse(inscrits["chef"]["modifiable"])
        self.assertTrue(inscrits["awa"]["modifiable"])


@override_settings(
    BREVO_API_KEY="xkeysib-test",
    DEFAULT_FROM_EMAIL="DMAEDUCATION <expediteur@gmail.com>",
    EMAIL_BACKEND="educc.services.otp.EmailBackendBrevo",
    OTP_ENVOI_SYNCHRONE=True,
)
class EnvoiBrevoTests(TestCase):
    def test_le_code_part_par_l_api_brevo(self):
        from unittest.mock import MagicMock

        User.objects.create_user("awa", email="awa@gmail.com", password="MotDePasse-42", email_verifie=True)
        reponse = MagicMock(status_code=201, text="")
        with patch("educc.services.otp.requests.post", return_value=reponse) as envoi:
            res = APIClient().post("/api/login/", {"username": "awa", "password": "MotDePasse-42"}, format="json")
        self.assertEqual(res.status_code, 200)
        envoi.assert_called_once()
        corps = envoi.call_args.kwargs["json"]
        self.assertEqual(corps["sender"], {"name": "DMAEDUCATION", "email": "expediteur@gmail.com"})
        self.assertEqual(corps["to"], [{"email": "awa@gmail.com"}])
        self.assertRegex(corps["subject"], r"^\d{6} est ton code")
        self.assertIn("htmlContent", corps)
        self.assertEqual(envoi.call_args.kwargs["headers"]["api-key"], "xkeysib-test")
