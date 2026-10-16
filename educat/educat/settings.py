from pathlib import Path
from datetime import timedelta
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1").split(",")

AUTH_USER_MODEL = "educc.User"

# Connexion avec Google : identifiant client OAuth créé dans Google Cloud Console
# (APIs et services > Identifiants). À renseigner dans le fichier .env.
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID", default="").strip()

# Codes OTP envoyés par e-mail (inscription + connexion), depuis un compte Gmail.
# Dans le .env : EMAIL_HOST_USER = l'adresse Gmail, EMAIL_HOST_PASSWORD = un « mot de
# passe d'application » (compte Google > Sécurité > Validation en deux étapes).
# Tant que ces deux lignes sont vides, aucun e-mail ne part : le code s'affiche dans
# le terminal de Django, ce qui suffit pour tester.
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="").strip()
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="").replace(" ", "")
if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "educc.services.otp.EmailBackendIPv4"
    EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
    EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
    EMAIL_USE_TLS = True
    EMAIL_TIMEOUT = 15
    DEFAULT_FROM_EMAIL = f"DMAEDUCATION <{EMAIL_HOST_USER}>"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
# Vrai = l'e-mail est envoyé avant de répondre (utilisé par les tests) ;
# faux = envoi en arrière-plan, la page n'attend pas.
OTP_ENVOI_SYNCHRONE = False

# Hachage des mots de passe : Argon2 en premier (≈ 0,2 s, voir educc/hashers.py), car
# le PBKDF2 par défaut de Django (1 000 000 d'itérations) prenait ≈ 6 s à chaque
# inscription/connexion.
# PBKDF2 reste dans la liste pour que les comptes déjà créés puissent se connecter :
# leur mot de passe est converti en Argon2 automatiquement à la première connexion.
PASSWORD_HASHERS = [
    "educc.hashers.Argon2Rapide",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",# Django REST Framework : pour construire l'API
    "rest_framework_simplejwt", # authentification par token JWT
    "django_filters", # permet de filtrer les résultats d'API (ex: ?matiere=maths)
    "corsheaders",  # autorise ton front React à appeler cette API

    "educc",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "educat.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "educat.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="127.0.0.1"),
        "PORT": config("DB_PORT", default="5432"),
        # Réserve de connexions gardées ouvertes et partagées entre les requêtes.
        # Sans elle, CHAQUE requête ouvrait une nouvelle connexion à PostgreSQL
        # (0,3 à 0,6 s perdues à chaque appel de l'API).
        "OPTIONS": {"pool": {"min_size": 2, "max_size": 10, "timeout": 10}},
    }
}
# En ligne, l'hébergeur fournit UNE adresse (DATABASE_URL). Si elle existe, elle
# remplace la base locale ci-dessus ; sinon on garde la base de ton ordinateur.
DATABASE_URL = config("DATABASE_URL", default="")
if DATABASE_URL:
    DATABASES["default"] = dj_database_url.parse(DATABASE_URL, ssl_require=True)
    DATABASES["default"].setdefault("OPTIONS", {})["pool"] = {
        "min_size": 1, "max_size": 5, "timeout": 10,
    }
    # Neon s'endort après 5 min : Django vérifie qu'une connexion est vivante
    # avant de s'en servir, au lieu de planter sur une connexion morte.
    DATABASES["default"]["CONN_HEALTH_CHECKS"] = True


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # JWT de SimpleJWT + refus des sessions fermées par un administrateur
        "educc.authentification.AuthentificationJWT",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

CORS_ALLOW_ALL_ORIGINS = DEBUG

# Adresse exacte du site React (Cloudflare), sans "/" final.
SITE_URL = config("SITE_URL", default="").strip().rstrip("/")
CORS_ALLOWED_ORIGINS = [SITE_URL] if SITE_URL else []

# Render termine le HTTPS avant Django : sans cette ligne, Django croit être en
# http et refuse la connexion à /admin/ (erreur CSRF 403).
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") 

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"