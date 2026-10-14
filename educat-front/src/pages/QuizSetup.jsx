
// src/pages/QuizSetup.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function QuizSetup() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("general");
  const [difficulty, setDifficulty] = useState("easy");
  const [numQuestions, setNumQuestions] = useState(10);

  const handleStart = (e) => {
    e.preventDefault();
    navigate("/quiz/play", {
      state: { category, difficulty, numQuestions },
    });
  };

  const difficulties = [
    {
      valeur: "easy",
      label: "Facile",
      description: "Pour commencer",
      icon: "sentiment_satisfied",
    },
    {
      valeur: "medium",
      label: "Moyen",
      description: "Un peu de défi",
      icon: "psychology",
    },
    {
      valeur: "hard",
      label: "Difficile",
      description: "Pour les experts",
      icon: "local_fire_department",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#F7F9FC] flex items-center justify-center p-4 md:p-8 font-body-md relative overflow-hidden">

      {/* Décor d'arrière-plan */}
      <div className="absolute -top-40 -right-40 w-[450px] h-[450px] bg-[#fc8a40]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[450px] h-[450px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <style>{`
        .quiz-card {
          box-shadow:
            0 25px 60px rgba(3,22,50,0.08),
            0 8px 20px rgba(3,22,50,0.04);
        }

        .quiz-field {
          background: #F6F8FB;
          border: 1px solid #E8ECF2;
          transition: all 0.2s ease;
        }

        .quiz-field:focus-within {
          border-color: rgba(252,138,64,0.55);
          box-shadow: 0 0 0 4px rgba(252,138,64,0.08);
        }

        .difficulty-card {
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease,
            box-shadow 0.18s ease;
        }

        .difficulty-card:hover {
          transform: translateY(-2px);
        }

        .difficulty-card:active {
          transform: translateY(0);
        }

        .start-button {
          background: linear-gradient(135deg, #fc8a40, #f4772d);
          box-shadow:
            0 8px 18px rgba(252,138,64,0.25),
            0 3px 0 #b94f0d;
          transition: all 0.15s ease;
        }

        .start-button:hover {
          transform: translateY(-1px);
          box-shadow:
            0 10px 22px rgba(252,138,64,0.30),
            0 3px 0 #b94f0d;
        }

        .start-button:active {
          transform: translateY(2px);
          box-shadow:
            0 3px 8px rgba(252,138,64,0.20),
            0 0 0 #b94f0d;
        }

        .number-button {
          transition: all 0.15s ease;
        }

        .number-button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      <div className="relative w-full max-w-lg quiz-card bg-white rounded-[28px] border border-white overflow-hidden">

        {/* Bandeau supérieur */}
        
        <div className="p-6 md:p-8">
           {/* Bouton Retour */}
            <button
              type="button"
              onClick={() => navigate("/QuizSetup")}
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

              <h2 className="font-headline-md text-[24px] text-primary font-bold leading-tight">
                Configurer le quiz
              </h2>

              <p className="text-sm text-on-surface-variant mt-1">
                Personnalise ta session avant de commencer.
              </p>
            </div>
          </div>

          <form onSubmit={handleStart} className="flex flex-col gap-6">



            {/* Difficulté */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                <span className="material-symbols-outlined text-[17px]">
                  equalizer
                </span>
                Difficulté
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {difficulties.map((d) => {
                  const active = difficulty === d.valeur;

                  return (
                    <button
                      key={d.valeur}
                      type="button"
                      onClick={() => setDifficulty(d.valeur)}
                      className={`difficulty-card rounded-xl border p-3 text-left ${
                        active
                          ? "bg-[#fc8a40]/8 border-[#fc8a40] shadow-[0_4px_12px_rgba(252,138,64,0.10)]"
                          : "bg-[#F7F9FC] border-[#E8ECF2] hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                          active
                            ? "bg-[#fc8a40] text-white"
                            : "bg-white text-slate-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {d.icon}
                        </span>
                      </div>

                      <p
                        className={`text-sm font-bold ${
                          active
                            ? "text-slate-900"
                            : "text-slate-700"
                        }`}
                      >
                        {d.label}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        {d.description}
                      </p>

                      {active && (
                        <div className="flex justify-end mt-1">
                          <span className="material-symbols-outlined text-[#fc8a40] text-[17px]">
                            check_circle
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nombre de questions */}
            <div>
             

             

              <p className="text-[11px] text-slate-400 mt-2">
                Choisis entre 1 et 10 questions.
              </p>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              className="start-button w-full text-white font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 mt-1"
            >
              <span className="material-symbols-outlined text-[21px]">
                play_arrow
              </span>

              Commencer le quiz

              <span className="material-symbols-outlined text-[18px] ml-1">
                arrow_forward
              </span>
            </button>

          </form>
        </div>

        {/* Petite ligne inférieure */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Prépare-toi à tester tes connaissances 🚀
          </p>
        </div>

      </div>
    </div>
  );
}

export default QuizSetup;

