from django.db import migrations


def creer_matieres(apps, schema_editor):
    Matiere = apps.get_model("educc", "Matiere")
    matieres = [
        "Mathématiques",
        "Physique",
        "Chimie",
        "Français",
        "Anglais",
        "Culture générale",
        "SVT",
        "Informatique",
    ]
    for nom in matieres:
        Matiere.objects.get_or_create(nom=nom)


def supprimer_matieres(apps, schema_editor):
    Matiere = apps.get_model("educc", "Matiere")
    Matiere.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("educc", "0001_initial"),  # adapte au nom réel de ta dernière migration
    ]

    operations = [
        migrations.RunPython(creer_matieres, supprimer_matieres),
    ]