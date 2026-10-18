"""
Codes OTP : code à 6 chiffres envoyé par e-mail, demandé à l'inscription et à chaque
connexion par mot de passe.

Déroulement :
1. après un mot de passe correct (ou une inscription), `demarrer()` crée un code,
   l'envoie par e-mail et renvoie un « ticket » au front ;
2. le front renvoie ce ticket avec le code saisi : `verifier()` rend le compte ;
3. `renvoyer()` envoie un nouveau code pour le même ticket (au plus un par minute).

Le code n'est jamais enregistré en clair : la base ne garde que son empreinte.
"""
import secrets
import smtplib
import socket
import threading
from datetime import timedelta
from email.utils import parseaddr

import requests

from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as BackendSMTP
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from ..models import CodeOTP

VALIDITE = timedelta(minutes=5)      # durée de vie d'un code
DELAI_RENVOI = timedelta(seconds=60)  # attente minimale entre deux envois
ESSAIS_MAX = 5                        # codes faux tolérés avant de devoir en redemander un
VALIDITE_TICKET_S = 30 * 60
SEL_TICKET = "educc.otp"


class ErreurOTP(Exception):
    """Refus à expliquer à la personne. `attente` : secondes avant de pouvoir renvoyer."""

    def __init__(self, message, attente=None):
        super().__init__(message)
        self.message = message
        self.attente = attente


# ── Envoi de l'e-mail ────────────────────────────────────────────

class _SMTPIPv4(smtplib.SMTP):
    """
    Se connecte au serveur d'envoi en IPv4 d'abord. Python essaie normalement l'IPv6
    en premier ; sur un réseau où l'IPv6 est annoncé mais ne marche pas, l'envoi
    restait bloqué plusieurs minutes (même problème que pour les clés de Google).
    """

    def _get_socket(self, host, port, timeout):
        try:
            adresse = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)[0][4]
            return socket.create_connection(adresse, timeout, self.source_address)
        except OSError:
            return super()._get_socket(host, port, timeout)


class EmailBackendIPv4(BackendSMTP):
    """Backend e-mail de Django (voir EMAIL_BACKEND dans settings.py)."""

    @property
    def connection_class(self):
        return _SMTPIPv4


URL_API_BREVO = "https://api.brevo.com/v3/smtp/email"


class EmailBackendBrevo(BaseEmailBackend):
    """
    Envoi des e-mails par l'API web de Brevo (HTTPS), au lieu du SMTP.
    Indispensable sur l'offre gratuite de Render, qui bloque les ports SMTP
    (25, 465, 587) : Gmail en SMTP n'y part jamais. Activé quand BREVO_API_KEY
    est renseigné (voir settings.py).
    """

    def send_messages(self, messages):
        envoyes = 0
        for message in messages:
            nom, adresse = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
            corps = {
                "sender": {"name": nom or "DMAEDUCATION", "email": adresse},
                "to": [{"email": destinataire} for destinataire in message.to],
                "subject": message.subject,
                "textContent": message.body,
            }
            # Version HTML de l'e-mail, si send_mail en a fourni une
            for contenu, type_mime in getattr(message, "alternatives", []):
                if type_mime == "text/html":
                    corps["htmlContent"] = contenu
            try:
                reponse = requests.post(
                    URL_API_BREVO,
                    json=corps,
                    headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json"},
                    timeout=15,
                )
                if reponse.status_code >= 300:
                    raise OSError(f"Brevo a refusé l'envoi ({reponse.status_code}) : {reponse.text[:300]}")
                envoyes += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return envoyes


