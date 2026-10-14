from django.contrib.auth.hashers import Argon2PasswordHasher


class Argon2Rapide(Argon2PasswordHasher):
    """
    Argon2id avec les réglages recommandés par l'OWASP (19 Mo de mémoire, 2 passes,
    1 fil). Les réglages par défaut de Django (100 Mo, 8 fils) prenaient 0,5 à 1 s
    par connexion sur une petite machine ; ceux-ci ≈ 0,2 s.
    Les mots de passe déjà enregistrés avec les anciens réglages restent valables :
    ils sont convertis automatiquement à la prochaine connexion.
    """
    time_cost = 2
    memory_cost = 19456
    parallelism = 1
