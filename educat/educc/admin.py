from django.contrib import admin
from .models import (
    Ecole, Filiere, User, Matiere, Question, Choix,
    QuizSession, QuizAnswer, Contribution,PdfTraite
)
# Register your models here.
@admin.register(Ecole)
class EcoleAdmin(admin.ModelAdmin):
    list_display = ["nom", "slug"]
    prepopulated_fields = {"slug": ("nom",)}


@admin.register(Filiere)
class FiliereAdmin(admin.ModelAdmin):
    list_display = ["nom", "ecole"]
    list_filter = ["ecole"]


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["username", "email", "ecole_ciblee", "filiere_ciblee", "role", "is_staff"]
    list_filter = ["role", "ecole_ciblee"]
    search_fields = ["username", "email"]


@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    list_display = ["nom", "icone"]


class ChoixInline(admin.TabularInline):
    model = Choix
    extra = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["enonce_court", "type_question", "matiere", "branche", "ecole", "difficulte", "statut", "date_creation"]
    list_filter = ["type_question", "statut", "ecole", "matiere", "branche", "difficulte"]
    list_editable = ["branche"]
    search_fields = ["enonce"]
    inlines = [ChoixInline]
    actions = ["valider_questions", "rejeter_questions"]

    def enonce_court(self, obj):
        return obj.enonce[:80]
    enonce_court.short_description = "Énoncé"

    @admin.action(description="✅ Valider les questions sélectionnées")
    def valider_questions(self, request, queryset):
        maj = queryset.update(statut="validee")
        self.message_user(request, f"{maj} question(s) validée(s).")

    @admin.action(description="❌ Rejeter les questions sélectionnées")
    def rejeter_questions(self, request, queryset):
        maj = queryset.update(statut="rejetee")
        self.message_user(request, f"{maj} question(s) rejetée(s).")


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ["utilisateur", "mode", "nombre_questions", "score", "termine", "date_debut"]
    list_filter = ["mode", "termine", "ecole"]


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ["session", "question", "est_correcte"]
    list_filter = ["est_correcte"]


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ["contributeur", "question", "date_soumission", "traite_par"]
    list_filter = ["date_soumission"]



@admin.register(PdfTraite)
class PdfTraiteAdmin(admin.ModelAdmin):
    list_display = ["nom_fichier", "source", "date_traitement"]
    list_filter = ["source"]
    search_fields = ["url", "nom_fichier"]