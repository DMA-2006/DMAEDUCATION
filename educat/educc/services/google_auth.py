"""
Connexion avec Google.

Le front affiche le bouton « Se connecter avec Google » ; Google lui remet un jeton
d'identité (ID token) signé, qu'il nous envoie. Ici on vérifie ce jeton, puis on
retrouve (ou on crée) le compte correspondant.
"""
import http.client
import json
import re
import socket
import ssl
from urllib.parse import urlsplit

import jwt
from django.conf import settings
from django.db.models import F

from ..models import User

URL_CLES_GOOGLE = "https://www.googleapis.com/oauth2/v3/certs"
EMETTEURS_GOOGLE = ["https://accounts.google.com", "accounts.google.com"]

DELAI_GOOGLE_S = 6


class _ConnexionIPv4(http.client.HTTPSConnection):
    """Connexion HTTPS qui n'utilise que les adresses IPv4 du serveur."""

    def connect(self):
        adresses = socket.getaddrinfo(self.host, self.port, socket.AF_INET, socket.SOCK_STREAM)
        brut = socket.create_connection(adresses[0][4], self.timeout)
        self.sock = self._context.wrap_socket(brut, server_hostname=self.host)


def _telecharger(url, ipv4):
    morceaux = urlsplit(url)
    classe = _ConnexionIPv4 if ipv4 else http.client.HTTPSConnection
    connexion = classe(morceaux.hostname, 443, timeout=DELAI_GOOGLE_S, context=ssl.create_default_context())
    try:
        connexion.request("GET", morceaux.path, headers={"User-Agent": "educat"})
        reponse = connexion.getresponse()
        if reponse.status != 200:
            raise OSError(f"réponse HTTP {reponse.status}")
        return json.load(reponse)
    finally:
        connexion.close()


class _ClesGoogle(jwt.PyJWKClient):
    """
    Télécharge les clés publiques de Google en IPv4 d'abord.
    Python essaie normalement l'IPv6 en premier ; sur un réseau où l'IPv6 est annoncé
    mais ne marche pas (cas fréquent), il attend l'échec de chaque adresse avant de
    passer à l'IPv4 : la connexion Google restait bloquée plus d'une minute.
    """

    def fetch_data(self):
        try:
            try:
                cles = _telecharger(self.uri, ipv4=True)
            except OSError:
                cles = _telecharger(self.uri, ipv4=False)  # serveur sans IPv4
        except (OSError, ValueError) as e:
            raise jwt.PyJWKClientConnectionError(f"Clés Google injoignables : {e}") from e

        if self.jwk_set_cache is not None:
            self.jwk_set_cache.put(cles)
        return cles


# Les clés publiques de Google sont gardées en mémoire 1 h : on ne les
# retélécharge pas à chaque connexion.
_cles_google = _ClesGoogle(URL_CLES_GOOGLE, cache_keys=True, lifespan=3600)


class JetonGoogleInvalide(Exception):
    """Le jeton n'est pas un jeton Google valide destiné à notre application."""


def verifier_jeton_google(jeton):
    """Vérifie la signature, l'émetteur, le destinataire et l'expiration du jeton."""
    try:
        cle = _cles_google.get_signing_key_from_jwt(jeton)
        infos = jwt.decode(
            jeton,
            cle.key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            issuer=EMETTEURS_GOOGLE,
            leeway=30,  # tolère une horloge légèrement décalée
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.PyJWKClientConnectionError:
        raise  # Google injoignable : ce n'est pas la faute du jeton
    except jwt.PyJWTError as e:
        raise JetonGoogleInvalide(str(e)) from e

    if not infos.get("email") or infos.get("email_verified") not in (True, "true"):
        raise JetonGoogleInvalide("Adresse e-mail Google absente ou non vérifiée.")
    return infos


def _nom_utilisateur_libre(email):
    """Nom d'utilisateur tiré de l'adresse e-mail, rendu unique si déjà pris."""
    base = re.sub(r"[^\w.@+-]", "", email.split("@")[0])[:140] or "utilisateur"
    nom, n = base, 1
    while User.objects.filter(username__iexact=nom).exists():
        n += 1
        nom = f"{base}{n}"
    return nom


def utilisateur_depuis_google(infos):
    """
    Renvoie le compte lié à ce compte Google :
    1. celui déjà rattaché à cet identifiant Google ;
    2. sinon un compte existant avec la même adresse e-mail VÉRIFIÉE (créé avec un
       mot de passe), qu'on rattache — s'il y en a plusieurs : l'administrateur
       d'abord, puis le dernier à s'être connecté. Un compte dont l'adresse n'a
       jamais été prouvée n'est pas rattaché : n'importe qui a pu le créer ;
    3. sinon un nouveau compte.
    """
    sub, email = infos["sub"], infos["email"]

    user = User.objects.filter(google_sub=sub).first()
    if user:
        return user

    user = (
        User.objects.filter(email__iexact=email, email_verifie=True, google_sub__isnull=True)
        .order_by("-is_superuser", F("last_login").desc(nulls_last=True), "-date_joined")
        .first()
    )
    if user:
        user.google_sub = sub
        user.save(update_fields=["google_sub"])
        return user

    user = User(
        username=_nom_utilisateur_libre(email),
        email=email,
        first_name=infos.get("given_name", "")[:150],
        last_name=infos.get("family_name", "")[:150],
        google_sub=sub,
        email_verifie=True,  # Google garantit l'adresse
    )
    user.set_unusable_password()  # compte créé par Google : pas de mot de passe
    user.save()
    return user
