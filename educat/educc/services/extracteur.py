"""
Service d'extraction : lit le contenu texte d'un PDF déjà téléchargé.

Gère uniquement les PDF avec du texte "natif" (tapé, pas scanné) pour l'instant.
Si un PDF scanné donne un texte vide, il faudra ajouter l'OCR (pytesseract)
en complément — pas encore fait ici pour rester simple au démarrage.
"""

import pdfplumber


def extraire_texte(chemin_pdf):
    """
    Ouvre le PDF et extrait le texte de chaque page, page par page.
    Si une page ne contient pas de texte extractible (souvent signe d'un scan),
    elle est simplement ignorée plutôt que de faire planter tout le processus.
    """
    texte = ""
    try:
        with pdfplumber.open(chemin_pdf) as pdf:
            for page in pdf.pages:
                contenu = page.extract_text()
                if contenu:  # certaines pages peuvent ne rien retourner
                    texte += contenu + "\n"
    except Exception as e:
        # On log l'erreur mais on ne fait pas planter tout le pipeline
        # pour UN PDF défaillant — les autres continuent d'être traités.
        print(f"Erreur extraction {chemin_pdf} : {e}")

    return texte.strip()
def decouper_en_blocs(texte, taille_max=2500):
    if not texte:
        return []
    return [texte[i:i + taille_max] for i in range(0, len(texte), taille_max)]