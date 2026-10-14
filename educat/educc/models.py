
"""
Modèles du projet EDUCATION (app eduuc), regroupés par section :
1. Comptes & structure académique : Ecole, Filiere, User
2. Banque de questions : Matiere, Question, Choix
3. Quiz : QuizSession, QuizAnswer
4. Contributions communautaires : Contribution
"""

from django.db import models


from django.contrib.auth.models import AbstractUser

# Create your models here.

# ─────────────────────────────────────────
# 1. Comptes & structure académique
# ─────────────────────────────────────────

class Ecole(models.Model):
    nom = models.CharField(max_length=100, unique=True)  # "INPHB", "ESATIC"
    description = models.TextField(blank=True)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.nom

class Filiere(models.Model):
    NIVEAU_CHOICES = [
        ("licence", "Licence"),
        ("ingenieur", "Cycle Ingénieur"),
        ("master", "Master"),
    ]

    ecole = models.ForeignKey(Ecole, on_delete=models.CASCADE, related_name="filieres")
    nom = models.CharField(max_length=100)
    niveau = models.CharField(max_length=10, choices=NIVEAU_CHOICES, default="licence")

    class Meta:
        unique_together = ("ecole", "nom")

    def __str__(self):
        return f"{self.nom} ({self.ecole.nom} — {self.get_niveau_display()})"


class User(AbstractUser):
    ROLE_CHOICES = [
        ("candidat", "Candidat"),
        ("moderateur", "Modérateur"),
        ("admin", "Admin"),
    ]

    ecole_ciblee = models.ForeignKey(Ecole, on_delete=models.SET_NULL, null=True, blank=True)
    filiere_ciblee = models.ForeignKey(Filiere, on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="candidat")
    derniere_activite = models.DateTimeField(null=True, blank=True)
    a_quitte = models.BooleanField(default=False)
    # Identifiant du compte Google rattaché (champ "sub" du jeton Google) : il ne
    # change jamais, contrairement à l'adresse e-mail. Vide tant que la personne
    # ne s'est pas encore connectée avec Google.
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    # Vrai quand la personne a prouvé que l'adresse e-mail est la sienne (code OTP
    # saisi, ou connexion avec Google). Repasse à faux si elle change d'adresse.
    email_verifie = models.BooleanField(default=False)
    # Rempli quand un administrateur déconnecte ce compte : toute connexion ouverte
    # avant cette date est refusée (voir authentification.py).
    sessions_invalides_avant = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.username


class CodeOTP(models.Model):
    """
    Code à 6 chiffres envoyé par e-mail (voir services/otp.py). On ne garde que
    l'empreinte du code, jamais le code lui-même.
    """
    OBJET_CHOICES = [("inscription", "Inscription"), ("connexion", "Connexion")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="codes_otp")
    objet = models.CharField(max_length=20, choices=OBJET_CHOICES)
    code_hache = models.CharField(max_length=64, blank=True)
    envoye_le = models.DateTimeField(null=True, blank=True)
    expire_le = models.DateTimeField()
    tentatives = models.PositiveSmallIntegerField(default=0)
    utilise = models.BooleanField(default=False)

    def __str__(self):
        return f"Code OTP ({self.objet}) de {self.user}"


# ─────────────────────────────────────────
# 2. Banque de questions
# ─────────────────────────────────────────

