"""
Service de structuration : envoie du texte brut au LLM (via Groq)
et récupère des questions structurées en JSON.
"""
from groq import Groq
import json
from json_repair import repair_json
from decouple import config

client = Groq(api_key=config("GROQ_API_KEY"))

MODELE = "openai/gpt-oss-120b"

# Matières où le type "exercice" (réponse libre, sans choix) est autorisé.
# Pour toutes les autres matières (Mathématiques, Physique, Français, SVT,
# Histoire...), seul le QCM est produit — les formules mathématiques sont
# alors écrites en LaTeX directement dans l'énoncé/les choix d'un QCM,
# plutôt que d'être le sujet d'un exercice à réponse libre.
MATIERES_AVEC_EXERCICE = ["Informatique", "Anglais", "Culture générale", "Chimie"]


class QuotaJournalierEpuise(Exception):
    """
    Levée quand le quota journalier (TPD - Tokens Per Day) de Groq est atteint.
    Permet à la commande appelante (importer_annales.py / importer_pdf_local.py)
    d'arrêter proprement le pipeline plutôt que de marteler l'API en boucle
    sur chaque bloc restant sans succès.
    """
    pass


PROMPT_SYSTEME = """Tu es un assistant qui structure des annales de concours en éléments de révision.
Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte, sans texte autour, sans balises markdown :

{"questions": [
  {
    "type_question": "qcm",
    "enonce": "Quelle est la dérivée de $f(x) = x^2 + 3x$ ?",
    "texte_support": "",
    "choix": [
      {"texte": "$f'(x) = 2x + 3$", "est_correct": true},
      {"texte": "$f'(x) = x + 3$", "est_correct": false},
      {"texte": "$f'(x) = 2x$", "est_correct": false},
      {"texte": "$f'(x) = x^2$", "est_correct": false}
    ],
    "matiere": "Mathématiques",
    "annee_session": 2023,
    "difficulte": "moyen",
    "explication": "On dérive terme à terme : la dérivée de $x^2$ est $2x$, celle de $3x$ est $3$, donc $f'(x) = 2x + 3$.",
    "confiance": "haute"
  },
  {
    "type_question": "exercice",
    "enonce": "Rédige un court paragraphe en anglais décrivant tes vacances idéales.",
    "texte_support": "",
    "choix": [],
    "matiere": "Anglais",
    "annee_session": 2023,
    "difficulte": "moyen",
    "explication": "Exemple de réponse attendue : une description cohérente au présent ou au futur, avec un vocabulaire varié lié aux vacances.",
    "confiance": "haute"
  },
  {
    "type_question": "qcm",
    "enonce": "What is the main idea of the passage?",
    "texte_support": "texte intégral du passage de compréhension que l'étudiant doit lire pour répondre",
    "choix": [{"texte": "Option A", "est_correct": false}, {"texte": "Option B", "est_correct": true}],
    "matiere": "Anglais",
    "annee_session": 2023,
    "difficulte": "moyen",
    "explication": "courte justification de la bonne réponse",
    "confiance": "haute"
  }
]}

Règles importantes :

- FORMULES MATHÉMATIQUES / CHIMIQUES : toute formule, équation, expression algébrique, notation
  scientifique (exposants, indices, fractions, racines, intégrales, symboles grecs, unités avec
  exposants...) doit être écrite en LaTeX, entourée de signes dollar : "$...$" pour une formule
  au milieu d'une phrase (ex: "la valeur de $x^2 + 1$ est..."), ou "$$...$$" pour une formule
  isolée sur sa propre ligne. N'écris JAMAIS une formule en texte brut approximatif (comme
  "x^2" sans les dollars, ou "racine de x") — utilise toujours la vraie syntaxe LaTeX :
  exposant "x^{2}", indice "x_{1}", fraction "\\frac{a}{b}", racine "\\sqrt{x}",
  intégrale "\\int_{0}^{1}", symbole grec "\\alpha", "\\pi", etc.
  Ceci s'applique à l'énoncé ("enonce"), aux choix ("choix"), et à l'explication ("explication").
  Le texte normal autour des formules reste en français/anglais normal, seules les formules
  elles-mêmes sont en LaTeX entre dollars.

- "type_question": "exercice" est UNIQUEMENT autorisé pour ces matières précises :
  Informatique, Anglais, Culture générale, Chimie.
  Pour TOUTES LES AUTRES MATIÈRES (Mathématiques, Physique, Français, Sciences de la Vie et de
  la Terre, Philosophie, Histoire...), tu dois TOUJOURS produire "type_question": "qcm", même si
  le texte source présente un problème ouvert sans choix proposés — dans ce cas, invente 3 ou 4
  choix de réponse plausibles toi-même (un correct, les autres incorrects mais crédibles) à
  partir de la solution donnée dans le texte source, plutôt que de créer un exercice à réponse
  libre. Pour un "exercice" (dans les 4 matières autorisées), "choix" doit être un tableau VIDE
  [], et "explication" doit contenir un exemple de réponse correcte ou les points clés attendus.

- Champ "texte_support" : REMPLIS-le avec le passage/texte à lire UNIQUEMENT si la question en
  dépend directement pour être comprise ou résolue (typiquement les questions de compréhension
  écrite en anglais, mais aussi un texte d'appui en français ou toute autre matière). Recopie le
  passage intégralement et fidèlement depuis le texte source, sans le résumer. Si plusieurs
  questions consécutives partagent le même passage, répète le même "texte_support" identique
  pour chacune d'elles. Laisse "texte_support" comme une chaîne VIDE "" si la question se suffit
  à elle-même sans texte à lire.

- Champ "matiere" : choisis UNIQUEMENT parmi cette liste exacte, en respectant l'orthographe
  exacte, sans variante ni abréviation :
  Mathématiques, Physique, Chimie, Français, Anglais, Culture générale, Philosophie, Sciences de
  la Vie et de la Terre, Informatique
  Si le texte source concerne une matière absente de cette liste, choisis la plus proche dans la
  liste plutôt que d'inventer un nouveau nom.

- Champs difficulte possibles : facile, moyen, difficile.
- Champs confiance possibles : haute, basse (basse si le texte source est ambigu ou mal extrait).
- Si le texte ne contient aucun élément exploitable, réponds avec {"questions": []}."""


