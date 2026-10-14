"""
Commande qui analyse, via IA vision, des exercices DÉJÀ EN BASE (images déjà
découpées et éventuellement recadrées manuellement) — remplit ou complète
enonce/explication/difficulte à partir de l'image, sans repasser par le
découpage PDF.

Utile après un recadrage manuel des images, ou pour relancer l'analyse
sur des exercices dont enonce/explication sont restés vides suite à un
échec précédent (quota, bug de configuration...).

Usage :
    python manage.py analyser_exercices_images
    python manage.py analyser_exercices_images --matiere Mathématiques
    python manage.py analyser_exercices_images --tout   (réanalyse même ceux déjà remplis)
"""

import time
from django.core.management.base import BaseCommand
from educc.models import Question
from educc.services.vision_ia import analyser_exercice_image, AnalyseIndisponible

PAUSE_ENTRE_APPELS = 12  # secondes — marge de sécurité sous le plafond de 1000 tokens de sortie/minute (OTPM)


class Command(BaseCommand):
    help = "Analyse par IA vision les exercices déjà en base (remplit énoncé/solution depuis l'image)"

    def add_arguments(self, parser):
        parser.add_argument("--matiere", type=str, default=None,
                             help="Ne traiter qu'une matière précise (nom exact)")
        parser.add_argument("--ecole", type=str, default=None,
                             help="Ne traiter qu'une école précise (nom exact)")
        parser.add_argument("--tout", action="store_true",
                             help="Réanalyse même les exercices qui ont déjà une explication remplie")
        parser.add_argument("--limite", type=int, default=None,
                             help="Limiter le nombre d'exercices traités (pour tester)")

    def handle(self, *args, **options):
        qs = Question.objects.filter(type_question="exercice").exclude(image="")

        if options["matiere"]:
            qs = qs.filter(matiere__nom=options["matiere"])
        if options["ecole"]:
            qs = qs.filter(ecole__nom=options["ecole"])
        if not options["tout"]:
            # Par défaut, on ne retraite pas ce qui a déjà une solution rédigée
            qs = qs.filter(explication="")
        if options["limite"]:
            qs = qs[: options["limite"]]

        total = qs.count()
        if total == 0:
            self.stdout.write("Aucun exercice à analyser avec ces critères.")
            return

        self.stdout.write(f"→ {total} exercice(s) à analyser")

        total_reussis = 0
        total_confiance_basse = 0
        total_echecs = 0

        for question in qs:
            if not question.image or not question.image.path:
                continue

            self.stdout.write(f"→ Question #{question.id} ({question.enonce[:50]})")

            try:
                analyse = analyser_exercice_image(question.image.path)
            except AnalyseIndisponible as e:
                erreur_texte = str(e)
                if "Quota journalier" in erreur_texte:
                    self.stdout.write(self.style.WARNING(
                        "  ⚠ Quota journalier atteint — arrêt de la commande. "
                        "Relance-la demain pour continuer sur les exercices restants."
                    ))
                    break
                self.stdout.write(f"  ✗ échec : {e}")
                total_echecs += 1
                continue

            question.enonce = analyse["enonce"] or question.enonce
            question.explication = analyse["explication"]
            question.difficulte = analyse["difficulte"] or question.difficulte
            if analyse.get("matiere"):
                # On ne change PAS la matière automatiquement (déjà fixée à
                # l'import), on log juste si l'IA suggère autre chose, au cas
                # où ça révèle une erreur de classement à vérifier.
                if analyse["matiere"] != question.matiere.nom:
                    self.stdout.write(
                        f"  ℹ matière suggérée par l'IA : {analyse['matiere']} "
                        f"(actuelle : {question.matiere.nom}) — non modifiée automatiquement"
                    )
            question.save()

            if analyse["confiance"] == "basse":
                self.stdout.write(f"  ⚠ confiance basse — à vérifier de près")
                total_confiance_basse += 1
            else:
                self.stdout.write(f"  ✓ analysé avec confiance haute")
                total_reussis += 1

            time.sleep(PAUSE_ENTRE_APPELS)

        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {total_reussis} analysé(s) avec confiance haute, "
            f"{total_confiance_basse} avec confiance basse (à vérifier), "
            f"{total_echecs} échec(s)."
        ))