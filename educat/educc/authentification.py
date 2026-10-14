"""
Jetons JWT révocables : l'administrateur peut déconnecter un compte depuis le dashboard.

Un jeton JWT reste normalement valable jusqu'à son expiration, quoi qu'il arrive.
Pour pouvoir « déconnecter » quelqu'un, chaque compte porte une date
(`sessions_invalides_avant`) : tout jeton issu d'une connexion antérieure à cette date
est refusé, que ce soit pour appeler l'API ou pour se renouveler.
"""
# Ce module est chargé par Django REST Framework à son démarrage (réglage
# DEFAULT_AUTHENTICATION_CLASSES) : il ne doit importer aucune vue, sous peine
# d'import circulaire. Le renouvellement des jetons est donc dans views.py.
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


def session_revoquee(user, jeton):
    """Vrai si ce jeton vient d'une connexion que l'administrateur a fermée."""
    limite = user.sessions_invalides_avant
    # "iat" = date de la connexion (le jeton d'accès hérite de celle du jeton de
    # renouvellement, donc elle ne bouge pas tant qu'on ne se reconnecte pas).
    return limite is not None and jeton.get("iat", 0) <= int(limite.timestamp())


class AuthentificationJWT(JWTAuthentication):
    """Authentification par défaut de l'API (voir REST_FRAMEWORK dans settings.py)."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if session_revoquee(user, validated_token):
            raise AuthenticationFailed("Session fermée par un administrateur.", code="session_revoquee")
        return user
