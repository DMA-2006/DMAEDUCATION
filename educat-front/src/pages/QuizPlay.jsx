
// src/pages/QuizPlay.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import TexteMath from "../components/TexteMath";
import ChoixBranche from "../components/ChoixBranche";

const DUREE_CHRONO_SECONDES = 30;

export default function QuizPlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionRecue =
    location.state?.sessionId && location.state?.questions?.length > 0;

  const [etape, setEtape] = useState(sessionRecue ? "jeu" : "config");
  const [matiereId] = useState(location.state?.matiereId ?? null);
  const [matiereNom] = useState(location.state?.matiereNom || null);
  const [mode] = useState(location.state?.mode || "libre");
  // Sous-branche choisie dans la Library (Informatique), transmise au résultat
  const [branche] = useState(location.state?.branche);
  const [nombreQuestionsInitial] = useState(
    location.state?.nombreQuestions ?? null
  );

  // Configuration
  const [ecoles, setEcoles] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [ecoleChoisie, setEcoleChoisie] = useState("");
  const [matieresChoisies, setMatieresChoisies] = useState([]);
  const [nombreQuestions, setNombreQuestions] = useState("10");
  // Sous-branche choisie pour la matière qui en a (Informatique) ; "mixte" = toutes
  const [brancheConfig, setBrancheConfig] = useState("mixte");
  const [chargementDemarrage, setChargementDemarrage] = useState(false);
  const [erreurDemarrage, setErreurDemarrage] = useState("");
  const [avertissementNombre, setAvertissementNombre] = useState("");

  // Session
  const [sessionId, setSessionId] = useState(
    location.state?.sessionId || null
  );
  const [questions, setQuestions] = useState(
    location.state?.questions || []
  );
  const [indexActuel, setIndexActuel] = useState(0);
  const [choixSelectionne, setChoixSelectionne] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [chargementReponse, setChargementReponse] = useState(false);

  // Chronomètre
  const [tempsRestant, setTempsRestant] = useState(
    DUREE_CHRONO_SECONDES
  );

  useEffect(() => {
    if (sessionRecue) return;

    client.get("/ecoles/").then((res) => setEcoles(res.data));
    client.get("/matieres/").then((res) => setMatieres(res.data));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (etape !== "jeu" || mode !== "chronometre") return;
    if (correction) return;

    setTempsRestant(DUREE_CHRONO_SECONDES);

    const intervalle = setInterval(() => {
      setTempsRestant((t) => {
        if (t <= 1) {
          clearInterval(intervalle);
          return 0;
        }

        return t - 1;
      });
    }, 1000);

    return () => clearInterval(intervalle);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexActuel, etape, mode, correction]);

  useEffect(() => {
    if (mode !== "chronometre" || tempsRestant > 0) return;
    if (correction) return;

    const t = setTimeout(() => {
      questionSuivante();
    }, 600);

    return () => clearTimeout(t);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempsRestant]);

  // Matière sélectionnée qui est découpée en branches (Informatique), s'il y en a une
  const matiereABranches = matieres.find(
    (m) => matieresChoisies.includes(m.id) && m.branches?.length > 0
  );

  function toggleMatiere(id) {
    // On décoche la matière à branches : son choix de branche repart à « Mixte »
    if (matiereABranches?.id === id) setBrancheConfig("mixte");

    setMatieresChoisies((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  }

  async function demarrerQuiz(e) {
    e.preventDefault();

    setErreurDemarrage("");
    setAvertissementNombre("");
    setChargementDemarrage(true);

    const brut = Number(nombreQuestions);

    const nombreDemande =
      Number.isFinite(brut) && brut > 0
        ? Math.min(50, Math.max(1, Math.round(brut)))
        : 10;

    try {
      const res = await client.post("/quiz/demarrer/", {
        matieres: matieresChoisies,
        ecole: ecoleChoisie || undefined,
        nombre_questions: nombreDemande,
        mode: "libre",
        // Ne concerne que la matière à branches ; les autres matières restent entières
        branche: matiereABranches ? brancheConfig : undefined,
      });

      const questionsRecues = res.data.questions || [];

      if (questionsRecues.length < nombreDemande) {
        setAvertissementNombre(
          `Seulement ${questionsRecues.length} question(s) disponible(s) pour ces critères ` +
            `(tu en avais demandé ${nombreDemande}).`
        );
      }

      setSessionId(res.data.session_id);
      setQuestions(questionsRecues);
      setIndexActuel(0);
      setChoixSelectionne(null);
      setCorrection(null);
      setEtape("jeu");
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        "Impossible de démarrer le quiz. Vérifie tes critères.";

      setErreurDemarrage(message);
    } finally {
      setChargementDemarrage(false);
    }
  }

  async function validerReponse() {
    if (choixSelectionne === null) return;

    setChargementReponse(true);

    const question = questions[indexActuel];

    try {
      const res = await client.post(
        `/quiz/${sessionId}/repondre/`,
        {
          question_id: question.id,
          choix_id: choixSelectionne,
        }
      );

      setCorrection(res.data);
    } catch (err) {
      setCorrection({
        correcte: false,
        explication: "Une erreur est survenue.",
      });
    } finally {
      setChargementReponse(false);
    }
  }

  function questionSuivante() {
    if (indexActuel + 1 < questions.length) {
      setIndexActuel((i) => i + 1);
      setChoixSelectionne(null);
      setCorrection(null);
    } else {
      terminerQuiz();
    }
  }

  async function terminerQuiz() {
    const etatSuivant = {
      matiereId,
      matiereNom,
      mode,
      branche,
      nombreQuestions:
        nombreQuestionsInitial ?? questions.length,
    };

    try {
      const res = await client.post(
        `/quiz/${sessionId}/terminer/`
      );

      navigate(`/quiz/resultat/${sessionId}`, {
        state: {
          resultat: res.data,
          ...etatSuivant,
        },
      });
    } catch {
      navigate(`/quiz/resultat/${sessionId}`, {
        state: etatSuivant,
      });
    }
  }

  function fermerQuiz() {
    navigate("/library");
  }

  const questionActuelle = questions[indexActuel];

  const progression =
    questions.length > 0
      ? ((indexActuel + 1) / questions.length) * 100
      : 0;

  const peutValider = choixSelectionne !== null;

  const nombreChoix =
    questionActuelle?.choix?.length || 0;

  return (
    <div className="min-h-screen w-full bg-[#F7F9FC] font-body-md relative overflow-hidden flex items-center justify-center p-0 sm:p-4 md:p-8">

      {/* Décoration arrière-plan */}
      <div className="absolute -top-40 -right-40 w-[450px] h-[450px] bg-[#fc8a40]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute -bottom-40 -left-40 w-[450px] h-[450px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <style>{`
        .quiz-shell {
          box-shadow:
            0 25px 60px rgba(3,22,50,0.08),
            0 8px 20px rgba(3,22,50,0.04);
        }

        .quiz-option {
          transition:
            transform 0.16s ease,
            border-color 0.16s ease,
            background 0.16s ease,
            box-shadow 0.16s ease;
        }

        .quiz-option:not(:disabled):hover {
          transform: translateY(-1px);
          border-color: rgba(252,138,64,0.55);
          box-shadow: 0 5px 14px rgba(3,22,50,0.05);
        }

        .quiz-option:not(:disabled):active {
          transform: translateY(0);
        }

        .orange-button {
          background: linear-gradient(135deg, #fc8a40, #f4772d);
          box-shadow:
            0 8px 18px rgba(252,138,64,0.25),
            0 3px 0 #b94f0d;
          transition: all 0.15s ease;
        }

        .orange-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 10px 22px rgba(252,138,64,0.30),
            0 3px 0 #b94f0d;
        }

        .orange-button:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow:
            0 3px 8px rgba(252,138,64,0.20),
            0 0 0 #b94f0d;
        }

        .progress-fill {
          background: linear-gradient(90deg, #fc8a40, #ffad73);
        }

        .config-field {
          background: #F6F8FB;
          border: 1px solid #E8ECF2;
          transition: all 0.2s ease;
        }

        .config-field:focus-within {
          border-color: rgba(252,138,64,0.55);
          box-shadow: 0 0 0 4px rgba(252,138,64,0.08);
        }

        .subject-chip {
          transition: all 0.16s ease;
        }

        .subject-chip:hover {
          transform: translateY(-1px);
        }

        .back-button {
          transition: all 0.16s ease;
        }

        .back-button:hover {
          transform: translateX(-2px);
          border-color: rgba(252,138,64,0.45);
          color: #fc8a40;
          background: rgba(252,138,64,0.05);
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }

          to {
            transform: translateY(0);
          }
        }

        .slide-up {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>

      {/* =========================================================
          CONFIGURATION
      ========================================================= */}
      {etape === "config" && (
        <div className="relative w-full max-w-lg quiz-shell bg-white rounded-[28px] overflow-hidden border border-white">

          <div className="p-6 md:p-8">

            {/* Bouton Retour */}
            <button
              type="button"
              onClick={() => navigate("/quiz/demarrer")}
              className="back-button inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold mb-5"
            >
              <span className="material-symbols-outlined text-[19px]">
                arrow_back
              </span>

              Retour
            </button>

            {/* En-tête */}
            <div className="flex items-start gap-4 mb-7">

              <div className="w-14 h-14 rounded-2xl bg-[#fc8a40]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#fc8a40] text-[28px]">
                  tune
                </span>
              </div>

              <div className="pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#fc8a40] mb-1">
                  Nouvelle session
                </p>

                <h1 className="font-headline-md text-[24px] text-primary font-bold leading-tight">
                  Configure ton quiz
                </h1>

                <p className="text-sm text-on-surface-variant mt-1">
                  Personnalise ta session avant de commencer.
                </p>
              </div>
            </div>

            {/* Erreur */}
            {erreurDemarrage && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  error
                </span>

                <span>{erreurDemarrage}</span>
              </div>
            )}

            <form onSubmit={demarrerQuiz} className="flex flex-col gap-6">

              {/* École */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                  <span className="material-symbols-outlined text-[17px]">
                    school
                  </span>

                  École

                 
                </label>

                <div className="flex gap-2">

                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    account_balance
                  </span>

                  <h1>ESATIC</h1>
                </div>
              </div>

              {/* Matières */}
              <div>

                <div className="flex items-center justify-between mb-2.5">

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[17px]">
                      category
                    </span>

                    Matières
                  </label>

                  {matieresChoisies.length > 0 && (
                    <span className="text-[11px] font-bold text-[#fc8a40]">
                      {matieresChoisies.length} sélectionnée
                      {matieresChoisies.length > 1 ? "s" : ""}
                    </span>
                  )}

                </div>

                <div className="flex flex-wrap gap-2">

                  {matieres.map((matiere) => {

                    const active =
                      matieresChoisies.includes(matiere.id);

                    return (
                      <button
                        type="button"
                        key={matiere.id}
                        onClick={() =>
                          toggleMatiere(matiere.id)
                        }
                        className={`subject-chip px-3.5 py-2 rounded-xl text-sm font-bold border ${
                          active
                            ? "bg-[#fc8a40] text-white border-[#fc8a40] shadow-[0_4px_10px_rgba(252,138,64,0.20)]"
                            : "bg-[#F7F9FC] text-slate-600 border-[#E8ECF2] hover:border-[#fc8a40]/50 hover:text-[#fc8a40]"
                        }`}
                      >

                        {active && (
                          <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                            check
                          </span>
                        )}

                        {matiere.nom}

                      </button>
                    );
                  })}

                </div>

                {matieres.length === 0 && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-400">
                    Chargement des matières...
                  </div>
                )}

              </div>

              {/* Branche — apparaît quand une matière découpée en branches est cochée */}
              {matiereABranches && (
                <div className="slide-up">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                    <span className="material-symbols-outlined text-[17px]">
                      account_tree
                    </span>

                    Branche · {matiereABranches.nom}
                  </label>

                  <ChoixBranche
                    matiere={matiereABranches}
                    valeur={brancheConfig}
                    surChoix={setBrancheConfig}
                  />
                </div>
              )}

              {/* Nombre de questions */}
              <div>

                <div className="flex items-center justify-between mb-2.5">

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[17px]">
                      quiz
                    </span>

                    Nombre de questions
                  </label>

                  <span className="text-xs font-bold text-[#fc8a40]">
                    {nombreQuestions} questions
                  </span>

                </div>

                <div className="config-field rounded-xl flex items-center p-1.5">

                

                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={nombreQuestions}
                    onChange={(e) =>
                      setNombreQuestions(e.target.value)
                    }
                    onBlur={(e) => {
                      const val = Number(e.target.value);

                      setNombreQuestions(
                        !Number.isFinite(val) ||
                          val <= 0
                          ? "10"
                          : String(
                              Math.min(
                                10,
                                Math.max(
                                  1,
                                  Math.round(val)
                                )
                              )
                            )
                      );
                    }}
                    className="w-full bg-transparent border-none outline-none text-center text-lg font-bold text-slate-800"
                  />

                  

                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  Choisis entre 1 et 10 questions.
                </p>

              </div>

              {/* Avertissement */}
              {avertissementNombre && (
                <div className="flex items-start gap-3 bg-orange-50 border border-orange-100 text-orange-700 text-xs rounded-xl px-4 py-3">

                  <span className="material-symbols-outlined text-[18px]">
                    info
                  </span>

                  <span>{avertissementNombre}</span>

                </div>
              )}

              {/* Bouton */}
              <button
                type="submit"
                disabled={chargementDemarrage}
                className="orange-button w-full text-white font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >

                <span className="material-symbols-outlined text-[21px]">
                  {chargementDemarrage
                    ? "hourglass_top"
                    : "play_arrow"}
                </span>

                {chargementDemarrage
                  ? "Préparation..."
                  : "Commencer le quiz"}

                {!chargementDemarrage && (
                  <span className="material-symbols-outlined text-[18px] ml-1">
                    arrow_forward
                  </span>
                )}

              </button>

            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          JEU
      ========================================================= */}
      {etape === "jeu" && questionActuelle && (
        <div className="relative w-full h-screen sm:h-auto sm:min-h-[620px] sm:max-h-[92vh] sm:max-w-lg md:max-w-2xl lg:max-w-3xl bg-white sm:rounded-[32px] quiz-shell overflow-hidden flex flex-col mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-3">

            <button
              onClick={fermerQuiz}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              aria-label="Fermer le quiz"
            >
              <span className="material-symbols-outlined">
                close
              </span>
            </button>

            <div className="text-center">

              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#fc8a40]">
                {mode === "chronometre"
                  ? "Mode chronométré"
                  : "Entraînement"}
              </p>

              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Quiz
              </p>

            </div>

            <div className="w-10 h-10 rounded-xl bg-[#fc8a40]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#fc8a40] text-[20px]">
                school
              </span>
            </div>

          </div>

          {/* Titre */}
          <div className="px-4 sm:px-6 md:px-8">

            <div className="flex items-center gap-2 mb-1">

              <span className="w-2 h-2 rounded-full bg-[#fc8a40]" />

              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {matiereNom || "Quiz général"}
              </span>

            </div>

            <h1 className="font-bold text-xl md:text-2xl text-slate-900 leading-tight">
              {matiereNom || "Quiz"}
            </h1>

            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {questionActuelle.difficulte} •{" "}
              {questions.length} questions
            </p>

          </div>

          {/* Progression */}
          <div className="px-4 sm:px-6 md:px-8 mt-5">

            <div className="flex items-center justify-between mb-2">

              <span className="text-xs font-bold text-slate-500">
                Question {indexActuel + 1}
              </span>

              <span className="text-xs font-bold text-[#fc8a40]">
                {indexActuel + 1}/{questions.length}
              </span>

            </div>

            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">

              <div
                className="progress-fill h-full rounded-full transition-all duration-300"
                style={{ width: `${progression}%` }}
              />

            </div>
          </div>

          {/* Quiz + chrono */}
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 mt-5">

            <div className="flex items-center gap-2">

              <span className="w-8 h-8 rounded-lg bg-[#fc8a40]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#fc8a40] text-[18px]">
                  quiz
                </span>
              </span>

              <span className="font-bold text-slate-900 text-sm md:text-base">
                Question
              </span>

            </div>

            {mode === "chronometre" && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm ${
                  tempsRestant <= 5
                    ? "bg-red-50 text-red-500"
                    : "bg-[#fc8a40]/10 text-[#fc8a40]"
                }`}
              >

                <span className="material-symbols-outlined text-[18px]">
                  timer
                </span>

                00:{String(tempsRestant).padStart(2, "0")}

              </div>
            )}

          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pt-5 pb-32 sm:pb-28">

            {/* Question */}
            <div className="bg-[#F7F9FC] border border-slate-100 rounded-2xl p-5 md:p-6 mb-5">

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#fc8a40] mb-2">
                Question
              </p>

              <h2 className="font-bold text-slate-900 text-xl sm:text-2xl leading-snug">
                <TexteMath texte={questionActuelle.enonce} />
              </h2>

            </div>

            {/* Réponses */}
            <div
              className={`grid gap-3 ${
                nombreChoix > 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >

              {questionActuelle.choix.map((choix, index) => {

                const estSelectionne =
                  choixSelectionne === choix.id;

                let bordure = "border-slate-200";
                let fond = "bg-white";
                let texte = "text-slate-700";
                let numero = "bg-slate-100 text-slate-500";

                if (correction) {

                  if (
                    correction.bonne_reponse &&
                    choix.texte === correction.bonne_reponse
                  ) {
                    bordure = "border-green-500";
                    fond = "bg-green-50";
                    texte = "text-green-700 font-bold";
                    numero = "bg-green-500 text-white";

                  } else if (
                    estSelectionne &&
                    !correction.correcte
                  ) {
                    bordure = "border-red-500";
                    fond = "bg-red-50";
                    texte = "text-red-700 font-bold";
                    numero = "bg-red-500 text-white";
                  }

                } else if (estSelectionne) {

                  bordure = "border-[#fc8a40]";
                  fond = "bg-[#fc8a40]/5";
                  texte = "text-slate-900 font-bold";
                  numero = "bg-[#fc8a40] text-white";

                }

                return (
                  <button
                    key={choix.id}
                    type="button"
                    disabled={!!correction}
                    onClick={() =>
                      setChoixSelectionne(choix.id)
                    }
                    className={`quiz-option w-full text-left p-4 rounded-2xl border-2 flex items-center gap-3 ${bordure} ${fond}`}
                  >

                    <span
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${numero}`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span
                      className={`text-sm md:text-base flex-1 ${texte}`}
                    >
                      <TexteMath texte={choix.texte} />
                    </span>

                    {estSelectionne && !correction && (
                      <span className="material-symbols-outlined text-[#fc8a40] text-[20px]">
                        check_circle
                      </span>
                    )}

                    {correction &&
                      correction.bonne_reponse ===
                        choix.texte && (
                        <span className="material-symbols-outlined text-green-500 text-[21px]">
                          check_circle
                        </span>
                      )}

                    {correction &&
                      estSelectionne &&
                      !correction.correcte && (
                        <span className="material-symbols-outlined text-red-500 text-[21px]">
                          cancel
                        </span>
                      )}

                  </button>
                );
              })}

            </div>
          </div>

          {/* Bouton validation */}
          {!correction && (
            <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 md:p-8 bg-white/95 backdrop-blur-sm border-t border-slate-100">

              <button
                onClick={validerReponse}
                disabled={
                  !peutValider || chargementReponse
                }
                className={`w-full py-4 rounded-2xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                  peutValider && !chargementReponse
                    ? "orange-button text-white"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >

                <span className="material-symbols-outlined text-[20px]">
                  {chargementReponse
                    ? "hourglass_top"
                    : "check"}
                </span>

                {chargementReponse
                  ? "Vérification..."
                  : "Valider ma réponse"}

              </button>

            </div>
          )}

          {/* Correction */}
          {correction && (
            <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-[28px] shadow-[0_-10px_35px_rgba(3,22,50,0.12)] p-5 sm:p-7 pb-7 sm:pb-9 slide-up border-t border-slate-100">

              <div className="max-w-md mx-auto">

                <div className="flex items-center gap-4 mb-4">

                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      correction.correcte
                        ? "bg-green-100"
                        : "bg-red-100"
                    }`}
                  >

                    <span
                      className={`material-symbols-outlined text-[30px] ${
                        correction.correcte
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {correction.correcte
                        ? "check_circle"
                        : "cancel"}
                    </span>

                  </div>

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-0.5">
                      Résultat
                    </p>

                    <h3
                      className={`font-bold text-lg md:text-xl ${
                        correction.correcte
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {correction.correcte
                        ? "Bonne réponse !"
                        : "Mauvaise réponse"}
                    </h3>

                  </div>
                </div>

                <div className="bg-[#F7F9FC] border border-slate-100 rounded-2xl p-4 mb-5">

                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">

                    {correction.explication ? (
                      <TexteMath
                        texte={correction.explication}
                      />
                    ) : correction.correcte ? (
                      "Bien joué, c'est la bonne réponse !"
                    ) : (
                      "Ce n'était pas la bonne réponse."
                    )}

                  </p>

                </div>

                <button
                  onClick={questionSuivante}
                  className={`w-full text-white font-bold text-sm md:text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition ${
                    correction.correcte
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >

                  {indexActuel + 1 < questions.length
                    ? "Question suivante"
                    : "Voir mon résultat"}

                  <span className="material-symbols-outlined text-[19px]">
                    arrow_forward
                  </span>

                </button>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
