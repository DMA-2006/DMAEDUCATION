// src/components/ChoixBranche.jsx
// Choix de la sous-branche d'une matière (Informatique : développement, réseau,
// systèmes) + « Mixte » = toutes les questions de la matière.
// Utilisé dans la Library et dans la configuration du quiz.

const ICONES_BRANCHE = {
  dev: "code",
  reseau: "lan",
  systeme: "terminal",
  mixte: "shuffle",
};

// matiere : { nb_questions, branches: [{ code, nom, nb_questions }] }
// valeur  : code de la branche choisie ("mixte" par défaut)
export default function ChoixBranche({ matiere, valeur, surChoix }) {
  const options = [
    ...matiere.branches,
    { code: "mixte", nom: "Mixte", nb_questions: matiere.nb_questions ?? 0 },
  ];

  return (
    // Téléphone : une case par ligne (les noms sont longs) ; au-delà : deux colonnes
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
      {options.map((b) => {
        const choisie = valeur === b.code;
        return (
          <button
            key={b.code}
            type="button"
            aria-pressed={choisie}
            onClick={() => surChoix(b.code)}
            className={`relative flex items-center sm:items-start gap-2.5 px-3 py-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
              choisie
                ? "border-[#0f172a] bg-[#0f172a]/10 shadow-[0_4px_14px_rgba(15,23,42,0.25)] sm:scale-[1.02]"
                : "border-slate-200 bg-white hover:border-[#0f172a]/50 hover:bg-[#0f172a]/5"
            }`}
          >
            {/* Pastille « choisie » */}
            {choisie && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0f172a] text-white flex items-center justify-center shadow">
                <span className="material-symbols-outlined text-[14px] font-bold">check</span>
              </span>
            )}

            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                choisie ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {ICONES_BRANCHE[b.code] || "category"}
              </span>
            </span>

            {/* Téléphone : nom à gauche, nombre de questions à droite ; sinon l'un sous l'autre */}
            <span className="min-w-0 flex-1 flex items-center justify-between gap-2 sm:block">
              <span
                className={`block text-[13px] sm:text-xs leading-snug break-words ${
                  choisie ? "font-bold text-[#0f172a]" : "font-medium text-slate-700"
                }`}
              >
                {b.nom}
              </span>
              <span
                className={`block shrink-0 text-[11px] sm:mt-0.5 ${
                  choisie ? "text-[#0f172a]/80" : "text-slate-400"
                }`}
              >
                {b.nb_questions} question{b.nb_questions > 1 ? "s" : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
