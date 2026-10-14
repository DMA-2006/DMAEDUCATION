from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import (
    Ecole, Filiere, User, Matiere, Question, Choix,
    QuizSession, QuizAnswer, Contribution,
)


# ─────────────────────────────────────────
# Comptes & structure académique
# ─────────────────────────────────────────

class EcoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ecole
        fields = ["id", "nom", "description", "slug"]


class FiliereSerializer(serializers.ModelSerializer):
    class Meta:
        model = Filiere
        fields = ["id", "nom", "ecole"]


class UserSerializer(serializers.ModelSerializer):
    est_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "ecole_ciblee", "filiere_ciblee", "role", "est_admin"]
        read_only_fields = ["role"]

    def get_est_admin(self, obj):
        return obj.is_superuser or obj.role == "admin"

    def update(self, instance, validated_data):
        # Nouvelle adresse e-mail = adresse pas encore prouvée (elle le sera au
        # prochain code OTP saisi).
        nouvelle = validated_data.get("email")
        if nouvelle is not None and nouvelle.lower() != (instance.email or "").lower():
            instance.email_verifie = False
        return super().update(instance, validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["username", "email", "password", "ecole_ciblee", "filiere_ciblee"]
        # Le code OTP part à cette adresse : elle est obligatoire.
        extra_kwargs = {"email": {"required": True, "allow_blank": False}}

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value, email_verifie=True).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            ecole_ciblee=validated_data.get("ecole_ciblee"),
            filiere_ciblee=validated_data.get("filiere_ciblee"),
        )


# ─────────────────────────────────────────
# Banque de questions
# ─────────────────────────────────────────
class MatiereSerializer(serializers.ModelSerializer):
    nb_questions = serializers.IntegerField(read_only=True, default=0)
    # Sous-branches de la matière qui ont au moins une question validée, ex. :
    # [{"code": "dev", "nom": "Développement d'application web", "nb_questions": 8}, ...]
    # Liste vide pour une matière sans branche.
    branches = serializers.SerializerMethodField()

    class Meta:
        model = Matiere
        fields = ["id", "nom", "icone", "nb_questions", "branches"]

    def get_branches(self, obj):
        compte = self.context.get("questions_par_branche", {}).get(obj.id, {})
        return [
            {"code": code, "nom": nom, "nb_questions": compte[code]}
            for code, nom in Question.BRANCHE_CHOICES
            if compte.get(code)
        ]


class ChoixSerializer(serializers.ModelSerializer):
    """Version complète (révèle la bonne réponse) — pour la banque de questions et l'admin."""
    class Meta:
        model = Choix
        fields = ["id", "texte", "est_correct", "ordre"]


class ChoixSansReponseSerializer(serializers.ModelSerializer):
    """Version utilisée pendant un quiz en cours : ne révèle pas la bonne réponse."""
    class Meta:
        model = Choix
        fields = ["id", "texte", "ordre"]


class QuestionSerializer(serializers.ModelSerializer):
    choix = ChoixSerializer(many=True, read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)
    ecole_nom = serializers.CharField(source="ecole.nom", read_only=True)

    class Meta:
        model = Question
        fields = [
            "id", "type_question", "enonce", "texte_support", "matiere", "matiere_nom",
            "ecole", "ecole_nom", "filiere", "annee_session", "difficulte", "explication",
            "statut", "date_creation", "choix",
        ]
        read_only_fields = ["statut"]


class QuestionQuizSerializer(serializers.ModelSerializer):
    """
    Version utilisée pendant un quiz.
    - Pour un QCM : choix affichés SANS la bonne réponse.
    - Pour un exercice : pas de choix du tout, l'utilisateur répond en texte libre,
    corrigé automatiquement par IA via RepondreExerciceView.
    """
    choix = ChoixSansReponseSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "type_question", "enonce", "texte_support", "matiere", "difficulte", "choix"]


class QuestionSoumissionSerializer(serializers.ModelSerializer):
    """Utilisé quand un utilisateur propose une nouvelle question (contribution)."""
    choix = ChoixSerializer(many=True)

    class Meta:
        model = Question
        fields = ["enonce", "texte_support", "matiere", "ecole", "filiere", "annee_session",
                  "difficulte", "explication", "choix"]

    def create(self, validated_data):
        choix_data = validated_data.pop("choix")
        user = self.context["request"].user

        question = Question.objects.create(
            **validated_data, auteur=user, statut="en_attente"
        )
        for c in choix_data:
            Choix.objects.create(question=question, **c)

        Contribution.objects.create(question=question, contributeur=user)
        return question


# ─────────────────────────────────────────
# Quiz
# ─────────────────────────────────────────

class DemarrerQuizSerializer(serializers.Serializer):
    matieres = serializers.PrimaryKeyRelatedField(many=True, queryset=Matiere.objects.all())
    ecole = serializers.IntegerField(required=False)
    nombre_questions = serializers.IntegerField(min_value=1, max_value=50)
    mode = serializers.ChoiceField(choices=QuizSession.MODE_CHOICES, default="libre")
    # Permet de démarrer un quiz composé UNIQUEMENT de QCM ou UNIQUEMENT
    # d'exercices — jamais un mélange des deux dans une même session.
    # Optionnel : si absent, les deux types sont mélangés (comportement historique).
    type_question = serializers.ChoiceField(
        choices=[("qcm", "QCM"), ("exercice", "Exercice")],
        required=False,
    )
    # Sous-branche de la matière (Informatique) : "dev" ou "reseau" pour ne tirer que
    # les questions de cette branche ; "mixte" ou absent = toutes les questions.
    branche = serializers.ChoiceField(
        choices=[*Question.BRANCHE_CHOICES, ("mixte", "Mixte")],
        required=False,
    )


class QuizAnswerSubmitSerializer(serializers.Serializer):
    """Soumission d'une réponse à un QCM."""
    question_id = serializers.IntegerField()
    choix_id = serializers.IntegerField()
    temps_reponse_secondes = serializers.IntegerField(required=False)


class ReponseExerciceSubmitSerializer(serializers.Serializer):
    """
    Soumission d'une réponse à un exercice (texte libre).
    Pas de choix_id : la correction se fait via IA dans RepondreExerciceView,
    en comparant reponse_texte à la solution de référence (question.explication).
    """
    question_id = serializers.IntegerField()
    reponse_texte = serializers.CharField(allow_blank=True, trim_whitespace=False)
    temps_reponse_secondes = serializers.IntegerField(required=False)


class QuizSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizSession
        fields = ["id", "mode", "nombre_questions", "score", "duree_secondes",
                  "date_debut", "date_fin", "termine"]


class QuizResultSerializer(serializers.ModelSerializer):
    reponses_detail = serializers.SerializerMethodField()

    class Meta:
        model = QuizSession
        fields = ["id", "score", "duree_secondes", "nombre_questions", "reponses_detail"]

    def get_reponses_detail(self, obj):
        return [
            {
                "question": r.question.enonce,
                "correcte": r.est_correcte,
                "explication": r.question.explication,
                "reponse_texte": r.reponse_texte,
                "feedback_ia": r.feedback_ia,
            }
            for r in obj.reponses.select_related("question")
        ]


# ─────────────────────────────────────────
# Contributions
# ─────────────────────────────────────────

class ContributionSerializer(serializers.ModelSerializer):
    question_enonce = serializers.CharField(source="question.enonce", read_only=True)
    statut_question = serializers.CharField(source="question.statut", read_only=True)

    class Meta:
        model = Contribution
        fields = ["id", "question", "question_enonce", "statut_question",
                  "date_soumission", "date_traitement"]