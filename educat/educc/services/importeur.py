"""
Service d'import : sauvegarde en base de données les questions structurées
générées par le LLM.

Ce pipeline (texte -> LLM -> JSON) ne produit QUE des QCM. Les exercices
(Mathématiques/Physique/Chimie) passent exclusivement par le pipeline image
(voir decoupeur_images.py + la commande importer_exercices_images).

RÈGLE DE SÉCURITÉ CENTRALE : toutes les questions importées automatiquement
arrivent avec statut="en_attente", JAMAIS "validee" directement — même si
le LLM indique "confiance: haute". La validation finale reste humaine,
via l'admin Django (voir QuestionAdmin dans admin.py, actions
"Valider"/"Rejeter" en masse).
"""

from educc.models import Question, Choix, Matiere, Ecole

MATIERES_VALIDES = [
    "Mathématiques", "Physique", "Chimie", "Français", "Anglais",
    "Culture générale", "Philosophie", "Sciences de la Vie et de la Terre", "Informatique",
]


def contient_texte_corrompu(texte):
    """
    Détecte les artefacts classiques d'extraction PDF ratée
    (codes internes de police non convertis, ex: '(cid:19)').
    """
    if not texte:
        return False
    return "(cid:" in texte


def importer_questions(questions_data, ecole_nom, filiere_id=None):
    """
    filiere_id est optionnel (None par défaut) — permet de rattacher les
    questions importées à une filière précise, donc à un niveau (licence/master)
    via Filiere.niveau. Si non fourni, la question reste sans filière précise.
    """
    try:
        ecole = Ecole.objects.get(nom=ecole_nom)
    except Ecole.DoesNotExist:
        print(f"⚠ École '{ecole_nom}' introuvable — crée-la d'abord dans l'admin")
        return 0

    compteur = 0
    compteur_rejetes_corruption = 0

    for q in questions_data:
        if not q.get("enonce"):
            continue

        # Ce pipeline texte ne doit produire QUE des QCM. Si le LLM renvoie
        # une question sans au moins 2 choix exploitables, on l'ignore —
        # les exercices passent exclusivement par le pipeline image.
        if not q.get("choix") or len(q["choix"]) < 2:
            continue

        choix_valides = [c for c in q.get("choix", []) if isinstance(c, dict)]
        texte_a_verifier = q.get("enonce", "") + " ".join(
        c.get("texte", "") for c in choix_valides
        )
        if contient_texte_corrompu(texte_a_verifier):
            compteur_rejetes_corruption += 1
            continue

        nom_matiere = q.get("matiere", "Non classé")
        if nom_matiere not in MATIERES_VALIDES:
            nom_matiere = "Non classé"

        matiere, _ = Matiere.objects.get_or_create(nom=nom_matiere)

        question = Question.objects.create(
            type_question="qcm",  # figé en dur : ce pipeline ne fait que du QCM
            enonce=q["enonce"],
            matiere=matiere,
            filiere_id=filiere_id,
            ecole=ecole,
            annee_session=q.get("annee_session"),
            difficulte=q.get("difficulte", "moyen"),
            explication=q.get("explication", ""),
            statut="en_attente",
        )

        for c in choix_valides:
            Choix.objects.create(
            question=question,
            texte=c.get("texte", ""),
            est_correct=c.get("est_correct", False),
)

        compteur += 1

    if compteur_rejetes_corruption:
        print(f"  ⚠ {compteur_rejetes_corruption} question(s) ignorée(s) (texte PDF corrompu détecté)")

    return compteur