"""
Commande pour traiter MANUELLEMENT des PDF de QCM déposés dans un dossier
local (pas de scraping). Les PDF traités avec succès sont déplacés dans
un sous-dossier "traites/" pour éviter les doublons en cas de relance.

Usage :
    python manage.py importer_pdf_local --dossier ./annales_esatic --ecole ESATIC --filiere 3
"""

import os
import shutil
import time
from django.core.management.base import BaseCommand
from educc.services import extracteur, structureur, importeur
from educc.services.structureur import QuotaJournalierEpuise


class Command(BaseCommand):
    help = "Traite des PDF de QCM déposés manuellement dans un dossier local"

    def add_arguments(self, parser):
        parser.add_argument("--dossier", type=str, required=True)
        parser.add_argument("--ecole", type=str, required=True)
        parser.add_argument("--filiere", type=int, required=True)

    def handle(self, *args, **options):
        dossier = options["dossier"]
        ecole_nom = options["ecole"]
        filiere_id = options["filiere"]

        if not os.path.isdir(dossier):
            self.stderr.write(f"Dossier introuvable : {dossier}")
            return

        dossier_traites = os.path.join(dossier, "traites")
        os.makedirs(dossier_traites, exist_ok=True)

        pdfs = [f for f in os.listdir(dossier)
                if f.lower().endswith(".pdf") and os.path.isfile(os.path.join(dossier, f))]

        if not pdfs:
            self.stdout.write("Aucun nouveau PDF à traiter.")
            return

        self.stdout.write(f"→ {len(pdfs)} nouveau(x) PDF trouvé(s) dans {dossier}")

        total_importees = 0
        total_pdfs_traites = 0
        quota_atteint = False

        for nom_fichier in pdfs:
            if quota_atteint:
                break

            chemin = os.path.join(dossier, nom_fichier)
            self.stdout.write(f"→ Traitement : {nom_fichier}")

            texte = extracteur.extraire_texte(chemin)
            if not texte:
                self.stdout.write(f"  ⚠ aucun texte extrait — laissé en place")
                continue

            blocs = extracteur.decouper_en_blocs(texte)
            echec_quota = False

            try:
                for bloc in blocs:
                    questions = structureur.structurer_texte(bloc, nom_source=nom_fichier)
                    nb = importeur.importer_questions(questions, ecole_nom, filiere_id=filiere_id)
                    total_importees += nb
                    time.sleep(6)
            except QuotaJournalierEpuise as e:
                self.stdout.write(self.style.ERROR(str(e)))
                quota_atteint = True
                echec_quota = True

            if echec_quota:
                self.stdout.write(f"  ⚠ {nom_fichier} laissé en place (traitement incomplet)")
                break

            shutil.move(chemin, os.path.join(dossier_traites, nom_fichier))
            total_pdfs_traites += 1

        if quota_atteint:
            self.stdout.write(self.style.WARNING(
                f"Arrêt anticipé — quota atteint. {total_pdfs_traites} PDF traités, "
                f"{total_importees} QCM importés."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Terminé : {total_pdfs_traites} PDF traités, {total_importees} QCM importés."
            ))