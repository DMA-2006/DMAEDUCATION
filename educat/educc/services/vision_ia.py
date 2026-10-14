"""
Service de lecture automatique d'exercices en image, via un modèle Groq
avec capacité de vision (qwen/qwen3.6-27b). Le modèle regarde l'image
découpée d'un exercice et rédige lui-même :
- une transcription de l'énoncé (utile pour la recherche/filtrage)
- une solution de référence détaillée, étape par étape

Cette solution rédigée par l'IA sert ensuite de base pour corriger
automatiquement les réponses des utilisateurs (via correction_ia.py),
sans que l'admin ait à tout retaper manuellement en regardant l'image.

IMPORTANT : le contenu généré ici reste à VALIDER par un humain avant
publication (statut "en_attente" comme le reste du pipeline) — un modèle
vision peut se tromper sur une formule mal photographiée ou un raisonnement
complexe. Ça reste néanmoins un gros gain de temps par rapport à tout
rédiger à la main.
"""
import base64
import json
from json_repair import repair_json
from decouple import config
from groq import Groq

client = Groq(api_key=config("GROQ_API_KEY"))

MODELE_VISION = "qwen/qwen3.6-27b"


class AnalyseIndisponible(Exception):
    """Levée quand l'analyse automatique de l'image échoue (quota, erreur réseau,
    réponse inexploitable...). L'appelant doit alors laisser les champs vides
    pour rédaction manuelle plutôt que de bloquer l'import."""
    pass


PROMPT_SYSTEME = """Tu es un professeur qui analyse la photo d'un exercice de concours.

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte, sans texte autour,
sans balises markdown :

{
  "enonce": "transcription fidèle et complète de l'énoncé visible sur l'image",
  "explication": "solution détaillée, étape par étape, qui résout correctement l'exercice",
  "matiere": "Mathématiques",
  "difficulte": "moyen",
  "confiance": "haute"
}

Règles :
- "enonce" : recopie fidèlement le texte de l'exercice tel qu'il apparaît sur l'image
  (formules incluses, en notation texte/LaTeX simple si besoin).
- "explication" : résous réellement l'exercice, avec un raisonnement correct et complet,
  pas juste un résumé.
- "matiere" : choisis parmi Mathématiques, Physique, Chimie, Français, Anglais,
  Culture générale, Sciences de la Vie et de la Terre, Informatique.
- "difficulte" : facile, moyen ou difficile.
- "confiance" : "basse" si l'image est floue, mal cadrée, ou si tu n'es pas sûr de ta
  résolution — "haute" sinon."""


def analyser_exercice_image(chemin_image):
    """
    Retourne un dict {"enonce", "explication", "matiere", "difficulte", "confiance"}.
    Lève AnalyseIndisponible en cas d'échec (quota, erreur réseau, réponse
    inexploitable) — à l'appelant de gérer un repli (champs vides, à remplir
    manuellement dans l'admin).
    """
    try:
        with open(chemin_image, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        raise AnalyseIndisponible(f"Impossible de lire l'image : {e}") from e

    try:
        reponse = client.chat.completions.create(
            model=MODELE_VISION,
            messages=[
                {"role": "system", "content": PROMPT_SYSTEME},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyse cet exercice et réponds en JSON."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                        },
                    ],
                },
            ],
            temperature=0.2,
            max_tokens=950,
            # Ton compte Groq plafonne ce modèle à 1000 tokens de SORTIE par
            # minute (OTPM) — on reste prudemment en dessous. C'est serré pour
            # un modèle qui "réfléchit" avant de répondre : sur un exercice
            # complexe, la réflexion peut à elle seule épuiser ce budget,
            # laissant une réponse tronquée (d'où confiance basse en repli).
            reasoning_effort="default",
            reasoning_format="hidden",
        )
    except Exception as e:
        erreur_texte = str(e)
        if "tokens per day" in erreur_texte or "TPD" in erreur_texte:
            raise AnalyseIndisponible(f"Quota journalier Groq atteint : {erreur_texte}") from e
        raise AnalyseIndisponible(f"Erreur API vision : {erreur_texte}") from e

    texte_reponse = reponse.choices[0].message.content.strip()
    texte_reponse = texte_reponse.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    debut = texte_reponse.find("{")
    if debut == -1:
        apercu = texte_reponse[:300] if texte_reponse else "(réponse vide)"
        raise AnalyseIndisponible(f"Réponse du modèle sans JSON exploitable. Aperçu : {apercu!r}")
    texte_reponse = texte_reponse[debut:]

    try:
        resultat = json.loads(texte_reponse)
    except json.JSONDecodeError:
        try:
            resultat = json.loads(repair_json(texte_reponse))
        except Exception as e:
            raise AnalyseIndisponible("JSON de la réponse vision irréparable.") from e

    return {
        "enonce": resultat.get("enonce", ""),
        "explication": resultat.get("explication", ""),
        "matiere": resultat.get("matiere", ""),
        "difficulte": resultat.get("difficulte", "moyen"),
        "confiance": resultat.get("confiance", "basse"),
    }