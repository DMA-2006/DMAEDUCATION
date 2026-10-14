// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

ChartJS.register(ArcElement, ChartTooltip);

const ORANGE = "#fb691a";
const NAVY = "#031632";
const BLEU = "#3b82f6";
const GRIS = "#94a3b8";

// Le tableau de bord se remet à jour tout seul (pas de bouton "Actualiser")
const ACTUALISATION_AUTO_MS = 10000;

// "2026-10-05" -> "05/10" (sans passer par Date, pour éviter tout décalage de fuseau)
function formaterJour(iso) {
  const [, mois, jour] = iso.split("-");
  return `${jour}/${mois}`;
}

// "il y a 5 min", "il y a 3 h"...
function ilYa(iso) {
  if (!iso) return "Pas encore vu";
  const secondes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 30) return `il y a ${jours} j`;
  return `le ${formaterJour(iso.slice(0, 10))}`;
}

const somme = (tableau) => tableau.reduce((a, b) => a + b, 0);

// Variation entre les 7 derniers jours et les 7 jours précédents
function variation(serie) {
  const recent = somme(serie.slice(-7));
  const avant = somme(serie.slice(-14, -7));
  if (avant === 0) return recent > 0 ? { texte: "Nouveau", ton: "vert" } : null;
  const pct = Math.round(((recent - avant) / avant) * 100);
  return { texte: `${pct >= 0 ? "+" : ""}${pct}%`, ton: pct >= 0 ? "vert" : "rouge" };
}

// Rubriques de la barre latérale : elles font défiler la page vers la section
const NAV = [
  { cle: "apercu", icone: "dashboard", label: "Tableau de bord" },
  { cle: "activite", icone: "monitoring", label: "Activité" },
  { cle: "matieres", icone: "category", label: "Matières" },
  { cle: "inscrits", icone: "group", label: "Inscrits" },
];

// Message affiché quand les statistiques ne se chargent pas, selon la réponse du serveur
function messageErreur(statut) {
  if (statut === undefined) return "Impossible de joindre le serveur. Vérifie que Django tourne.";
  if (statut === 401 || statut === 403) return "Accès réservé aux administrateurs. Reconnecte-toi puis réessaie.";
  if (statut === 404) return "Route introuvable (erreur 404) : vérifie la ligne admin/stats/ dans urls.py.";
  if (statut >= 500) return `Erreur du serveur (${statut}) : le détail est dans le terminal de Django.`;
  return `Impossible de charger les statistiques (erreur ${statut}).`;
}

