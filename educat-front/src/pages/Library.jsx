// src/pages/Library.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import client from "../api/client";
import Header from "../components/Header";
import Reveal from "../components/Reveal";
import ChoixBranche from "../components/ChoixBranche";
import { useAuth } from "../context/AuthContext";

const ICONES_MATIERE = {
  "Mathématiques": "calculate",
  Physique: "science",
  Chimie: "biotech",
  Français: "menu_book",
  Anglais: "translate",
  "Culture générale": "public",
  "Sciences de la Vie et de la Terre": "eco",
  Informatique: "memory",
  Histoire: "history_edu",
};

const IMAGES_MATIERE = {
  "Mathématiques": "/maths.png",
  Physique: "/physique.png",
  Chimie: "/chimie.png",
  Français: "/francais.png",
  Anglais: "/anglais.png",
  "Culture générale": "/culture-generale.png",
  "Sciences de la Vie et de la Terre": "/svt.png",
  Informatique: "/informatique.png",
  Histoire: "/histoire.png",
};

const NOMS_AFFICHES = {
  "Sciences de la Vie et de la Terre": "SVT",
};

const MATIERES_EXCLUES = [
  "Sciences de la Vie et de la Terre",
  "Histoire",
  "Non classé",
  "Philosophie",
];

const COUVERTURES = [
  "bg-primary-container text-on-primary",
  "bg-secondary text-white",
  "bg-[#E8DECC] text-[#5C4D3C]",
  "bg-[#D8E3FA] text-[#1A2B48]",
  "bg-primary text-white",
];

const NIVEAUX = [
  { valeur: "licence", label: "Licence" },
  { valeur: "master", label: "Master" },
  { valeur: "ingenieur", label: "Ingénieur" },
];

const MODES = [
  {
    valeur: "libre",
    label: "Entraînement libre",
    description: "Sans limite de temps",
  },
  {
    valeur: "chronometre",
    label: "Chronométré",
    description: "Contre la montre",
  },
];

// Message affiché quand les matières ne peuvent pas être chargées
// (avant, l'erreur n'allait que dans la console et la page disait « Aucune matière »).
function messageErreurMatieres(err) {
  if (err?.estReponseHtml) {
    return import.meta.env.DEV
      ? "Le serveur a renvoyé une page web au lieu des données : le proxy vers Django n'est pas actif. Arrête puis relance « npm run dev » (le fichier vite.config.js n'est lu qu'au démarrage)."
      : "Impossible de charger les matières. Réessaie dans un instant.";
  }
  if (!err?.response) {
    return "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.";
  }
  return `Le serveur a rencontré une erreur (${err.response.status}). Réessaie dans un instant.`;
}