def structurer_texte(texte_brut, nom_source):
    if not texte_brut or len(texte_brut.strip()) < 20:
        print(f"  ⚠ texte insuffisant pour {nom_source} ({len(texte_brut or '')} caractères)")
        return []

    try:
        reponse = client.chat.completions.create(
            model=MODELE,
            messages=[
                {"role": "system", "content": PROMPT_SYSTEME},
                {"role": "user", "content": texte_brut},
            ],
            temperature=0.2,
            max_tokens=3500,
        )
    except Exception as e:
        erreur_texte = str(e)
        # Détection du quota JOURNALIER épuisé (TPD) — distinct du quota par minute (TPM).
        # Dans ce cas, réessayer ne sert à rien avant demain : on arrête tout
        # proprement au lieu de continuer à épuiser du temps sur chaque bloc restant.
        if "tokens per day" in erreur_texte or "TPD" in erreur_texte:
            raise QuotaJournalierEpuise(
                f"Quota journalier Groq atteint en traitant {nom_source} : {erreur_texte}"
            )
        # Toute autre erreur (quota par minute, erreur réseau ponctuelle, etc.)
        # reste traitée comme avant : on log et on continue sur les blocs suivants.
        print(f"  ⚠ erreur API pour {nom_source} : {e}")
        return []

    choix_reponse = reponse.choices[0]
    texte_reponse = choix_reponse.message.content.strip()

    if choix_reponse.finish_reason == "length":
        print(f"  ⚠ réponse tronquée pour {nom_source} (max_tokens atteint) — tentative de réparation")

    texte_reponse = texte_reponse.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    debut = texte_reponse.find("{")
    if debut == -1:
        print(f"  ⚠ pas de JSON détecté dans la réponse pour {nom_source}")
        return []
    texte_reponse = texte_reponse[debut:]

    try:
        resultat = json.loads(texte_reponse)
    except json.JSONDecodeError:
        try:
            texte_repare = repair_json(texte_reponse)
            resultat = json.loads(texte_repare)
            print(f"  ✓ JSON réparé automatiquement pour {nom_source}")
        except Exception as e:
            print(f"  ⚠ JSON irréparable pour {nom_source} : {e}")
            return []

    questions = resultat.get("questions", []) if isinstance(resultat, dict) else resultat

    questions_valides = []
    for q in questions:
        if not isinstance(q, dict):
            # Peut arriver après une réparation de JSON tronqué : un fragment
            # mal reconstruit se retrouve dans la liste sans être un vrai objet.
            # On l'ignore plutôt que de faire planter tout le pipeline dessus.
            print(f"  ⚠ élément inattendu ignoré dans la réponse pour {nom_source} : {q!r}")
            continue

        q["source_fichier"] = nom_source
        if q.get("type_question") == "exercice" and q.get("matiere") not in MATIERES_AVEC_EXERCICE:
            q["type_question"] = "qcm"

        questions_valides.append(q)

    return questions_valides