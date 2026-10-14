"""
Range les questions d'Informatique dans leur branche (« Développement d'application
web », « Réseau informatique » ou « Systèmes d'exploitation et architecture ») d'après
les mots de l'énoncé et des réponses.

    python manage.py classer_informatique            # classe les questions sans branche
    python manage.py classer_informatique --apercu   # montre le résultat sans rien modifier
    python manage.py classer_informatique --tout     # reclasse aussi celles déjà rangées

À relancer après un import de nouvelles questions. Une question qui ne correspond à
aucune branche reste sans branche : elle
n'apparaît que dans le quiz « Mixte ». Une branche se corrige à la main dans
l'administration Django (/admin/, Questions, champ « Branche »).
"""
import re

from django.core.management.base import BaseCommand

from educc.models import Question

MOTS_RESEAU = [
    "réseau", "reseau", "osi", "protocole", "trame", "datagramme", "commutation", "hdlc",
    "ethernet", "tcp", "udp", "adresse ip", "routeur", "routage", "wifi", "wi-fi", "dns", "dhcp",
    "fréquence", "frequence", "signal", "bande passante", "débit", "debit", "mbit", "kbit",
    "satellite", "téléphonie", "telephonie", "longueur d'onde", "isochrone", "uhf", "qcif",
    "quantification", "modulation", "fibre optique",
]
MOTS_DEV = [
    "java", "javascript", "python", "php", "html", "css", "sql", "mot clef", "mot clé",
    r"mot\(s\) clef", "tableau", "tableaux", "déclarer", "declarer", "variable", "boucle",
    "algorithme", "base de données", "base de donnees", "system.out", "compilateur",
    "programmation", "programme suivant", "code suivant",
]
MOTS_SYSTEME = [
    "système d'exploitation", "système d’exploitation", "système", "systèmes", "unix", "linux",
    "dos", "windows", "android", "processus", "tâche", "multitâche", "monotâche", "processeur",
    "mémoire", "fichier", "fichiers", "permissions", "distribution", "distributions",
    "ordinateur", "ordinateurs", "raid", "risc", "cisc", "noyau", "disque dur",
]


def _motif(mots):
    # Mots entiers uniquement : « osi » ne doit pas être trouvé dans « composition »
    return re.compile(r"(?<!\w)(?:" + "|".join(m if "\\" in m else re.escape(m) for m in mots) + r")(?!\w)", re.I)


MOTIFS = {
    "dev": _motif(MOTS_DEV),
    "reseau": _motif(MOTS_RESEAU),
    "systeme": _motif(MOTS_SYSTEME),
}


def branche_de(question):
    """Renvoie le code de la branche de cette question, ou "" si aucune ne ressort."""
    texte = " ".join([question.enonce, *(c.texte for c in question.choix.all())])
    # L'énoncé pèse plus lourd que les réponses proposées
    scores = {
        code: len(motif.findall(texte)) + 2 * len(motif.findall(question.enonce))
        for code, motif in MOTIFS.items()
    }
    meilleur = max(scores.values())
    gagnantes = [code for code, score in scores.items() if score == meilleur]
    # Aucun mot reconnu, ou égalité entre deux branches : on ne tranche pas
    return gagnantes[0] if meilleur > 0 and len(gagnantes) == 1 else ""


class Command(BaseCommand):
    help = "Range les questions d'Informatique par branche (développement / réseau / systèmes)."

    def add_arguments(self, parser):
        parser.add_argument("--apercu", action="store_true", help="Affiche sans rien modifier.")
        parser.add_argument("--tout", action="store_true", help="Reclasse aussi les questions déjà rangées.")

    def handle(self, *args, **options):
        questions = Question.objects.filter(matiere__nom="Informatique").prefetch_related("choix")
        if not options["tout"]:
            questions = questions.filter(branche="")

        compte = {"dev": 0, "reseau": 0, "systeme": 0, "": 0}
        for question in questions.order_by("id"):
            branche = branche_de(question)
            compte[branche] += 1
            if options["apercu"]:
                self.stdout.write(f"{branche or '-':7} {question.id} {question.enonce[:70]!a}")
            elif branche != question.branche:
                question.branche = branche
                question.save(update_fields=["branche"])

        self.stdout.write(
            f"Développement : {compte['dev']} | Réseau : {compte['reseau']} | "
            f"Systèmes : {compte['systeme']} | "
            f"Sans branche (Mixte seulement) : {compte['']}"
            + (" — aperçu, rien n'a été modifié" if options["apercu"] else "")
        )
