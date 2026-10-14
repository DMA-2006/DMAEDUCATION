"""
Commande Django : scrape et importe les annales du cycle INGÉNIEUR de l'ESATIC.

Elle réutilise les mêmes fonctions que importer_annales.py (scraper, extracteur,
structureur, importeur), mais avec deux différences :
  - l'URL de départ est donnée en argument (--url), car la page du cycle
    ingénieur n'est pas dans scraper.URLS_SOURCES ;
  - les questions sont rattachées à une filière de niveau "ingénieur" (--filiere).

L'historique des PDF déjà traités utilise sa propre étiquette
("esatic_ingenieur") : il n'interfère donc pas avec l'historique de la
commande importer_annales --source esatic.

Usage :
    python manage.py importer_esatic_ingenieur --url <URL_PAGE_INGENIEUR> --filiere <ID>
    python manage.py importer_esatic_ingenieur --url <URL_PAGE_INGENIEUR> --filiere 5 --limite 2   (test)
"""

import os
import time

from django.core.management.base import BaseCommand

from educc.models import Filiere, PdfTraite
from educc.services import extracteur, importeur, scraper, structureur
from educc.services.structureur import QuotaJournalierEpuise

SOURCE = "esatic_ingenieur"   # étiquette utilisée dans PdfTraite.source
ECOLE_NOM = "ESATIC"          # nom exact de l'école en base


class Command(BaseCommand):
    help = "Scrape, extrait, structure via LLM et importe les annales ESATIC (cycle ingénieur)"

    def add_arguments(self, parser):
        parser.add_argument("--url", type=str, required=True,
                            help="URL de la page (ou de la page mère) des annales ESATIC ingénieur")
        parser.add_argument("--filiere", type=int, required=True,
                            help="ID d'une filière de niveau 'ingénieur' (voir /admin/educc/filiere/)")
        parser.add_argument("--limite", type=int, default=None,
                            help="limiter le nombre de PDF traités (pour tester)")

    def handle(self, *args, **options):
        url_depart = options["url"]
        filiere_id = options["filiere"]
        limite = options["limite"]

        # Vérifie que la filière existe et qu'elle est bien de niveau ingénieur,
        # pour éviter de mélanger ces questions avec un autre cycle par erreur.
        try:
            filiere = Filiere.objects.get(id=filiere_id)
        except Filiere.DoesNotExist:
            self.stderr.write(f"Filière {filiere_id} introuvable. Vérifie l'ID dans l'admin.")
            return
        if filiere.niveau != "ingenieur":
            self.stderr.write(
                f"La filière {filiere_id} ({filiere.nom}) est de niveau '{filiere.niveau}', "
                f"pas 'ingenieur'. Choisis une filière du cycle ingénieur."
            )
            return

        self.stdout.write(f"Recherche des sous-pages depuis {url_depart}...")
        try:
            sous_pages = scraper.trouver_sous_pages(url_depart)
        except Exception as e:
            self.stderr.write(f"Erreur en lisant {url_depart} : {e}")
            return

        # Si la page donnée ne contient pas de sous-pages, on la traite elle-même
        # comme une page qui liste directement des PDF.
        if not sous_pages:
            self.stdout.write("→ aucune sous-page trouvée, la page donnée est traitée directement")
            sous_pages = [url_depart]
        else:
            self.stdout.write(f"→ {len(sous_pages)} sous-page(s) trouvée(s)")

        urls_deja_traitees = set(
            PdfTraite.objects.filter(source=SOURCE).values_list("url", flat=True)
        )
        self.stdout.write(f"→ {len(urls_deja_traitees)} PDF déjà traité(s) précédemment (ignorés)")

        total_importees = 0
        total_pdfs_traites = 0
        total_pdfs_ignores = 0
        quota_atteint = False

        for page in sous_pages:
            if quota_atteint:
                break

            try:
                pdfs = scraper.trouver_pdfs(page)
            except Exception as e:
                self.stderr.write(f"Erreur sur {page} : {e}")
                continue

            for nom, url in pdfs:
                if limite and total_pdfs_traites >= limite:
                    break

                if url in urls_deja_traitees:
                    total_pdfs_ignores += 1
                    continue

                self.stdout.write(f"→ Traitement : {nom}")

                chemin = scraper.telecharger_pdf_temporaire(url)
                if not chemin:
                    self.stdout.write("  ✗ échec du téléchargement")
                    continue

                texte = extracteur.extraire_texte(chemin)
                os.remove(chemin)

                if not texte:
                    self.stdout.write("  ⚠ aucun texte extrait (PDF scanné ?)")
                    continue

                blocs = extracteur.decouper_en_blocs(texte)
                echec_quota = False

                try:
                    for bloc in blocs:
                        questions = structureur.structurer_texte(bloc, nom_source=nom)
                        nb = importeur.importer_questions(
                            questions, ECOLE_NOM, filiere_id=filiere_id
                        )
                        total_importees += nb
                except QuotaJournalierEpuise as e:
                    self.stdout.write(self.style.ERROR(str(e)))
                    quota_atteint = True
                    echec_quota = True

                if echec_quota:
                    # Traitement incomplet : on ne marque PAS ce PDF comme traité,
                    # pour qu'il soit retraité en entier au prochain lancement.
                    self.stdout.write(f"  ⚠ {nom} non marqué comme traité (interruption en cours)")
                    break

                PdfTraite.objects.create(url=url, source=SOURCE, nom_fichier=nom)
                total_pdfs_traites += 1
                time.sleep(6)

        if quota_atteint:
            self.stdout.write(self.style.WARNING(
                f"Arrêt anticipé — quota journalier Groq atteint. "
                f"{total_pdfs_traites} PDF traités, {total_pdfs_ignores} ignorés (déjà faits), "
                f"{total_importees} questions importées avant l'arrêt. "
                f"Relance la même commande demain : seuls les PDF restants seront traités."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Terminé : {total_pdfs_traites} PDF traités, {total_pdfs_ignores} ignorés (déjà faits), "
                f"{total_importees} questions importées"
            ))