function extraireListe(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export default function Library() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [matieres, setMatieres] = useState([]);
  const [chargementInitial, setChargementInitial] = useState(true);
  const [erreurMatieres, setErreurMatieres] = useState("");
  const [centre, setCentre] = useState(0);

  const [matiereChoisie, setMatiereChoisie] = useState(null);
  const [niveauChoisi, setNiveauChoisi] = useState("licence");
  const [modeChoisi, setModeChoisi] = useState("libre");
  const [nombreQuestions, setNombreQuestions] = useState(10);
  // Sous-branche de la matière (Informatique : développement, réseau, systèmes) ; "mixte" =
  // toutes les questions de la matière. Sans effet pour une matière sans branche.
  const [brancheChoisie, setBrancheChoisie] = useState("mixte");
  const [demarrageEnCours, setDemarrageEnCours] = useState(false);
  const [erreurDemarrage, setErreurDemarrage] = useState("");

  // Matière visée quand on clique sur "Jouer" sans être connecté :
  // sert à afficher l'invitation à se connecter.
  const [inviteConnexion, setInviteConnexion] = useState(null);

  // Chargement léger : uniquement la liste des matières (quelques lignes).
  // On ne télécharge plus toutes les questions juste pour les compter —
  // le compteur "nb_questions" est calculé côté serveur dans /matieres/.
  const chargerMatieres = useCallback(() => {
    setChargementInitial(true);
    setErreurMatieres("");
    client
      .get("/matieres/")
      .then((res) => setMatieres(extraireListe(res.data)))
      .catch((err) => {
        console.error("Erreur chargement matières :", err);
        setErreurMatieres(messageErreurMatieres(err));
      })
      .finally(() => setChargementInitial(false));
  }, []);

  useEffect(() => {
    chargerMatieres();
  }, [chargerMatieres]);

  const matieresAffichees = useMemo(
    () => matieres.filter((m) => !MATIERES_EXCLUES.includes(m.nom)),
    [matieres]
  );

  const total = matieresAffichees.length;

  // Retour de la page de connexion : on rouvre directement la configuration
  // de la matière sur laquelle la personne avait cliqué.
  useEffect(() => {
    const id = location.state?.matiereId;
    if (!id || !isAuthenticated || matieresAffichees.length === 0) return;

    const index = matieresAffichees.findIndex((m) => m.id === id);
    if (index >= 0) {
      setCentre(index);
      setMatiereChoisie(matieresAffichees[index]);
    }
    // On efface l'état pour ne pas rouvrir le panneau à chaque rechargement
    navigate("/library", { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matieresAffichees, isAuthenticated]);

  // Envoie vers /login ou /register en gardant en mémoire d'où l'on vient
  function allerVers(chemin) {
    navigate(chemin, {
      state: { from: "/library", matiereId: inviteConnexion?.id },
    });
  }

  function precedent() {
    if (total === 0) return;
    setCentre((c) => (c - 1 + total) % total);
  }

  function suivant() {
    if (total === 0) return;
    setCentre((c) => (c + 1) % total);
  }

  const [glissement, setGlissement] = useState({
    actif: false,
    depart: 0,
    delta: 0,
  });

  const vientDeGlisserRef = useRef(false);

  function debuterGlissement(clientX) {
    setGlissement({ actif: true, depart: clientX, delta: 0 });
  }

  function pendantGlissement(clientX) {
    setGlissement((prev) =>
      prev.actif
        ? { ...prev, delta: clientX - prev.depart }
        : prev
    );
  }

  function terminerGlissement() {
    setGlissement((prev) => {
      if (prev.actif) {
        const SEUIL = 60;

        if (Math.abs(prev.delta) > 10) {
          vientDeGlisserRef.current = true;
          setTimeout(() => {
            vientDeGlisserRef.current = false;
          }, 50);
        }

        if (prev.delta > SEUIL) precedent();
        else if (prev.delta < -SEUIL) suivant();
      }

      return { actif: false, depart: 0, delta: 0 };
    });
  }

  function surTouchesClavier(e) {
    if (e.key === "ArrowLeft") precedent();
    if (e.key === "ArrowRight") suivant();
  }

  function ouvrirChoix(matiere) {
    // La bibliothèque est publique, mais jouer demande un compte.
    if (!isAuthenticated) {
      setInviteConnexion(matiere);
      return;
    }
    setMatiereChoisie(matiere);
    setBrancheChoisie("mixte");
    setErreurDemarrage("");
  }

  function fermerChoix() {
    setMatiereChoisie(null);
    setErreurDemarrage("");
  }

  async function demarrerQuiz() {
    if (!matiereChoisie) return;

    // Garde-fou : on ne lance jamais un quiz sans être connecté.
    if (!isAuthenticated) {
      setInviteConnexion(matiereChoisie);
      setMatiereChoisie(null);
      return;
    }

    setDemarrageEnCours(true);
    setErreurDemarrage("");

    // Branche réellement demandée (rien pour une matière sans branche)
    const branche = matiereChoisie.branches?.length ? brancheChoisie : undefined;
    const nomBranche = matiereChoisie.branches?.find((b) => b.code === branche)?.nom;

    try {
      const res = await client.post("/quiz/demarrer/", {
        matieres: [matiereChoisie.id],
        mode: modeChoisi,
        nombre_questions: nombreQuestions,
        niveau: niveauChoisi,
        branche,
      });

      navigate("/quiz/play", {
        state: {
          sessionId: res.data.session_id,
          questions: res.data.questions,
          matiereId: matiereChoisie.id,
          matiereNom:
            (NOMS_AFFICHES[matiereChoisie.nom] || matiereChoisie.nom) +
            (nomBranche ? ` · ${nomBranche}` : ""),
          // Gardée jusqu'à la page de résultat : « Rejouer » reste dans la même branche
          branche,
          mode: modeChoisi,
          niveau: niveauChoisi,
          nombreQuestions,
        },
      });
    } catch (err) {
      console.error(
        "Erreur démarrage quiz :",
        err.response?.data || err
      );

      const detail =
        err.response?.data?.detail ||
        err.response?.data?.mode?.[0] ||
        err.response?.data?.matieres?.[0] ||
        err.response?.data?.nombre_questions?.[0];

      setErreurDemarrage(
        detail ||
          "Impossible de démarrer le quiz. Réessaie dans un instant."
      );
    } finally {
      setDemarrageEnCours(false);
    }
  }

  function positionRelative(i) {
    if (total === 0) return null;

    let diff = i - centre;

    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;

    return diff;
  }

  // "echelle" est appliquée dans le transform : les livres latéraux sont plus petits.
  const stylesPosition = {
    0: {
      left: "50%",
      echelle: 1,
      opacity: "opacity-100",
      z: "z-30",
      h: "h-44 sm:h-52 md:h-60 lg:h-64",
      w: "w-32 sm:w-40 md:w-48 lg:w-52",
    },
    "-1": {
      left: "27%",
      echelle: 0.95,
      opacity: "opacity-75",
      z: "z-10",
      h: "h-36 sm:h-44 md:h-52 lg:h-56",
      w: "w-28 sm:w-36 md:w-44 lg:w-48",
    },
    1: {
      left: "73%",
      echelle: 0.95,
      opacity: "opacity-75",
      z: "z-10",
      h: "h-36 sm:h-44 md:h-52 lg:h-56",
      w: "w-28 sm:w-36 md:w-44 lg:w-48",
    },
    "-2": {
      left: "9%",
      echelle: 0.9,
      opacity: "opacity-50",
      z: "z-0",
      h: "h-28 sm:h-36 md:h-44 lg:h-48",
      w: "w-20 sm:w-28 md:w-36 lg:w-40",
    },
    2: {
      left: "91%",
      echelle: 0.9,
      opacity: "opacity-50",
      z: "z-0",
      h: "h-28 sm:h-36 md:h-44 lg:h-48",
      w: "w-20 sm:w-28 md:w-36 lg:w-40",
    },
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col overflow-x-hidden overflow-y-visible">
      <style>{`
        .btn-clay {
          box-shadow: 0 4px 6px -1px rgba(3,22,50,0.05), 0 2px 4px -2px rgba(3,22,50,0.05), inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 0px 0px rgba(0,0,0,0.1);
          transition: all 0.15s ease;
        }

        .btn-clay:active {
          transform: translateY(2px);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .shadow-clay {
          box-shadow: 0 10px 25px -5px rgba(3,22,50,0.05), 0 8px 10px -6px rgba(3,22,50,0.05), inset 0 2px 4px rgba(255,255,255,0.5);
        }

        .book-cover {
          box-shadow: 0 20px 40px -10px rgba(3,22,50,0.25);
          border-radius: 10px 4px 4px 10px;
          position: relative;
        }

        .book-cover::before {
          content: "";
          position: absolute;
          left: 0;
          top: 2px;
          bottom: 2px;
          width: 6px;
          background: rgba(0,0,0,0.15);
          border-radius: 4px 0 0 4px;
        }

        .carousel-item {
          transition: left 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1);
        }

        .panel-in {
          animation: panelIn 0.2s ease forwards;
        }

        @keyframes panelIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* ── Effet du carrousel : flottement doux du livre central ── */
        @keyframes bookFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .book-float {
          animation: bookFloat 4s ease-in-out infinite;
        }

        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 1; }
          50% { transform: translateX(-50%) scaleX(0.85); opacity: 0.6; }
        }
        .ground-shadow {
          animation: shadowPulse 4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .book-float, .ground-shadow { animation: none !important; }
        }

        /* Même fond pointillé que About.jsx, pour une identité visuelle cohérente */
        .bg-pattern {
          background-image: radial-gradient(#d8e3fa 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>

      <Header current="library" />

      <main className="w-full flex flex-col flex-grow relative bg-pattern">
        <section className="w-full flex flex-col items-center justify-center pt-2 pb-16 px-4 flex-grow">
          <div className="text-center mb-4">
            <Reveal from="up">
              <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-primary tracking-tight mb-2 font-bold">
                Bibliothèque
              </h1>
            </Reveal>

            <Reveal from="up" delay={120}>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Choisis une matière pour commencer
              </p>
            </Reveal>
          </div>

          {chargementInitial ? (
            <p className="text-on-surface-variant py-16">
              Chargement...
            </p>
          ) : erreurMatieres ? (
            <div className="max-w-md mx-auto text-center py-12 px-4">
              <span className="material-symbols-outlined text-[40px] text-[#fb691a]">
                cloud_off
              </span>
              <p className="mt-3 text-on-surface-variant">{erreurMatieres}</p>
              <button
                onClick={chargerMatieres}
                className="mt-5 inline-flex items-center gap-2 bg-[#fc8a40] hover:bg-[#fc8a40]/90 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Réessayer
              </button>
            </div>
          ) : total === 0 ? (
            <p className="text-on-surface-variant py-16">
              Aucune matière disponible.
            </p>
          ) : (
            <>
            {/* Le carrousel monte doucement à l'arrivée */}
            <Reveal from="up" distance={60} delay={200} className="w-full max-w-6xl -mt-4">
            <div
              className="relative w-full h-64 sm:h-72 md:h-80 lg:h-96 flex items-center justify-center select-none cursor-grab active:cursor-grabbing outline-none"
              tabIndex={0}
              onKeyDown={surTouchesClavier}
              onMouseDown={(e) => debuterGlissement(e.clientX)}
              onMouseMove={(e) =>
                glissement.actif && pendantGlissement(e.clientX)
              }
              onMouseUp={terminerGlissement}
              onMouseLeave={() =>
                glissement.actif && terminerGlissement()
              }
              onTouchStart={(e) =>
                debuterGlissement(e.touches[0].clientX)
              }
              onTouchMove={(e) =>
                pendantGlissement(e.touches[0].clientX)
              }
              onTouchEnd={terminerGlissement}
            >
              <button
                onClick={precedent}
                className="absolute left-0 md:left-2 z-40 p-4 rounded-full bg-white/80 backdrop-blur-sm shadow-clay hover:bg-white transition-all hover:scale-110 text-primary border border-outline-variant/20"
                aria-label="Précédent"
              >
                <span className="material-symbols-outlined">
                  chevron_left
                </span>
              </button>

              <button
                onClick={suivant}
                className="absolute right-0 md:right-2 z-40 p-4 rounded-full bg-white/80 backdrop-blur-sm shadow-clay hover:bg-white transition-all hover:scale-110 text-primary border border-outline-variant/20"
                aria-label="Suivant"
              >
                <span className="material-symbols-outlined">
                  chevron_right
                </span>
              </button>

              <div className="relative w-full h-full">
                {/* Ombre au sol : respire en rythme avec le flottement du livre */}
                <div
                  className="ground-shadow absolute left-1/2 top-[78%] -translate-x-1/2 w-[70%] h-10 rounded-full bg-primary/15 blur-2xl pointer-events-none"
                  aria-hidden="true"
                />

                {matieresAffichees.map((matiere, i) => {
                  const diff = positionRelative(i);

                  if (diff === null || Math.abs(diff) > 2) return null;

                  const s = stylesPosition[diff];
                  const image = IMAGES_MATIERE[matiere.nom];
                  const couleur =
                    COUVERTURES[i % COUVERTURES.length];
                  const nomAffiche =
                    NOMS_AFFICHES[matiere.nom] || matiere.nom;
                  const estCentre = diff === 0;

                  return (
                    <button
                      key={matiere.id}
                      onClick={() => {
                        if (vientDeGlisserRef.current) return;

                        if (estCentre) {
                          ouvrirChoix(matiere);
                        } else {
                          setCentre(i);
                        }
                      }}
                      className={`carousel-item group absolute top-1/2 ${s.z} ${s.opacity}`}
                      style={{
                        left: s.left,
                        transform: `translate(-50%, -50%) scale(${s.echelle})`,
                      }}
                    >
                      {/* Flottement doux : livre central uniquement */}
                      <div className={estCentre ? "book-float" : ""}>
                        {image ? (
                          <img
                            src={image}
                            alt={nomAffiche}
                            draggable={false}
                            className={`${s.h} ${s.w} object-contain drop-shadow-md transition-transform duration-300 ${
                              estCentre ? "group-hover:scale-105" : ""
                            }`}
                          />
                        ) : (
                          <div
                            className={`book-cover ${couleur} ${s.h} ${s.w} flex flex-col justify-between p-4 md:p-5 transition-transform duration-300 ${
                              estCentre ? "group-hover:scale-105" : ""
                            }`}
                          >
                            <span className="material-symbols-outlined text-2xl opacity-90">
                              {ICONES_MATIERE[matiere.nom] || "menu_book"}
                            </span>

                            <div>
                              <h3 className="font-headline-md text-base md:text-lg font-bold leading-tight">
                                {nomAffiche}
                              </h3>

                              {estCentre && (
                                <p className="font-label-sm text-xs opacity-80 mt-1">
                                  {matiere.nb_questions ?? 0}{" "}
                                  question(s)
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {estCentre && (
                        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-2 bg-[#fc8a40] text-white text-sm font-bold px-7 py-3.5 rounded-full shadow-[0_4px_14px_rgba(252,138,64,0.4),0_2px_0_#9b4500] btn-clay">
                            <span className="material-symbols-outlined text-[20px]">
                              play_arrow
                            </span>
                            Jouer
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            </Reveal>

            {/* Points de navigation : position dans la liste, et accès direct à une matière */}
            {total > 1 && (
              <Reveal
                from="up"
                delay={450}
                className="mt-16 flex items-center justify-center"
              >
                {matieresAffichees.map((m, i) => {
                  const actif = i === centre;
                  const nom = NOMS_AFFICHES[m.nom] || m.nom;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCentre(i)}
                      aria-label={`Aller à ${nom}`}
                      aria-current={actif ? "true" : undefined}
                      className="p-1.5"
                    >
                      <span
                        className={`block h-2 rounded-full transition-all duration-300 ${
                          actif
                            ? "w-6 bg-[#fb691a]"
                            : "w-2 bg-slate-300 hover:bg-slate-400"
                        }`}
                      />
                    </button>
                  );
                })}
              </Reveal>
            )}
            </>
          )}
        </section>
      </main>

      {/* ═══ PANNEAU DE CHOIX — niveau / mode avant de lancer le quiz ═══ */}
      {matiereChoisie && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-md max-h-full bg-white rounded-2xl shadow-xl border border-slate-200 relative panel-in overflow-y-auto">

            {/* En-tête */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-600 text-xl">
                    {ICONES_MATIERE[matiereChoisie.nom] || "menu_book"}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                    Configuration du quiz
                  </p>

                  <h2 className="text-base font-semibold text-slate-900">
                    {NOMS_AFFICHES[matiereChoisie.nom] ||
                      matiereChoisie.nom}
                  </h2>
                </div>
              </div>

              <button
                onClick={fermerChoix}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            {/* ═══ BLOC UNIQUE DE CONFIGURATION ═══ */}
            <div className="px-3 sm:px-6 py-4 sm:py-5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-4 space-y-4">

                {/* Branche — seulement pour une matière découpée en branches (Informatique) */}
                {matiereChoisie.branches?.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">
                      Branche
                    </label>

                    <ChoixBranche
                      matiere={matiereChoisie}
                      valeur={brancheChoisie}
                      surChoix={setBrancheChoisie}
                    />
                  </div>
                )}

                {/* Niveau */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Niveau
                  </label>

                  <div className="flex p-1 bg-white border border-slate-200 rounded-lg gap-1">
                    {NIVEAUX.map((n) => (
                      <button
                        key={n.valeur}
                        type="button"
                        onClick={() => setNiveauChoisi(n.valeur)}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                          niveauChoisi === n.valeur
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Mode
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {MODES.map((m) => (
                      <button
                        key={m.valeur}
                        type="button"
                        onClick={() => setModeChoisi(m.valeur)}
                        className={`flex items-center justify-between px-3 py-3 rounded-lg border text-left transition-all ${
                          modeChoisi === m.valeur
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {m.label}
                          </p>

                          <p className="text-xs text-slate-400 mt-0.5">
                            {m.description}
                          </p>
                        </div>

                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            modeChoisi === m.valeur
                              ? "border-slate-900"
                              : "border-slate-300"
                          }`}
                        >
                          {modeChoisi === m.valeur && (
                            <span className="w-2 h-2 rounded-full bg-slate-900" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre de questions */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Nombre de questions
                  </label>

                  <div className="flex p-1 bg-white border border-slate-200 rounded-lg gap-1">
                    {[5, 10, 20].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNombreQuestions(n)}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                          nombreQuestions === n
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Erreur */}
                {erreurDemarrage && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      error
                    </span>

                    <span>{erreurDemarrage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pied — action principale */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
              <button
                onClick={demarrerQuiz}
                disabled={demarrageEnCours}
                className="w-full bg-[#fc8a40] hover:bg-[#fc8a40]/90 text-white text-sm font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {demarrageEnCours ? (
                  "Préparation..."
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      play_arrow
                    </span>
                    Commencer
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═══ INVITATION À SE CONNECTER (clic sur "Jouer" sans compte) ═══ */}
      {inviteConnexion && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInviteConnexion(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center panel-in"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="w-14 h-14 rounded-full bg-[#fb691a]/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#fb691a] text-3xl">
                lock
              </span>
            </span>

            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Connecte-toi pour jouer
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Crée un compte gratuit ou connecte-toi pour lancer un quiz de{" "}
              {NOMS_AFFICHES[inviteConnexion.nom] || inviteConnexion.nom} et
              suivre ta progression.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => allerVers("/login")}
                className="w-full bg-[#fc8a40] hover:bg-[#fc8a40]/90 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
              >
                Se connecter
              </button>
              <button
                onClick={() => allerVers("/register")}
                className="w-full border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold py-3 rounded-lg transition-colors"
              >
                Créer un compte
              </button>
              <button
                onClick={() => setInviteConnexion(null)}
                className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}