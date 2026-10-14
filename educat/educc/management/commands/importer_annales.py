"""
Commande Django qui orchestre le pipeline QCM, du début à la fin :
scraper -> extracteur -> structureur (LLM, QCM uniquement) -> importeur.

Les PDF déjà traités avec succès (voir modèle PdfTraite) sont automatiquement
ignorés lors des prochaines exécutions, pour éviter les doublons en base
après un arrêt sur quota journalier par exemple.

Usage :
    python manage.py importer_annales --source esatic
    python manage.py importer_annales --source esatic --limite 2   (pour tester)
    python manage.py importer_annales --source esatic --filiere 3  (rattache à une filière précise)
"""

import os
import time
from django.core.management.base import BaseCommand
from educc.services import scraper, extracteur, structureur, importeur
from educc.services.structureur import QuotaJournalierEpuise
from educc.models import PdfTraite


class Command(BaseCommand):
    help = "Scrape, extrait, structure via LLM (QCM) et importe les annales automatiquement"

    def add_arguments(self, parser):
        parser.add_argument("--source", type=str, required=True, help="inphb ou esatic")
        parser.add_argument("--limite", type=int, default=None,
                             help="limiter le nombre de PDF traités (pour tester)")
        parser.add_argument("--filiere", type=int, default=None,
                             help="ID de la filière à laquelle rattacher les questions importées")

    def handle(self, *args, **options):
        source = options["source"]
        limite = options["limite"]
        filiere_id = options["filiere"]

        if source not in scraper.URLS_SOURCES:
            self.stderr.write(f"Source inconnue : {source}")
            return

        page_mere = scraper.URLS_SOURCES[source]
        self.stdout.write(f"Recherche des sous-pages pour {source}...")

        sous_pages = scraper.trouver_sous_pages(page_mere)
        self.stdout.write(f"→ {len(sous_pages)} sous-page(s) trouvée(s)")

        urls_deja_traitees = set(
            PdfTraite.objects.filter(source=source).values_list("url", flat=True)
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
                    # Peut arriver soit parce que déjà traité lors d'une
                    # exécution précédente, soit parce que ce même PDF est
                    # référencé depuis PLUSIEURS sous-pages du site source
                    # (donc déjà traité un peu plus tôt dans CETTE exécution).
                    total_pdfs_ignores += 1
                    continue

                self.stdout.write(f"→ Traitement : {nom}")

                chemin = scraper.telecharger_pdf_temporaire(url)
                if not chemin:
                    self.stdout.write(f"  ✗ échec du téléchargement")
                    continue

                texte = extracteur.extraire_texte(chemin)
                os.remove(chemin)

                if not texte:
                    self.stdout.write(f"  ⚠ aucun texte extrait (PDF scanné ?)")
                    continue

                blocs = extracteur.decouper_en_blocs(texte)
                echec_quota = False

                try:
                    for bloc in blocs:
                        questions = structureur.structurer_texte(bloc, nom_source=nom)
                        nb = importeur.importer_questions(
                            questions, source.upper(), filiere_id=filiere_id
                        )
                        total_importees += nb
                except QuotaJournalierEpuise as e:
                    self.stdout.write(self.style.ERROR(str(e)))
                    quota_atteint = True
                    echec_quota = True

                if echec_quota:
                    self.stdout.write(f"  ⚠ {nom} non marqué comme traité (interruption en cours)")
                    break

                PdfTraite.objects.get_or_create(
                    url=url,
                    defaults={"source": source, "nom_fichier": nom},
                )
                # Mise à jour immédiate du set en mémoire : empêche un retraitement
                # si ce même lien apparaît encore sur une autre sous-page plus loin
                # dans cette même exécution.
                urls_deja_traitees.add(url)

                total_pdfs_traites += 1
                time.sleep(6)

        if quota_atteint:
            self.stdout.write(self.style.WARNING(
                f"Arrêt anticipé — quota journalier Groq atteint. "
                f"{total_pdfs_traites} PDF traités, {total_pdfs_ignores} ignorés (déjà faits), "
                f"{total_importees} QCM importés avant l'arrêt (statut: en_attente). "
                f"Relance la même commande demain : seuls les PDF restants seront traités."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Terminé : {total_pdfs_traites} PDF traités, {total_pdfs_ignores} ignorés (déjà faits), "
                f"{total_importees} QCM importés (statut: en_attente)"
            ))