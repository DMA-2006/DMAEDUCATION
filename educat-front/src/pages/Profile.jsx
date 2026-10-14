// src/pages/Profile.jsx
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Header from "../components/Header";

const LIBELLES_ROLE = {
  candidat: "Candidat",
  moderateur: "Modérateur",
  admin: "Administrateur",
};

function extraireListe(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// Extrait le premier message d'erreur renvoyé par DRF
// ({"username": ["Un utilisateur avec ce nom existe déjà."]}).
// On ignore volontairement les réponses non-objet (ex. une page d'erreur HTML).
function premierMessage(data) {
  if (!data || typeof data !== "object") return null;
  const valeur = Object.values(data).flat()[0];
  return typeof valeur === "string" ? valeur : null;
}

// ── Petit titre gris + carte blanche qui regroupe des lignes ──
function Section({ titre, children }) {
  return (
    <section className="mt-6">
      {titre && (
        <h2 className="px-1 mb-2 text-[16px] text-slate-500">{titre}</h2>
      )}
      <div className="bg-white rounded-2xl overflow-hidden divide-y divide-slate-100">
        {children}
      </div>
    </section>
  );
}

// ── Une ligne : icône + libellé + valeur éventuelle + chevron ──
// Selon les props, elle devient un lien interne (to), un lien externe (href),
// un bouton (onClick) ou une simple ligne d'information.
function Ligne({ icone, label, valeur, onClick, to, href, chevron = false, accent = false }) {
  const contenu = (
    <>
      <span
        className={`ms-fin material-symbols-outlined text-[24px] ${
          accent ? "text-[#fb691a]" : "text-slate-500"
        }`}
      >
        {icone}
      </span>
      <span
        className={`flex-1 text-[17px] font-medium ${
          accent ? "text-[#fb691a]" : "text-slate-900"
        }`}
      >
        {label}
      </span>
      {valeur != null && (
        <span className="text-[16px] text-slate-500 truncate max-w-[45%]">
          {valeur}
        </span>
      )}
      {chevron && (
        <span className="ms-fin material-symbols-outlined text-[22px] text-slate-400">
          chevron_right
        </span>
      )}
    </>
  );

  const base = "w-full flex items-center gap-4 px-4 py-[17px] text-left transition-colors";
  const survol = " hover:bg-slate-50 active:bg-slate-100";

  if (to) return <Link to={to} className={base + survol}>{contenu}</Link>;
  if (href) return <a href={href} className={base + survol}>{contenu}</a>;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base + survol}>
        {contenu}
      </button>
    );
  }
  return <div className={base}>{contenu}</div>;
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);

  // null = fenêtre fermée ; "username" ou "email" = fenêtre ouverte,
  // avec le champ correspondant sélectionné.
  const [edition, setEdition] = useState(null);

  const [sessions, setSessions] = useState(null); // null = chargement en cours

  // Pré-remplit le formulaire dès que le profil est disponible
  // (il peut arriver un instant après l'affichage de la page, après un F5).
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    client
      .get("/quiz/mes-sessions/")
      .then((res) => setSessions(extraireListe(res.data)))
      .catch(() => setSessions([]));
  }, []);

  // Le message de succès disparaît tout seul au bout de 3 secondes
  useEffect(() => {
    if (!succes) return;
    const t = setTimeout(() => setSucces(false), 3000);
    return () => clearTimeout(t);
  }, [succes]);

  // La touche Échap ferme la fenêtre de modification
  useEffect(() => {
    if (edition === null) return;
    function surTouche(e) {
      if (e.key === "Escape") fermerEdition();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  });

  // Résumé léger des statistiques (le détail viendra avec le dashboard)
  const stats = useMemo(() => {
    const terminees = (sessions || []).filter(
      (s) => s.termine && s.score != null
    );
    if (terminees.length === 0) {
      return { nb: 0, moyenne: null, meilleur: null };
    }
    const scores = terminees.map((s) => s.score);
    return {
      nb: terminees.length,
      moyenne: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      meilleur: Math.round(Math.max(...scores)),
    };
  }, [sessions]);

  const modifie =
    !!user &&
    (username.trim() !== (user.username || "") ||
      email.trim() !== (user.email || ""));

  function fermerEdition() {
    setEdition(null);
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setErreur("");
  }

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur("");

    if (!username.trim()) {
      setErreur("Le nom d'utilisateur ne peut pas être vide.");
      return;
    }
    if (email.trim() && !email.includes("@")) {
      setErreur("L'adresse e-mail n'est pas valide.");
      return;
    }

    setEnregistrement(true);
    try {
      const res = await client.patch("/me/", {
        username: username.trim(),
        email: email.trim(),
      });
      // Met à jour le contexte : le Header affiche aussitôt le nouveau pseudo
      if (setUser) setUser(res.data);
      setEdition(null);
      setSucces(true);
    } catch (err) {
      const statut = err.response?.status;
      console.error(
        "Erreur PATCH /me/ :",
        statut,
        err.response?.data || err.message
      );

      setErreur(
        premierMessage(err.response?.data) ||
          (!err.response
            ? "Impossible de joindre le serveur. Vérifie que Django tourne."
            : statut === 405
            ? "Le serveur refuse la modification (erreur 405)."
            : statut === 401 || statut === 403
            ? "Session expirée. Reconnecte-toi puis réessaie."
            : `Le serveur a renvoyé une erreur (${statut}).`)
      );
    } finally {
      setEnregistrement(false);
    }
  }

  function retour() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  function seDeconnecter() {
    // logout() ramène déjà à l'accueil (voir AuthContext)
    logout();
  }

  const initiale = user?.username?.[0]?.toUpperCase() || "?";
  const valeurStat = (v, suffixe = "") =>
    sessions === null ? "…" : v === null ? "—" : `${v}${suffixe}`;

  const tuiles = [
    { icone: "task_alt", label: "Quiz terminés", valeur: valeurStat(stats.nb) },
    { icone: "monitoring", label: "Score moyen", valeur: valeurStat(stats.moyenne, "%") },
    { icone: "emoji_events", label: "Meilleur score", valeur: valeurStat(stats.meilleur, "%") },
  ];

  return (
    <div className="font-sans text-slate-900 min-h-screen flex flex-col bg-[#f4f4f6]">
      <style>{`
        /* Icônes à trait fin, comme dans la maquette */
        .ms-fin {
          font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
        }
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sheet-in {
          animation: sheetUp 0.22s ease-out;
        }
      `}</style>

      <Header current="profile" masquerMobile />

      <main className="flex-grow">
        <div className="max-w-xl lg:max-w-5xl mx-auto px-4 lg:px-8 pt-4 md:pt-10 pb-14">
          {!user ? (
            <p className="text-center text-slate-500 py-20">
              Chargement du profil...
            </p>
          ) : (
            <>
              <h1 className="hidden md:block text-[26px] font-semibold mb-5">
                Mon profil
              </h1>

              {/* ═══ Mobile / tablette : liste façon "Réglages" ═══ */}
              <div className="lg:hidden">
              {/* ── Carte profil ── */}
              <div className="bg-white rounded-2xl p-4">
                <h1 className="sr-only md:hidden">Mon profil</h1>

                {/* Flèche de retour : mobile uniquement, simple icône sans fond */}
                <button
                  onClick={retour}
                  aria-label="Retour"
                  className="md:hidden -ml-1 mb-3 w-9 h-9 flex items-center justify-center text-slate-800 active:opacity-50 transition-opacity"
                >
                  <span className="ms-fin material-symbols-outlined">
                    arrow_back
                  </span>
                </button>

                <div className="flex items-center gap-4">
                <span
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #fb691a 0%, #d4540f 100%)",
                  }}
                >
                  {initiale}
                </span>

                <div className="min-w-0">
                  <p className="text-[21px] font-semibold truncate">
                    {user.username}
                  </p>
                  <p className="text-[16px] text-slate-500 truncate">
                    {user.email || "Aucune adresse e-mail renseignée"}
                  </p>
                  <button
                    onClick={() => setEdition("username")}
                    className="mt-1 inline-flex items-center gap-1 text-[14px] font-medium text-[#fb691a] hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      edit
                    </span>
                    Modifier le profil
                  </button>
                </div>
                </div>
              </div>

              {/* ── Détails du compte ── */}
              <Section titre="Détails du compte">
                <Ligne
                  icone="account_circle"
                  label="Nom d'utilisateur"
                  valeur={user.username}
                  chevron
                  onClick={() => setEdition("username")}
                />
                <Ligne
                  icone="mail"
                  label="Adresse e-mail"
                  valeur={user.email || "Non renseignée"}
                  chevron
                  onClick={() => setEdition("email")}
                />
                <Ligne
                  icone="verified_user"
                  label="Rôle"
                  valeur={LIBELLES_ROLE[user.role] || "Candidat"}
                />
              </Section>

              {/* ── Ma progression ── */}
              <Section titre="Ma progression">
                <Ligne
                  icone="task_alt"
                  label="Quiz terminés"
                  valeur={valeurStat(stats.nb)}
                />
                <Ligne
                  icone="monitoring"
                  label="Score moyen"
                  valeur={valeurStat(stats.moyenne, "%")}
                />
                <Ligne
                  icone="emoji_events"
                  label="Meilleur score"
                  valeur={valeurStat(stats.meilleur, "%")}
                />
                <Ligne
                  icone="menu_book"
                  label="Continuer à réviser"
                  chevron
                  to="/library"
                />
              </Section>

              {/* ── Support ── */}
              <Section titre="Support">
                <Ligne icone="info" label="À propos" chevron to="/about" />
                <Ligne
                  icone="support_agent"
                  label="Nous contacter"
                  chevron
                  href="mailto:diarrassoubamohamedaliou@gmail.com"
                />
              </Section>

              {/* ── Déconnexion ── */}
              <Section>
                <Ligne
                  icone="logout"
                  label="Se déconnecter"
                  accent
                  onClick={seDeconnecter}
                />
              </Section>
              </div>

              {/* ═══ Ordinateur : deux colonnes ═══ */}
              <div className="hidden lg:grid lg:grid-cols-[320px_1fr] gap-8 items-start">
                {/* Colonne gauche : identité + déconnexion */}
                <aside className="space-y-4 sticky top-28">
                  <div className="bg-white rounded-3xl p-8 text-center">
                    <span
                      className="w-28 h-28 rounded-full flex items-center justify-center text-white text-5xl font-bold mx-auto"
                      style={{
                        background:
                          "linear-gradient(135deg, #fb691a 0%, #d4540f 100%)",
                      }}
                    >
                      {initiale}
                    </span>

                    <p className="text-[22px] font-semibold mt-5 truncate">
                      {user.username}
                    </p>
                    <p className="text-[15px] text-slate-500 truncate">
                      {user.email || "Aucune adresse e-mail renseignée"}
                    </p>

                    <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-[13px] font-semibold text-slate-700">
                      <span className="material-symbols-outlined text-[16px] text-[#fb691a]">
                        verified_user
                      </span>
                      {LIBELLES_ROLE[user.role] || "Candidat"}
                    </span>

                    <button
                      onClick={() => setEdition("username")}
                      className="w-full mt-6 py-3 rounded-xl bg-[#fb691a] hover:bg-[#e35e16] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit
                      </span>
                      Modifier le profil
                    </button>
                  </div>

                  <button
                    onClick={seDeconnecter}
                    className="w-full bg-white rounded-2xl px-5 py-4 flex items-center gap-3 text-[#fb691a] text-[16px] font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <span className="ms-fin material-symbols-outlined text-[24px]">
                      logout
                    </span>
                    Se déconnecter
                  </button>
                </aside>

                {/* Colonne droite : contenu */}
                <div className="space-y-6 min-w-0">
                  {/* Statistiques */}
                  <div className="grid grid-cols-3 gap-4">
                    {tuiles.map((t) => (
                      <div key={t.label} className="bg-white rounded-2xl p-5">
                        <span className="w-11 h-11 rounded-xl bg-[#fb691a]/10 flex items-center justify-center mb-3">
                          <span className="ms-fin material-symbols-outlined text-[#fb691a] text-[26px]">
                            {t.icone}
                          </span>
                        </span>
                        <p className="text-[30px] font-bold leading-none">
                          {t.valeur}
                        </p>
                        <p className="text-[14px] text-slate-500 mt-2">
                          {t.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Informations personnelles */}
                  <div className="bg-white rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-[19px] font-semibold">
                        Informations personnelles
                      </h2>
                      <button
                        onClick={() => setEdition("username")}
                        className="inline-flex items-center gap-1 text-[15px] font-medium text-[#fb691a] hover:underline"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          edit
                        </span>
                        Modifier
                      </button>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <div className="min-w-0">
                        <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Nom d'utilisateur
                        </dt>
                        <dd className="mt-1 text-[17px] font-medium truncate">
                          {user.username}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Adresse e-mail
                        </dt>
                        <dd className="mt-1 text-[17px] font-medium truncate">
                          {user.email || "Non renseignée"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Rôle
                        </dt>
                        <dd className="mt-1 text-[17px] font-medium">
                          {LIBELLES_ROLE[user.role] || "Candidat"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Appel à réviser */}
                  <div
                    className="rounded-3xl p-8 text-white flex items-center justify-between gap-6"
                    style={{
                      background:
                        "linear-gradient(120deg, #031632 0%, #0d2a52 60%, #1a3a6e 100%)",
                    }}
                  >
                    <div>
                      <h2 className="text-[20px] font-semibold">
                        Prêt à réviser ?
                      </h2>
                      <p className="text-[15px] text-white/75 mt-1">
                        Choisis une matière dans la bibliothèque et lance un quiz.
                      </p>
                    </div>
                    <Link
                      to="/library"
                      className="shrink-0 bg-[#fb691a] hover:bg-[#e35e16] text-white text-[15px] font-semibold px-6 py-3 rounded-xl transition-colors"
                    >
                      Ouvrir la bibliothèque
                    </Link>
                  </div>

                  {/* Support */}
                  <div className="grid grid-cols-2 gap-4">
                    <Link
                      to="/about"
                      className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                      <span className="ms-fin material-symbols-outlined text-[26px] text-slate-500">
                        info
                      </span>
                      <span className="flex-1 text-[16px] font-medium">À propos</span>
                      <span className="ms-fin material-symbols-outlined text-[22px] text-slate-400">
                        chevron_right
                      </span>
                    </Link>
                    <a
                      href="mailto:diarrassoubamohamedaliou@gmail.com"
                      className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                      <span className="ms-fin material-symbols-outlined text-[26px] text-slate-500">
                        support_agent
                      </span>
                      <span className="flex-1 text-[16px] font-medium">
                        Nous contacter
                      </span>
                      <span className="ms-fin material-symbols-outlined text-[22px] text-slate-400">
                        chevron_right
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Fenêtre de modification (feuille en bas sur mobile) ── */}
      {edition !== null && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={fermerEdition}
        >
          <form
            onSubmit={sauvegarder}
            onClick={(e) => e.stopPropagation()}
            className="sheet-in w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">Modifier le profil</h2>
              <button
                type="button"
                onClick={fermerEdition}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <div>
              <label
                htmlFor="profil-username"
                className="block text-[13px] font-medium text-slate-500 mb-2"
              >
                Nom d'utilisateur
              </label>
              <input
                id="profil-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus={edition === "username"}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#fb691a] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="profil-email"
                className="block text-[13px] font-medium text-slate-500 mb-2"
              >
                Adresse e-mail
              </label>
              <input
                id="profil-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={edition === "email"}
                placeholder="toi@exemple.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#fb691a] focus:bg-white"
              />
            </div>

            {erreur && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <span className="material-symbols-outlined text-[18px] shrink-0">
                  error
                </span>
                <span>{erreur}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={fermerEdition}
                className="flex-1 py-3 rounded-xl text-[15px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!modifie || enregistrement}
                className="flex-1 py-3 rounded-xl text-[15px] font-semibold text-white bg-[#fb691a] hover:bg-[#e35e16] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enregistrement ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Message de confirmation ── */}
      {succes && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg"
        >
          <span className="material-symbols-outlined text-[18px] text-green-400">
            check_circle
          </span>
          Profil mis à jour
        </div>
      )}
    </div>
  );
}