function allerA(cle) {
  document.getElementById(cle)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ───────────────────────── Petits composants ───────────────────────── */

// Nombre qui "compte" jusqu'à sa valeur finale (et repart de sa valeur
// actuelle si le chiffre change ensuite).
export function Compteur({ valeur, duree = 2800 }) {
  const cible = Number(valeur) || 0;
  const [affiche, setAffiche] = useState(0);
  const courant = useRef(0);

  useEffect(() => {
    const reduit =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit) {
      courant.current = cible;
      setAffiche(cible);
      return;
    }

    const depart = courant.current;
    const debut = performance.now();
    let raf;

    const etape = (maintenant) => {
      const progression = Math.min((maintenant - debut) / duree, 1);
      const adouci = 1 - Math.pow(1 - progression, 2); // décélération douce (moins brusque au départ)
      const v = depart + (cible - depart) * adouci;
      courant.current = v;
      setAffiche(v);
      if (progression < 1) raf = requestAnimationFrame(etape);
    };

    raf = requestAnimationFrame(etape);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree]);

  const decimales = Number.isInteger(cible) ? 0 : 1;
  return (
    <>
      {affiche.toLocaleString("fr-FR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
    </>
  );
}

const TONS = {
  vert: "bg-green-50 text-green-600",
  rouge: "bg-red-50 text-red-600",
  ambre: "bg-amber-50 text-amber-600",
  bleu: "bg-blue-50 text-blue-600",
  gris: "bg-slate-100 text-slate-500",
};

function Badge({ texte, ton = "gris" }) {
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${TONS[ton]}`}>
      {texte}
    </span>
  );
}

function MiniBarres({ valeurs }) {
  const max = Math.max(...valeurs, 1);
  return (
    <div className="flex items-end gap-[3px] h-10" aria-hidden="true">
      {valeurs.map((v, i) => (
        <span
          key={i}
          className="w-[5px] rounded-sm"
          style={{
            height: `${Math.max((v / max) * 100, 10)}%`,
            background: ORANGE,
            opacity: v ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

function MiniCourbe({ valeurs }) {
  const max = Math.max(...valeurs, 1);
  const pas = 100 / (valeurs.length - 1 || 1);
  const points = valeurs
    .map((v, i) => `${(i * pas).toFixed(1)},${(36 - (v / max) * 32).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="w-24 h-10" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={ORANGE}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Jauge({ pourcentage }) {
  const rayon = 16;
  const circonference = 2 * Math.PI * rayon;
  const p = Math.max(0, Math.min(100, pourcentage));
  return (
    <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90" aria-hidden="true">
      <circle cx="20" cy="20" r={rayon} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={rayon}
        fill="none"
        stroke={ORANGE}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * circonference} ${circonference}`}
      />
    </svg>
  );
}

function MiniRepartition({ validees, attente, rejetees }) {
  const total = validees + attente + rejetees;
  if (!total) {
    return <span className="block w-24 h-2.5 rounded-full bg-slate-100" aria-hidden="true" />;
  }
  const part = (n) => `${(n / total) * 100}%`;
  return (
    <div className="w-24 h-2.5 rounded-full overflow-hidden flex bg-slate-100" aria-hidden="true">
      <span style={{ width: part(validees), background: ORANGE }} />
      <span style={{ width: part(attente), background: BLEU }} />
      <span style={{ width: part(rejetees), background: GRIS }} />
    </div>
  );
}

function CarteChiffre({ icone, label, badge, droite, children }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[14px] text-slate-600">
        <span className="material-symbols-outlined text-[20px] text-slate-700">{icone}</span>
        <span className="font-medium">{label}</span>
        {badge}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[36px] md:text-[40px] font-semibold leading-none tracking-tight">
          {children}
        </div>
        {droite}
      </div>
    </div>
  );
}

function Section({ id, titre, sousTitre, droite, children, className = "" }) {
  return (
    <section
      id={id}
      className={`scroll-mt-6 bg-[#f7f7f8] border border-slate-200/80 rounded-2xl p-5 md:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] font-semibold">{titre}</h2>
          {sousTitre && <p className="text-[13px] text-slate-500 mt-0.5">{sousTitre}</p>}
        </div>
        {droite}
      </div>
      {children}
    </section>
  );
}

// Bulle d'information du graphique d'activité (au survol)
function InfoBulle({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3.5 py-2.5 text-[13px]">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.dataKey} : <span className="font-semibold text-slate-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function statutMatiere(reussite) {
  if (reussite == null) return { texte: "Pas de données", ton: "gris" };
  if (reussite >= 70) return { texte: "Solide", ton: "vert" };
  if (reussite >= 50) return { texte: "Moyen", ton: "ambre" };
  return { texte: "À renforcer", ton: "rouge" };
}

/* ───────────────────────── Liste des inscrits ───────────────────────── */

// Les deux actions de l'administrateur sur un compte
const ACTIONS_COMPTE = {
  deconnecter: {
    titre: "Déconnecter ce compte ?",
    texte: (u) =>
      `${u.username} sera déconnecté de tous ses appareils et devra se reconnecter. Son compte et ses résultats sont conservés.`,
    bouton: "Déconnecter",
    enCours: "Déconnexion...",
    icone: "logout",
    couleur: "bg-slate-900 hover:bg-slate-800",
    appel: (u) => client.post(`/admin/utilisateurs/${u.id}/deconnecter/`),
  },
  supprimer: {
    titre: "Supprimer ce compte ?",
    texte: (u) =>
      `Le compte ${u.username} sera supprimé définitivement, avec ses quiz et ses résultats. Cette action est irréversible.`,
    bouton: "Supprimer définitivement",
    enCours: "Suppression...",
    icone: "delete",
    couleur: "bg-red-600 hover:bg-red-700",
    appel: (u) => client.delete(`/admin/utilisateurs/${u.id}/`),
  },
};

// Fenêtre de confirmation avant de déconnecter ou de supprimer un compte
function ConfirmationCompte({ demande, surFermeture, surFait }) {
  const action = ACTIONS_COMPTE[demande.type];
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function confirmer() {
    setEnCours(true);
    setErreur("");
    try {
      await action.appel(demande.compte);
      surFait();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErreur(
        typeof detail === "string"
          ? detail
          : err.response
          ? `Le serveur a refusé l'action (erreur ${err.response.status}).`
          : "Impossible de joindre le serveur. Réessaie dans un instant."
      );
      setEnCours(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={enCours ? undefined : surFermeture}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={action.titre}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            demande.type === "supprimer" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">{action.icone}</span>
        </span>

        <h2 className="text-[17px] font-semibold text-slate-900 mb-1">{action.titre}</h2>
        <p className="text-[14px] text-slate-500 leading-relaxed">{action.texte(demande.compte)}</p>

        {erreur && (
          <p className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[13px]">
            {erreur}
          </p>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={surFermeture}
            disabled={enCours}
            className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 text-[14px] font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={enCours}
            className={`flex-1 text-white text-[14px] font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 ${action.couleur}`}
          >
            {enCours ? action.enCours : action.bouton}
          </button>
        </div>
      </div>
    </div>
  );
}

// surChangement : recharge les chiffres après une déconnexion ou une suppression
function ListeInscrits({ inscrits, totaux, surChangement }) {
  const [filtre, setFiltre] = useState("tous"); // "tous" | "en_ligne"
  const [recherche, setRecherche] = useState("");
  // null, ou l'action en attente de confirmation : { type, compte }
  const [demande, setDemande] = useState(null);

  const terme = recherche.trim().toLowerCase();
  const visibles = inscrits.filter(
    (u) =>
      (filtre === "tous" || u.en_ligne) &&
      (!terme ||
        u.username.toLowerCase().includes(terme) ||
        (u.email || "").toLowerCase().includes(terme))
  );

  return (
    <Section
      id="inscrits"
      titre="Tous les inscrits"
      sousTitre={`${totaux.utilisateurs} inscrit(s) · ${totaux.en_ligne} en ligne · +${totaux.nouveaux_7j} cette semaine`}
      droite={
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl gap-1">
          {[
            { cle: "tous", label: "Tous" },
            { cle: "en_ligne", label: "En ligne" },
          ].map((f) => (
            <button
              key={f.cle}
              onClick={() => setFiltre(f.cle)}
              className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-colors ${
                filtre === f.cle ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative mb-3">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
          search
        </span>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un nom ou un e-mail"
          aria-label="Rechercher un inscrit"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="text-[14px] text-slate-400 py-6 text-center">
          Aucun inscrit ne correspond.
        </p>
      ) : (
        <ul className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {visibles.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <span className="relative shrink-0">
                <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 text-[14px] font-bold flex items-center justify-center">
                  {u.username[0]?.toUpperCase()}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    u.en_ligne ? "bg-green-500" : "bg-slate-300"
                  }`}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium truncate flex items-center gap-2">
                  <span className="truncate">{u.username}</span>
                  {u.admin && <Badge texte="Admin" ton="bleu" />}
                </p>
                <p className="text-[12px] text-slate-400 truncate">{u.email || "Pas d'e-mail"}</p>
              </div>

              <p className="hidden md:block text-[12px] text-slate-400 shrink-0">
                Inscrit le {formaterJour(u.date_inscription)}
              </p>

              <div className="text-right shrink-0 w-28">
                {u.en_ligne ? (
                  <>
                    <p className="text-[13px] font-semibold text-green-600">En ligne</p>
                    <p className="text-[11px] text-slate-400">maintenant</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-slate-500">Hors ligne</p>
                    <p className="text-[11px] text-slate-400">{ilYa(u.derniere_activite)}</p>
                  </>
                )}
              </div>

              {/* Actions de l'administrateur (jamais sur son propre compte) */}
              <div className="flex items-center gap-1 shrink-0 w-[68px] justify-end">
                {u.modifiable && (
                  <>
                    <button
                      onClick={() => setDemande({ type: "deconnecter", compte: u })}
                      title="Déconnecter ce compte"
                      aria-label={`Déconnecter ${u.username}`}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[19px]">logout</span>
                    </button>
                    <button
                      onClick={() => setDemande({ type: "supprimer", compte: u })}
                      title="Supprimer ce compte"
                      aria-label={`Supprimer ${u.username}`}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[19px]">delete</span>
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {demande && (
        <ConfirmationCompte
          // Une fenêtre neuve à chaque demande (pas d'erreur restée de la précédente)
          key={`${demande.type}-${demande.compte.id}`}
          demande={demande}
          surFermeture={() => setDemande(null)}
          surFait={() => {
            setDemande(null);
            surChangement?.();
          }}
        />
      )}
    </Section>
  );
}

/* ───────────────────────── Alerte présence ───────────────────────── */

// Affichée quand le statut "en ligne" ne peut pas fonctionner : le serveur ne
// reçoit pas le signal de présence (route manquante, migration non faite...).
function AlertePresence({ code }) {
  const precision =
    code === 404
      ? "La route me/ping/ est introuvable (erreur 404) : ajoute-la dans urls.py."
      : code === 500
      ? "Le serveur plante (erreur 500) : la migration n'est probablement pas faite (python manage.py migrate)."
      : code === 401 || code === 403
      ? "Le jeton est refusé : déconnecte-toi puis reconnecte-toi."
      : code === "reseau"
      ? "Le serveur est injoignable : vérifie que Django tourne."
      : null;

  return (
    <div className="flex items-start gap-3 px-5 py-4 mb-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
      <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5">warning</span>
      <div className="text-[14px] leading-relaxed">
        <p className="font-semibold">
          Ton compte n'apparaît pas « en ligne » : le signal de présence n'arrive pas au serveur.
        </p>
        {precision && <p className="mt-1">{precision}</p>}
        <p className="mt-1 text-amber-800/90">
          À vérifier : 1) la route <code>me/ping/</code> dans <code>urls.py</code> ;
          2) <code>AuthContext.jsx</code> est bien la dernière version ;
          3) F12 → Réseau : la requête « ping » doit répondre 204.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── Barre latérale ───────────────────────── */

function ContenuLateral({ utilisateur, enLigne, rubrique, onChoisir, onDeconnexion, onNavigation }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-5">
        <Link to="/" className="flex items-center gap-2" onClick={onNavigation}>
          <img src="/MOO.png" alt="DMAEDUCATION" className="h-9 w-auto object-contain" />
          <span className="font-sans font-bold text-[18px]">
            DMA<span className="text-[#fb691a]">EDUCATION</span>
          </span>
        </Link>
      </div>

      <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
        {NAV.map((item) => {
          const actif = rubrique === item.cle;
          return (
            <button
              key={item.cle}
              onClick={() => {
                onChoisir(item.cle);
                onNavigation?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-left transition-colors ${
                actif
                  ? "bg-white shadow-sm font-medium"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  actif ? "text-[#fb691a]" : ""
                }`}
              >
                {item.icone}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.cle === "inscrits" && enLigne > 0 && (
                <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {enLigne > 99 ? "99+" : enLigne}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3 space-y-1">
        <Link
          to="/"
          onClick={onNavigation}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-600 hover:bg-white/70 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">language</span>
          Voir le site
        </Link>
        <button
          onClick={onDeconnexion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-600 hover:bg-white/70 transition-colors text-left"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Déconnexion
        </button>
      </div>

      <div className="p-3 border-t border-slate-200/80">
        <div className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #fb691a 0%, #d4540f 100%)" }}
          >
            {utilisateur?.username?.[0]?.toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-medium truncate">{utilisateur?.username}</p>
            <p className="text-[12px] text-slate-400">Administrateur</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Contenu principal ───────────────────────── */

// Partie affichage, séparée du chargement des données
export function Statistiques({ donnees, surChangement }) {
  const { totaux, activite, par_matiere, top_utilisateurs, inscrits } = donnees;
  const [periode, setPeriode] = useState(30);

  const quiz = activite.map((a) => a.quiz);
  const inscriptions = activite.map((a) => a.inscriptions);
  const variationQuiz = variation(quiz);

  const serie = activite.slice(-periode).map((a) => ({
    jour: formaterJour(a.jour),
    Quiz: a.quiz,
    Inscriptions: a.inscriptions,
  }));

  const { questions_validees: validees, questions_en_attente: attente, questions_rejetees: rejetees } = totaux;
  const totalQuestions = validees + attente + rejetees;

  const parts = [
    { nom: "Validées", valeur: validees, couleur: ORANGE },
    { nom: "En attente", valeur: attente, couleur: BLEU },
    { nom: "Rejetées", valeur: rejetees, couleur: GRIS },
  ];

  // Anneau Chart.js. Mémorisé : le tableau de bord se rafraîchit seul toutes
  // les 30 s, et l'anneau ne doit se réanimer que si les chiffres changent.
  const donneesAnneau = useMemo(() => {
    const vide = validees + attente + rejetees === 0;
    return {
      labels: vide ? ["Aucune question"] : ["Validées", "En attente", "Rejetées"],
      datasets: [
        {
          data: vide ? [1] : [validees, attente, rejetees],
          backgroundColor: vide ? ["#e5e7eb"] : [ORANGE, BLEU, GRIS],
          borderWidth: 0,
          hoverOffset: 6,
          spacing: vide ? 0 : 2,
        },
      ],
    };
  }, [validees, attente, rejetees]);

  const optionsAnneau = useMemo(
    () => ({
      cutout: "68%",
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateRotate: true, animateScale: true, duration: 1200 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: validees + attente + rejetees > 0,
          callbacks: { label: (ctx) => ` ${ctx.label} : ${ctx.parsed}` },
        },
      },
    }),
    [validees, attente, rejetees]
  );

  return (
    <div className="space-y-5">
      {/* ── Aperçu : 4 chiffres clés ── */}
      <div id="apercu" className="scroll-mt-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold">Aperçu</h2>
          <p className="text-[12px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Mise à jour automatique
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CarteChiffre
            icone="group"
            label="Utilisateurs"
            badge={
              <Badge
                texte={`${totaux.en_ligne} en ligne`}
                ton={totaux.en_ligne > 0 ? "vert" : "gris"}
              />
            }
            droite={<MiniBarres valeurs={inscriptions.slice(-12)} />}
          >
            <Compteur valeur={totaux.utilisateurs} />
          </CarteChiffre>

          <CarteChiffre
            icone="task_alt"
            label="Quiz terminés"
            badge={
              variationQuiz && (
                <Badge texte={`${variationQuiz.texte} · 7 j`} ton={variationQuiz.ton} />
              )
            }
            droite={<MiniCourbe valeurs={quiz} />}
          >
            <Compteur valeur={totaux.quiz_termines} />
          </CarteChiffre>

          <CarteChiffre
            icone="monitoring"
            label="Score moyen"
            droite={<Jauge pourcentage={Number(totaux.score_moyen)} />}
          >
            <Compteur valeur={totaux.score_moyen} />
            <span className="text-[18px] text-slate-400 font-medium">%</span>
          </CarteChiffre>

          <CarteChiffre
            icone="quiz"
            label="Questions"
            badge={attente > 0 && <Badge texte={`${attente} à valider`} ton="bleu" />}
            droite={<MiniRepartition validees={validees} attente={attente} rejetees={rejetees} />}
          >
            <Compteur valeur={validees} />
          </CarteChiffre>
        </div>
      </div>

      {/* ── Courbe d'activité + répartition des questions ── */}
      <div id="activite" className="scroll-mt-6 grid xl:grid-cols-3 gap-5">
        <Section
          titre="Activité"
          sousTitre="Quiz lancés et inscriptions au fil des jours"
          className="xl:col-span-2"
          droite={
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl gap-1">
              {[7, 14, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setPeriode(n)}
                  className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-colors ${
                    periode === n ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {n} j
                </button>
              ))}
            </div>
          }
        >
          <div className="flex items-center gap-4 mb-2 text-[13px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ORANGE }} />
              Quiz lancés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: NAVY }} />
              Inscriptions
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="degradeQuiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ORANGE} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="jour"
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<InfoBulle />} cursor={{ stroke: ORANGE, strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="Quiz"
                  stroke={ORANGE}
                  strokeWidth={2.5}
                  fill="url(#degradeQuiz)"
                  dot={false}
                  activeDot={{ r: 5, fill: ORANGE, stroke: "#fff", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="Inscriptions"
                  stroke={NAVY}
                  strokeWidth={2}
                  fill="none"
                  dot={false}
                  activeDot={{ r: 4, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section titre="Répartition des questions" sousTitre="Par statut de validation">
          <div className="relative h-52">
            <Doughnut data={donneesAnneau} options={optionsAnneau} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[13px] text-slate-500">Total</span>
              <span className="text-[32px] font-semibold leading-none">{totalQuestions}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {parts.map((p) => (
              <span
                key={p.nom}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[13px]"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.couleur }} />
                {p.nom} :{" "}
                <span className="font-semibold">
                  {totalQuestions ? Math.round((100 * p.valeur) / totalQuestions) : 0}%
                </span>
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Tableau par matière + meilleurs utilisateurs ── */}
      <div id="matieres" className="scroll-mt-6 grid xl:grid-cols-3 gap-5">
        <Section
          titre="Par matière"
          sousTitre="Questions validées et taux de réussite des candidats"
          className="xl:col-span-2"
        >
          {par_matiere.length === 0 ? (
            <p className="text-[14px] text-slate-400">Aucune donnée pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="bg-slate-50 text-[13px] text-slate-500">
                    <th className="font-medium px-4 py-3">Matière</th>
                    <th className="font-medium px-4 py-3">Questions</th>
                    <th className="font-medium px-4 py-3">Réussite</th>
                    <th className="font-medium px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[14px]">
                  {par_matiere.map((m) => {
                    const statut = statutMatiere(m.reussite);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3.5 font-medium">{m.nom}</td>
                        <td className="px-4 py-3.5 text-slate-600">{m.questions}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${m.reussite ?? 0}%`, background: ORANGE }}
                              />
                            </div>
                            <span className="text-slate-600 w-10">
                              {m.reussite == null ? "—" : `${m.reussite}%`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${TONS[statut.ton]}`}
                          >
                            {statut.texte}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section titre="Meilleurs utilisateurs" sousTitre="Par nombre de quiz terminés">
          {top_utilisateurs.length === 0 ? (
            <p className="text-[14px] text-slate-400">Aucun quiz terminé pour l'instant.</p>
          ) : (
            <ol className="space-y-3">
              {top_utilisateurs.map((u, i) => (
                <li key={u.username} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#fb691a]/10 text-[#fb691a] text-[13px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium truncate">{u.username}</p>
                    <p className="text-[12px] text-slate-400">
                      {u.quiz} quiz · {u.score_moyen}% en moyenne
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      {/* ── Tous les inscrits, avec leur présence ── */}
      <ListeInscrits inscrits={inscrits} totaux={totaux} surChangement={surChangement} />
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function Dashboard() {
  const { user, logout, erreurPresence } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [chargements, setChargements] = useState(0); // nombre de chargements réussis
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [rubrique, setRubrique] = useState("apercu");

  // silencieux = rafraîchissement automatique : pas de message de chargement,
  // et en cas d'échec on garde simplement les chiffres déjà affichés.
  const charger = useCallback((silencieux = false) => {
    if (!silencieux) {
      setChargement(true);
      setErreur("");
    }
    client
      .get("/admin/stats/")
      .then((res) => {
        setDonnees(res.data);
        setChargements((n) => n + 1);
      })
      .catch((err) => {
        // Un échec du rafraîchissement automatique est ignoré (on garde les chiffres
        // affichés), SAUF un refus d'accès : la session a changé, il faut le dire.
        const refus = err.response?.status === 401 || err.response?.status === 403;
        if (silencieux && !refus) return;
        console.error("Erreur GET /admin/stats/ :", err.response?.status, err.response?.data || err.message);
        setErreur(messageErreur(err.response?.status));
      })
      .finally(() => {
        if (!silencieux) setChargement(false);
      });
  }, []);

  useEffect(() => {
    charger();
    const intervalle = setInterval(() => charger(true), ACTUALISATION_AUTO_MS);
    return () => clearInterval(intervalle);
  }, [charger]);

  // Auto-diagnostic : un administrateur qui consulte le dashboard est forcément
  // en ligne. S'il s'affiche hors ligne deux rafraîchissements de suite, c'est que
  // son signal de présence n'arrive pas au serveur.
  const [absencesMoi, setAbsencesMoi] = useState(0);
  useEffect(() => {
    if (!donnees || !user) return;
    const moi = donnees.inscrits.find((i) => i.username === user.username);
    setAbsencesMoi(moi && !moi.en_ligne ? (n) => n + 1 : 0);
    // On compte les chargements (et non l'objet de données) : même si le serveur
    // renvoyait deux fois la même chose, chaque chargement doit compter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargements, user]);
  const alertePresence = erreurPresence || absencesMoi >= 2;

  // Échap ferme le tiroir de navigation (mobile)
  useEffect(() => {
    if (!menuOuvert) return;
    function surTouche(e) {
      if (e.key === "Escape") setMenuOuvert(false);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [menuOuvert]);

  // La rubrique active de la barre latérale suit le défilement de la page
  const donneesPretes = donnees !== null;
  useEffect(() => {
    if (!donneesPretes || typeof IntersectionObserver === "undefined") return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        const visible = entrees
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setRubrique(visible.target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.cle);
      if (el) observateur.observe(el);
    });
    return () => observateur.disconnect();
  }, [donneesPretes]);

  const choisirRubrique = (cle) => {
    setRubrique(cle);
    allerA(cle);
  };

  const enLigne = donnees?.totaux.en_ligne ?? 0;
  const enAttente = donnees?.totaux.questions_en_attente ?? 0;
  const sousTitre = !donnees
    ? "Chargement des statistiques..."
    : enAttente > 0
    ? `${enAttente} question(s) en attente de validation.`
    : "Tout est à jour. Voici l'état de la plateforme.";

  const lateral = (fermer) => (
    <ContenuLateral
      utilisateur={user}
      enLigne={enLigne}
      rubrique={rubrique}
      onChoisir={choisirRubrique}
      onDeconnexion={logout}
      onNavigation={fermer}
    />
  );

  // Page d'administration : volontairement SANS le header du site.
  return (
    <div className="font-sans text-slate-900 min-h-screen bg-white">
      {/* Barre latérale (ordinateur) */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-[#f3f3f5] border-r border-slate-200/70 z-30">
        {lateral(undefined)}
      </aside>

      {/* Tiroir de navigation (mobile) */}
      {menuOuvert && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85%] bg-[#f3f3f5] shadow-xl">
            {lateral(() => setMenuOuvert(false))}
          </div>
          <button
            aria-label="Fermer le menu"
            className="flex-1 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setMenuOuvert(false)}
          />
        </div>
      )}

      <main className="lg:pl-64">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {/* En-tête de page */}
          <div className="flex items-start justify-between gap-4 mb-7">
            <div className="flex items-start gap-3">
              <button
                onClick={() => setMenuOuvert(true)}
                aria-label="Ouvrir le menu"
                className="lg:hidden w-10 h-10 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div>
                <h1 className="text-[22px] md:text-[26px] font-semibold">
                  Bienvenue, {user?.username} !
                </h1>
                <p className="text-[14px] text-slate-500 mt-0.5">{sousTitre}</p>
              </div>
            </div>

            {donnees && (
              <span className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-green-500" />
                </span>
                {enLigne} en ligne
              </span>
            )}
          </div>

          {erreur && (
            <div className="flex items-center gap-2 px-5 py-4 mb-5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-[15px]">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {erreur}
            </div>
          )}

          {alertePresence && <AlertePresence code={erreurPresence} />}

          {!donnees && chargement && (
            <p className="text-center text-slate-500 py-20">Chargement des statistiques...</p>
          )}

          {donnees && <Statistiques donnees={donnees} surChangement={() => charger(true)} />}
        </div>
      </main>
    </div>
  );
}