"""
Commande d'import d'exercices en IMAGE, utilisable pour N'IMPORTE QUELLE
matière. Chaque exercice détecté dans les PDF est découpé en image, PUIS
analysé automatiquement par un modèle Groq avec vision (qwen/qwen3.6-27b) :
transcription de l'énoncé + rédaction d'une solution de référence.

Aucun QCM n'est jamais créé par cette commande — le contenu importé ici
est toujours de type "exercice".

Toutes les questions arrivent avec statut="en_attente" : même si l'IA
rédige l'énoncé et la solution automatiquement, une relecture humaine
reste nécessaire avant publication (un modèle vision peut se tromper).

Usage :
    python manage.py importer_exercices_images --dossier ./annales_maths --ecole ESATIC --matiere Mathématiques --filiere 2
"""

import os
import shutil
import time
from django.core.files import File
from django.core.management.base import BaseCommand
from educc.models import Question, Matiere, Ecole
from educc.services.decoupeur_images import decouper_images_exercices
from educc.services.vision_ia import analyser_exercice_image, AnalyseIndisponible

DOSSIER_TEMPORAIRE = "/tmp/exercices_decoupes"
PAUSE_ENTRE_APPELS_VISION = 12  # secondes — marge de sécurité sous le plafond de 1000 tokens de sortie/minute (OTPM)


class Command(BaseCommand):
    help = "Découpe les exercices d'un PDF en images, les analyse par IA vision, et les importe"

    def add_arguments(self, parser):
        parser.add_argument("--dossier", type=str, required=True,
                             help="Dossier contenant les PDF à traiter")
        parser.add_argument("--ecole", type=str, required=True,
                             help="Nom exact de l'école en base (ex: ESATIC)")
        parser.add_argument("--matiere", type=str, required=True,
                             help="Nom de la matière (n'importe laquelle)")
        parser.add_argument("--filiere", type=int, default=None,
                             help="ID de la filière — optionnel")
        parser.add_argument("--sans-vision", action="store_true",
                             help="Désactive l'analyse IA (comportement précédent : énoncé = titre seul)")

    def handle(self, *args, **options):
        dossier = options["dossier"]
        ecole_nom = options["ecole"]
        matiere_nom = options["matiere"]
        filiere_id = options["filiere"]
        utiliser_vision = not options["sans_vision"]

        try:
            ecole = Ecole.objects.get(nom=ecole_nom)
        except Ecole.DoesNotExist:
            self.stderr.write(f"École '{ecole_nom}' introuvable — crée-la d'abord dans l'admin")
            return

        matiere, _ = Matiere.objects.get_or_create(nom=matiere_nom)

        if not os.path.isdir(dossier):
            self.stderr.write(f"Dossier introuvable : {dossier}")
            return

        dossier_traites = os.path.join(dossier, "traites")
        os.makedirs(dossier_traites, exist_ok=True)
        os.makedirs(DOSSIER_TEMPORAIRE, exist_ok=True)

        pdfs = [f for f in os.listdir(dossier)
                if f.lower().endswith(".pdf") and os.path.isfile(os.path.join(dossier, f))]

        if not pdfs:
            self.stdout.write("Aucun nouveau PDF à traiter.")
            return

        self.stdout.write(f"→ {len(pdfs)} PDF trouvé(s) dans {dossier}")

        total_exercices = 0
        total_analyses_reussies = 0
        total_pdfs_traites = 0
        quota_vision_atteint = False

        for nom_fichier in pdfs:
            chemin = os.path.join(dossier, nom_fichier)
            self.stdout.write(f"→ Découpage : {nom_fichier}")

            try:
                exercices = decouper_images_exercices(chemin, DOSSIER_TEMPORAIRE)
            except Exception as e:
                self.stdout.write(f"  ✗ échec du découpage ({e}) — PDF laissé en place")
                continue

            for ex in exercices:
                enonce = ex["titre"] or "Exercice"
                explication = ""
                difficulte = "moyen"

                if utiliser_vision and not quota_vision_atteint:
                    try:
                        analyse = analyser_exercice_image(ex["chemin_image"])
                        enonce = analyse["enonce"] or enonce
                        explication = analyse["explication"]
                        difficulte = analyse["difficulte"]
                        if analyse["confiance"] == "basse":
                            self.stdout.write(
                                f"  ⚠ confiance basse pour '{ex['titre']}' — à vérifier de près"
                            )
                        else:
                            total_analyses_reussies += 1
                        time.sleep(PAUSE_ENTRE_APPELS_VISION)
                    except AnalyseIndisponible as e:
                        erreur_texte = str(e)
                        if "Quota journalier" in erreur_texte:
                            self.stdout.write(self.style.WARNING(
                                f"  ⚠ Quota vision épuisé — les exercices restants seront "
                                f"importés sans analyse (énoncé/solution à rédiger manuellement)."
                            ))
                            quota_vision_atteint = True
                        else:
                            self.stdout.write(f"  ⚠ analyse impossible pour '{ex['titre']}' : {e}")

                question = Question.objects.create(
                    type_question="exercice",
                    enonce=enonce,
                    explication=explication,
                    difficulte=difficulte,
                    matiere=matiere,
                    ecole=ecole,
                    filiere_id=filiere_id,
                    statut="en_attente",
                )
                with open(ex["chemin_image"], "rb") as f:
                    question.image.save(os.path.basename(ex["chemin_image"]), File(f), save=True)

                os.remove(ex["chemin_image"])
                total_exercices += 1

            shutil.move(chemin, os.path.join(dossier_traites, nom_fichier))
            self.stdout.write(f"  ✓ {len(exercices)} exercice(s) importé(s), PDF déplacé vers traites/")
            total_pdfs_traites += 1

        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {total_pdfs_traites} PDF traités, {total_exercices} exercices importés "
            f"({total_analyses_reussies} analysés automatiquement avec confiance haute), "
            f"statut: en_attente, matière: {matiere_nom}"
        ))