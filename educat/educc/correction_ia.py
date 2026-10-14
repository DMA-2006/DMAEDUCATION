"""
Service de correction : envoie la réponse rédigée par un utilisateur à un
exercice (question sans choix) au LLM (via Groq), qui juge si elle est
correcte et fournit un commentaire, exactement comme le ferait un correcteur
humain relisant une copie.

Réutilise le même client Groq et le même modèle que structureur.py, pour
rester cohérent avec le reste du pipeline (une seule clé API, un seul point
de configuration).
"""
import json
from json_repair import repair_json
from .services.structureur import client, MODELE


class CorrectionIndisponible(Exception):
    """
    Levée quand la correction automatique d'un exercice ne peut pas être
    effectuée (quota Groq épuisé, erreur réseau, réponse inexploitable...).
    L'appelant (views.py) doit intercepter cette exception et proposer un
    repli à l'utilisateur (par exemple afficher la solution de référence)
    plutôt que de le bloquer.
    """
    pass


PROMPT_SYSTEME_CORRECTION = """Tu es un correcteur pédagogique bienveillant mais rigoureux.
On te donne l'énoncé d'un exercice, une solution de référence, et la réponse rédigée par un étudiant.

Évalue si la réponse de l'étudiant est correcte sur le fond (ne pénalise pas une formulation
différente de la solution de référence tant que le raisonnement et le résultat sont bons).

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte, sans texte autour, sans
balises markdown :

{"correcte": true, "commentaire": "commentaire bref et constructif en français (2-3 phrases maximum)"}

Règles :
- "correcte" est un booléen : true si la réponse est globalement juste, false sinon.
- "commentaire" explique brièvement ce qui est juste, ce qui manque, ou ce qui est erroné.
- Si la réponse de l'étudiant est vide ou hors sujet, "correcte" doit être false et le
  commentaire doit l'indiquer poliment."""


def corriger_exercice(enonce, reponse_utilisateur, solution_reference):
    """
    Retourne un dict {"correcte": bool, "feedback": str} en cas de succès.

    Lève CorrectionIndisponible (plutôt que de renvoyer un repli silencieux)
    dès que la correction ne peut pas être obtenue de façon fiable — quota
    Groq épuisé, erreur réseau, ou réponse impossible à interpréter. C'est
    à l'appelant (la vue Django) de décider comment informer l'utilisateur
    dans ce cas, généralement en affichant la solution de référence.
    """
    contenu_utilisateur = (
        f"Énoncé :\n{enonce}\n\n"
        f"Solution de référence :\n{solution_reference or '(non renseignée)'}\n\n"
        f"Réponse de l'étudiant :\n{reponse_utilisateur or '(réponse vide)'}"
    )

    try:
        reponse = client.chat.completions.create(
            model=MODELE,
            messages=[
                {"role": "system", "content": PROMPT_SYSTEME_CORRECTION},
                {"role": "user", "content": contenu_utilisateur},
            ],
            temperature=0.2,
            max_tokens=500,
        )
    except Exception as e:
        # Toute erreur d'appel API (quota journalier, quota par minute,
        # erreur réseau...) empêche d'obtenir une correction fiable.
        raise CorrectionIndisponible(str(e)) from e

    texte_reponse = reponse.choices[0].message.content.strip()
    texte_reponse = texte_reponse.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    debut = texte_reponse.find("{")
    if debut == -1:
        raise CorrectionIndisponible("Réponse du modèle sans JSON exploitable.")
    texte_reponse = texte_reponse[debut:]

    try:
        resultat = json.loads(texte_reponse)
    except json.JSONDecodeError:
        try:
            resultat = json.loads(repair_json(texte_reponse))
        except Exception as e:
            raise CorrectionIndisponible("JSON de correction irréparable.") from e

    return {
        "correcte": bool(resultat.get("correcte", False)),
        "feedback": resultat.get("commentaire", ""),
    }