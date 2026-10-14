"""
Service de scraping : trouve et télécharge automatiquement les PDF d'annales
depuis les sites sources (fomesoutra.com pour l'instant).

Ce module ne fait QUE trouver et télécharger — il ne lit pas le contenu des PDF
(c'est le rôle de extracteur.py) et ne structure rien (structureur.py).
"""

import requests
from bs4 import BeautifulSoup
import os

# On se fait passer pour un navigateur classique, sinon certains sites
# bloquent les requêtes qui ressemblent à un robot.
HEADERS = {"User-Agent": "Mozilla/5.0"}

BASE_FOMESOUTRA = "https://www.fomesoutra.com"

# Dictionnaire centralisant les pages "mères" par source.
# Pour ajouter une nouvelle source plus tard (ex: un site officiel INPHB),
# il suffit d'ajouter une ligne ici — aucun autre fichier à toucher.
URLS_SOURCES = {
    "inphb": "https://www.fomesoutra.com/sujets-de-concours/inphb",
    "esatic": "https://www.fomesoutra.com/sujets-de-concours/esatic",
}


def get_soup(url):
    """
    Télécharge une page web et la transforme en objet BeautifulSoup,
    qui permet de naviguer facilement dans le HTML (chercher des liens, etc.).
    """
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()  # lève une erreur si le site répond mal (404, 500...)
    return BeautifulSoup(r.text, "html.parser")


def trouver_sous_pages(url_categorie):
    """
    Étape 1 du scraping : sur la page "mère" d'une école (ex: .../inphb),
    repère automatiquement tous les liens vers les sous-catégories
    (bachelier, GE2I, ITA, etc.) sans avoir à les connaître à l'avance.
    """
    soup = get_soup(url_categorie)
    liens = set()  # un set évite les doublons automatiquement
    for a in soup.select("a[href]"):  # tous les liens <a href="..."> de la page
        href = a["href"]
        # On ne garde que les liens qui ressemblent à une sous-catégorie de concours
        if "/sujet-concours/" in href or "/sujets-de-concours/" in href:
            # Les liens peuvent être relatifs (/xxx) ou déjà complets (https://...)
            liens.add(href if href.startswith("http") else BASE_FOMESOUTRA + href)
    return liens


def trouver_pdfs(url_page):
    """
    Étape 2 : sur une page de sous-catégorie (ex: .../inphb/ge2i),
    repère tous les liens de téléchargement direct de PDF.
    Sur ce site, ces liens se terminent par "/file".
    """
    soup = get_soup(url_page)
    pdfs = []
    for a in soup.select("a[href]"):
        href = a["href"]
        if href.endswith("/file"):
            # On récupère un titre lisible pour identifier le document plus tard
            titre = a.get("title") or a.get_text(strip=True) or "document"
            titre = titre.replace(".pdf", "").strip()
            url_complete = href if href.startswith("http") else BASE_FOMESOUTRA + href
            pdfs.append((titre, url_complete))
    return pdfs


def telecharger_pdf_temporaire(url, dossier="/tmp/annales"):
    """
    Étape 3 : télécharge UN PDF dans un dossier TEMPORAIRE côté serveur.
    Ce fichier ne reste pas en permanence : une fois le texte extrait,
    la commande d'import le supprime (voir importer_annales.py).

    Retourne le chemin du fichier téléchargé, ou None si l'échec.
    """
    os.makedirs(dossier, exist_ok=True)

    # On construit un nom de fichier "propre" à partir de l'URL,
    # en ne gardant que les caractères alphanumériques (évite les erreurs
    # de système de fichiers avec des caractères spéciaux).
    nom_fichier = "".join(c for c in url.split("/")[-2] if c.isalnum())[:50] or "document"
    chemin = os.path.join(dossier, f"{nom_fichier}.pdf")

    r = requests.get(url, headers=HEADERS, timeout=60)
    content_type = r.headers.get("content-type", "")

    # Vérification de sécurité : on s'assure que c'est bien un PDF
    # avant de l'enregistrer (évite de sauvegarder une page d'erreur HTML par exemple)
    if r.status_code == 200 and "pdf" in content_type.lower():
        with open(chemin, "wb") as f:
            f.write(r.content)
        return chemin

    return None