class Matiere(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    icone = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return self.nom


class Question(models.Model):
    TYPE_CHOICES = [
        ("qcm", "QCM (choix multiples)"),
        ("exercice", "Exercice (réponse développée)"),
    ]
    DIFFICULTE_CHOICES = [("facile", "Facile"), ("moyen", "Moyen"), ("difficile", "Difficile")]
    STATUT_CHOICES = [("en_attente", "En attente"), ("validee", "Validée"), ("rejetee", "Rejetée")]
    # Sous-branches d'une matière (aujourd'hui : Informatique). Dans la Library, on peut
    # réviser une seule branche, ou « Mixte » = toutes les questions de la matière.
    BRANCHE_CHOICES = [
        ("dev", "Développement d'application web"),
        ("reseau", "Réseau informatique"),
        ("systeme", "Systèmes d'exploitation et architecture"),
    ]

    type_question = models.CharField(max_length=10, choices=TYPE_CHOICES, default="qcm")
    enonce = models.TextField()

    # Texte/passage que l'utilisateur doit lire avant de répondre à la question
    # (ex: texte de compréhension en anglais). Vide si la question n'en a pas besoin.
    texte_support = models.TextField(blank=True)

    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE, related_name="questions")
    # Vide = la question n'appartient à aucune branche : elle ne sort que dans « Mixte ».
    # Rempli par « python manage.py classer_informatique » ou à la main dans l'admin.
    branche = models.CharField(max_length=20, choices=BRANCHE_CHOICES, blank=True, db_index=True)
    ecole = models.ForeignKey(Ecole, on_delete=models.CASCADE, related_name="questions")
    filiere = models.ForeignKey(Filiere, on_delete=models.SET_NULL, null=True, blank=True)
    annee_session = models.PositiveIntegerField(null=True, blank=True)
    difficulte = models.CharField(max_length=10, choices=DIFFICULTE_CHOICES, default="moyen")

    # Pour un QCM : explication de la bonne réponse (courte)
    # Pour un exercice : solution complète rédigée, étape par étape
    explication = models.TextField(blank=True)

    image = models.ImageField(upload_to="questions/", null=True, blank=True)
    auteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="questions_creees")
    statut = models.CharField(max_length=15, choices=STATUT_CHOICES, default="validee")
    motif_rejet = models.TextField(blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.enonce[:60]

class Choix(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choix")
    texte = models.CharField(max_length=500)
    est_correct = models.BooleanField(default=False)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre"]

    def __str__(self):
        return f"{self.texte} {'✓' if self.est_correct else ''}"


# ─────────────────────────────────────────
# 3. Quiz
# ─────────────────────────────────────────

class QuizSession(models.Model):
    MODE_CHOICES = [("libre", "Libre"), ("chronometre", "Chronométré")]

    utilisateur = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quiz_sessions")
    matieres = models.ManyToManyField(Matiere, blank=True)
    ecole = models.ForeignKey(Ecole, on_delete=models.SET_NULL, null=True, blank=True)
    mode = models.CharField(max_length=15, choices=MODE_CHOICES, default="libre")
    nombre_questions = models.PositiveSmallIntegerField()
    score = models.FloatField(null=True, blank=True)
    duree_secondes = models.PositiveIntegerField(null=True, blank=True)

    date_debut = models.DateTimeField(auto_now_add=True)
    date_fin = models.DateTimeField(null=True, blank=True)
    termine = models.BooleanField(default=False)

    def __str__(self):
        return f"Quiz de {self.utilisateur} — {self.date_debut:%d/%m/%Y}"


class QuizAnswer(models.Model):
    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name="reponses")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    choix_selectionne = models.ForeignKey(Choix, on_delete=models.SET_NULL, null=True, blank=True)
    reponse_texte = models.TextField(blank=True)  # réponse libre de l'utilisateur (exercices)
    feedback_ia = models.TextField(blank=True)    # retour donné par Groq pour un exercice
    est_correcte = models.BooleanField(default=False)
    temps_reponse_secondes = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("session", "question")


# ─────────────────────────────────────────
# 4. Contributions communautaires
# ─────────────────────────────────────────

class Contribution(models.Model):
    question = models.OneToOneField(Question, on_delete=models.CASCADE, related_name="contribution")
    contributeur = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contributions")
    date_soumission = models.DateTimeField(auto_now_add=True)
    date_traitement = models.DateTimeField(null=True, blank=True)
    traite_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="moderations")

    def __str__(self):
        return f"Contribution de {self.contributeur} — {self.question.statut}"




class PdfTraite(models.Model):
    """
    Garde une trace des PDF déjà traités avec succès par le scraper automatique
    (importer_annales), pour éviter de les retélécharger et de créer des
    doublons en base lors d'une relance (ex: après un arrêt sur quota journalier).
    """
    url = models.URLField(max_length=500, unique=True)
    source = models.CharField(max_length=50)  # "inphb" ou "esatic"
    nom_fichier = models.CharField(max_length=255, blank=True)
    date_traitement = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nom_fichier or self.url} ({self.source})"