from django.urls import path
from . import views
from .views_admin import (
    AdminStatsView, PingView, HorsLigneView,
    DeconnecterCompteView, SupprimerCompteView,
)
urlpatterns = [
    # Comptes
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("auth/otp/verifier/", views.VerifierOTPView.as_view(), name="otp-verifier"),
    path("auth/otp/renvoyer/", views.RenvoyerOTPView.as_view(), name="otp-renvoyer"),
    path("auth/config/", views.ConfigAuthView.as_view(), name="auth-config"),
    path("auth/google/", views.GoogleLoginView.as_view(), name="auth-google"),
    path("token/refresh/", views.RenouvellementView.as_view(), name="token_refresh"),
    path("me/", views.MeView.as_view(), name="me"),
    path("ecoles/", views.EcoleListView.as_view(), name="ecoles"),
    path("filieres/", views.FiliereListView.as_view(), name="filieres"),

    # Banque de questions
    path("matieres/", views.MatiereListView.as_view(), name="matieres"),
    path("questions/", views.QuestionListView.as_view(), name="questions"),
    path("questions/<int:pk>/", views.QuestionDetailView.as_view(), name="question-detail"),

    # Contributions
    path("questions/soumettre/", views.SoumettreQuestionView.as_view(), name="soumettre-question"),
    path("contributions/mes-contributions/", views.MesContributionsView.as_view(), name="mes-contributions"),

    # Quiz
    path("quiz/demarrer/", views.DemarrerQuizView.as_view(), name="quiz-demarrer"),
    path("quiz/<int:session_id>/repondre/", views.RepondreQuizView.as_view(), name="quiz-repondre"),
    path("quiz/<int:session_id>/repondre-exercice/", views.RepondreExerciceView.as_view(), name="quiz-repondre-exercice"),
    path("quiz/<int:session_id>/terminer/", views.TerminerQuizView.as_view(), name="quiz-terminer"),
    path("quiz/mes-sessions/", views.MesQuizSessionsView.as_view(), name="quiz-sessions"),

    #admin 
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),

    # ... tes autres routes ...
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/utilisateurs/<int:user_id>/deconnecter/", DeconnecterCompteView.as_view(), name="admin-deconnecter"),
    path("admin/utilisateurs/<int:user_id>/", SupprimerCompteView.as_view(), name="admin-supprimer"),
    path("me/ping/", PingView.as_view(), name="ping"),
    path("me/hors-ligne/", HorsLigneView.as_view(), name="hors-ligne"),

    
]