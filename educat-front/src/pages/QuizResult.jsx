import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import client from "../api/client";
import TexteMath from "../components/TexteMath";

// Donut Recharts : répartition Correct / Incorrect, avec le score en %
// affiché au centre grâce à un label positionné par-dessus le graphique.
function GraphiqueScore({ score, correctes, incorrectes }) {
  const couleur =
    score >= 80 ? "#22c55e" : score >= 50 ? "#fc8a40" : "#ef4444";

  const donnees = [
    { name: "Correctes", value: correctes, couleur: couleur },
    { name: "Incorrectes", value: incorrectes, couleur: "#e2e8f0" },
  ];

  // Si aucune réponse (0 question), Recharts ne dessine rien — on affiche
  // un cercle neutre plutôt qu'un graphique vide.
  const total = correctes + incorrectes;
  const donneesAffichees = total > 0 ? donnees : [{ name: "Vide", value: 1, couleur: "#e2e8f0" }];

  return (
    <div className="relative w-44 h-44 md:w-48 md:h-48 mx-auto mb-6">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donneesAffichees}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive
            animationDuration={800}
          >
            {donneesAffichees.map((entree, i) => (
              <Cell key={i} fill={entree.couleur} />
            ))}
          </Pie>
          {total > 0 && (
            <Tooltip
              formatter={(value, name) => [`${value} question(s)`, name]}
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl md:text-4xl font-bold" style={{ color: couleur }}>
          {Math.round(score)}%
        </span>
        <span className="text-xs text-slate-400 font-semibold mt-0.5">Score</span>
      </div>
    </div>
  );
}

export default function QuizResult() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [resultat, setResultat] = useState(location.state?.resultat || null);
  const [chargement, setChargement] = useState(!location.state?.resultat);
  const [erreur, setErreur] = useState("");

  const { matiereId, matiereNom, mode, niveau, nombreQuestions, branche } = location.state || {};

  const [rejeuEnCours, setRejeuEnCours] = useState(false);
  const [erreurRejeu, setErreurRejeu] = useState("");

  useEffect(() => {
    if (resultat) return;

    client
      .get("/quiz/mes-sessions/")
      .then((res) => {
        const session = res.data.find((s) => String(s.id) === String(sessionId));
        if (session) {
          setResultat(session);
        } else {
          setErreur("Session introuvable.");
        }
      })
      .catch(() => setErreur("Impossible de charger le résultat."))
      .finally(() => setChargement(false));
  }, [sessionId, resultat]);

  const score = resultat?.score ?? 0;

  // Nombre de bonnes/mauvaises réponses, calculé à partir du détail si
  // disponible, sinon estimé depuis le score et le nombre total de questions.
  const correctes = resultat?.reponses_detail
    ? resultat.reponses_detail.filter((r) => r.correcte).length
    : Math.round((score / 100) * (resultat?.nombre_questions || 0));
  const incorrectes = (resultat?.nombre_questions || 0) - correctes;

  const messageMotivation =
    score >= 80
      ? "Excellent travail ! Continue comme ça."
      : score >= 50
      ? "Pas mal ! Encore un peu d'entraînement et ce sera parfait."
      : "C'est en s'entraînant qu'on progresse. Retente ta chance !";

  async function rejouer() {
    if (!matiereId) {
      navigate("/library");
      return;
    }

    setRejeuEnCours(true);
    setErreurRejeu("");
    try {
      const res = await client.post("/quiz/demarrer/", {
        matieres: [matiereId],
        mode,
        nombre_questions: nombreQuestions,
        niveau,
        branche,
      });
      navigate("/quiz/play", {
        state: {
          sessionId: res.data.session_id,
          questions: res.data.questions,
          matiereId,
          matiereNom,
          mode,
          niveau,
          nombreQuestions,
          branche,
        },
      });
    } catch {
      setErreurRejeu("Impossible de relancer un quiz pour le moment.");
      setRejeuEnCours(false);
    }
  }

  return (
    <div className="font-sans bg-slate-50 min-h-screen w-full">
      <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-6 md:py-10">
        <button
          onClick={() => navigate("/library")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-semibold text-sm mb-6"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Retour
        </button>

        {chargement && (
          <p className="text-center text-slate-500 py-16">Chargement du résultat...</p>
        )}

        {erreur && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{erreur}</div>
        )}

        {resultat && (
          <>
            {/* Carte de score */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center mb-6">
              <GraphiqueScore score={score} correctes={correctes} incorrectes={incorrectes} />

              {/* Légende du donut */}
              <div className="flex items-center justify-center gap-6 mb-6 -mt-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#fc8a40" : "#ef4444" }}
                  />
                  <span className="text-xs text-slate-500 font-semibold">{correctes} correctes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-500 font-semibold">{incorrectes} incorrectes</span>
                </div>
              </div>

              <h1 className="font-bold text-xl md:text-2xl text-slate-900 mb-2">
                Quiz terminé !
              </h1>
              <p className="text-sm md:text-base text-slate-500 mb-8">{messageMotivation}</p>

              <div className="flex justify-center gap-10 mb-8">
                <div>
                  <p className="font-bold text-slate-900 text-lg">
                    {resultat.nombre_questions}
                  </p>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                    Questions
                  </p>
                </div>
                {resultat.duree_secondes != null && (
                  <div>
                    <p className="font-bold text-slate-900 text-lg">
                      {Math.floor(resultat.duree_secondes / 60)}min{" "}
                      {resultat.duree_secondes % 60}s
                    </p>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Durée
                    </p>
                  </div>
                )}
              </div>

              {erreurRejeu && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                  {erreurRejeu}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={rejouer}
                  disabled={rejeuEnCours}
                  className="bg-[#fc8a40] text-white font-bold text-sm px-6 py-3 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {rejeuEnCours ? "Préparation..." : "Refaire un quiz"}
                </button>
                <button
                  onClick={() => navigate("/library")}
                  className="bg-slate-100 text-slate-600 font-bold text-sm px-6 py-3 rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Retour à la bibliothèque
                </button>
              </div>
            </div>

            {/* Détail des réponses */}
            {resultat.reponses_detail && resultat.reponses_detail.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                <h2 className="font-bold text-lg text-slate-900 mb-5">Détail des réponses</h2>
                <div className="space-y-3">
                  {resultat.reponses_detail.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl p-4 border ${
                        r.correcte
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`material-symbols-outlined shrink-0 ${
                            r.correcte ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {r.correcte ? "check_circle" : "cancel"}
                        </span>
                        <div>
                          <p className="font-semibold text-sm md:text-base text-slate-900">
                            <TexteMath texte={r.question} />
                          </p>
                          {r.explication && (
                            <p className="text-sm text-slate-500 mt-1">
                              <TexteMath texte={r.explication} />
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}