def _envoyer(email, code):
    minutes = int(VALIDITE.total_seconds() // 60)
    try:
        send_mail(
            subject=f"{code} est ton code DMAEDUCATION",
            message=(
                f"Ton code de vérification DMAEDUCATION : {code}\n\n"
                f"Il est valable {minutes} minutes. Ne le communique à personne.\n"
                "Si tu n'es pas à l'origine de cette demande, ignore ce message."
            ),
            from_email=None,  # DEFAULT_FROM_EMAIL
            recipient_list=[email],
            html_message=(
                '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#031632">'
                '<h2 style="margin:0 0 8px">DMA<span style="color:#fb691a">EDUCATION</span></h2>'
                "<p>Ton code de vérification :</p>"
                f'<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">{code}</p>'
                f'<p style="color:#555">Il est valable {minutes} minutes. Ne le communique à personne.<br>'
                "Si tu n'es pas à l'origine de cette demande, ignore ce message.</p></div>"
            ),
        )
    except Exception as e:  # l'envoi se fait en arrière-plan : on le signale dans le terminal
        print(f"[OTP] Échec de l'envoi du code à {email} : {e!r}")


def envoyer_code(email, code):
    # En arrière-plan : la page n'attend pas la fin de l'envoi (2 à 4 s avec Gmail).
    if settings.OTP_ENVOI_SYNCHRONE:
        _envoyer(email, code)
    else:
        threading.Thread(target=_envoyer, args=(email, code), daemon=True).start()


# ── Codes ────────────────────────────────────────────────────────

def _empreinte(otp_id, code):
    return salted_hmac(SEL_TICKET, f"{otp_id}:{code}").hexdigest()


def _nouveau_code(otp):
    """Tire un nouveau code pour cette demande, l'enregistre (empreinte) et l'envoie."""
    code = f"{secrets.randbelow(10**6):06d}"
    maintenant = timezone.now()
    otp.code_hache = _empreinte(otp.id, code)
    otp.envoye_le = maintenant
    otp.expire_le = maintenant + VALIDITE
    otp.tentatives = 0
    otp.save()
    envoyer_code(otp.user.email, code)


def masquer_email(email):
    """awa.kone@gmail.com -> aw******@gmail.com"""
    nom, _, domaine = email.partition("@")
    return f"{nom[:2]}{'*' * max(len(nom) - 2, 3)}@{domaine}"


def demarrer(user, objet):
    """Envoie un code à ce compte et renvoie ce que le front doit recevoir."""
    if not user.email:
        raise ErreurOTP("Ce compte n'a pas d'adresse e-mail : impossible d'envoyer le code de vérification.")

    # Une seule demande en cours par compte ; on en profite pour faire le ménage.
    CodeOTP.objects.filter(user=user).delete()
    otp = CodeOTP.objects.create(user=user, objet=objet, expire_le=timezone.now())
    _nouveau_code(otp)

    return {
        "otp_requis": True,
        "ticket": signing.dumps({"otp": otp.id}, salt=SEL_TICKET),
        "email": masquer_email(user.email),
        "renvoi_dans_s": int(DELAI_RENVOI.total_seconds()),
    }


def _demande(ticket):
    try:
        donnees = signing.loads(str(ticket), salt=SEL_TICKET, max_age=VALIDITE_TICKET_S)
        otp = CodeOTP.objects.select_related("user").get(id=donnees["otp"], utilise=False)
    except (signing.BadSignature, CodeOTP.DoesNotExist, KeyError, TypeError):
        raise ErreurOTP("Cette vérification a expiré. Recommence la connexion.")
    return otp


def renvoyer(ticket):
    otp = _demande(ticket)
    attente = (otp.envoye_le + DELAI_RENVOI - timezone.now()).total_seconds()
    if attente > 0:
        raise ErreurOTP(
            f"Patiente encore {int(attente) + 1} s avant de demander un nouveau code.",
            attente=int(attente) + 1,
        )
    _nouveau_code(otp)
    return {"renvoi_dans_s": int(DELAI_RENVOI.total_seconds())}


def verifier(ticket, code):
    """Renvoie le compte si le code est bon ; sinon lève ErreurOTP."""
    otp = _demande(ticket)

    if otp.expire_le < timezone.now():
        raise ErreurOTP("Ce code a expiré. Demande un nouveau code.")
    if otp.tentatives >= ESSAIS_MAX:
        raise ErreurOTP("Trop d'essais. Demande un nouveau code.")

    code = "".join(c for c in str(code) if c.isdigit())
    if not constant_time_compare(otp.code_hache, _empreinte(otp.id, code)):
        otp.tentatives += 1
        otp.save(update_fields=["tentatives"])
        restants = ESSAIS_MAX - otp.tentatives
        if restants <= 0:
            raise ErreurOTP("Code incorrect. Trop d'essais : demande un nouveau code.")
        raise ErreurOTP(f"Code incorrect. Il te reste {restants} essai{'s' if restants > 1 else ''}.")

    otp.utilise = True
    otp.save(update_fields=["utilise"])

    # Le code reçu prouve que l'adresse e-mail appartient bien à cette personne.
    user = otp.user
    if not user.email_verifie:
        user.email_verifie = True
        user.save(update_fields=["email_verifie"])
    return user
