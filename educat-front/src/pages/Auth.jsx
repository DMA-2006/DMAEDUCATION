// src/pages/Auth.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BoutonGoogle, { useConnexionGoogle } from "../components/BoutonGoogle";
import EtapeOtp from "../components/EtapeOtp";

const MESSAGE_SERVEUR_INJOIGNABLE =
  "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.";

// Distingue un mot de passe faux d'un serveur injoignable (cas typique en test
// sur téléphone : sans réponse du serveur, ce n'est PAS les identifiants le problème).
function messageConnexion(err) {
  if (!err.response) return MESSAGE_SERVEUR_INJOIGNABLE;
  if (err.response.status === 400 || err.response.status === 401) {
    return "Identifiants incorrects.";
  }
  return `Le serveur a rencontré une erreur (${err.response.status}). Réessaie dans un instant.`;
}

function messageInscription(err) {
  if (!err.response) return MESSAGE_SERVEUR_INJOIGNABLE;
  // On ne lit un message que dans une réponse JSON (pas dans une page d'erreur HTML)
  const data = err.response.data;
  const message = data && typeof data === "object" ? Object.values(data).flat()[0] : null;
  return typeof message === "string"
    ? message
    : "Une erreur est survenue lors de l'inscription.";
}

function messageGoogle(err) {
  if (!err.response) return MESSAGE_SERVEUR_INJOIGNABLE;
  const detail = err.response.data?.detail;
  return typeof detail === "string"
    ? detail
    : `Le serveur a rencontré une erreur (${err.response.status}). Réessaie dans un instant.`;
}

// Séparateur « ou » + bouton Google, placé sous chaque formulaire.
function ZoneGoogle({ google, enCours, inscription, compact }) {
  // Connexion Google pas configurée sur le serveur : en ligne, on n'affiche rien
  // (les formulaires suffisent) ; en développement, on rappelle quoi faire.
  if (google.etat === "non-configure" && !import.meta.env.DEV) return null;

  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <div className={`flex items-center gap-3 ${compact ? "mb-3" : "mb-4"}`}>
        <span className="h-px flex-1 bg-outline-variant" />
        <span className="text-xs text-on-surface-variant">ou</span>
        <span className="h-px flex-1 bg-outline-variant" />
      </div>

      {google.etat === "non-configure" ? (
        <p className="text-xs text-center text-on-surface-variant">
          Bouton Google désactivé : ajoute GOOGLE_CLIENT_ID dans le fichier .env
          du serveur Django, puis relance-le.
        </p>
      ) : google.etat === "erreur" ? (
        <p className="text-xs text-center text-on-surface-variant">
          Connexion avec Google indisponible pour le moment.
        </p>
      ) : enCours ? (
        <p className="text-sm text-center text-on-surface-variant py-2.5">
          Connexion avec Google...
        </p>
      ) : (
        <BoutonGoogle
          pret={google.etat === "pret"}
          texte={inscription ? "signup_with" : "signin_with"}
        />
      )}
    </div>
  );
}

export default function Auth() {
  const { login, register, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Détermine le panneau affiché au premier chargement selon l'URL d'arrivée
  // (/register -> panneau "Créer un compte" actif dès le départ).
  const [modeInscription, setModeInscription] = useState(
    location.pathname === "/register"
  );

  // --- Connexion ---
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErreur, setLoginErreur] = useState("");
  const [loginChargement, setLoginChargement] = useState(false);

  // --- Inscription ---
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regErreur, setRegErreur] = useState("");
  const [regChargement, setRegChargement] = useState(false);

  // --- Google ---
  const [googleEnCours, setGoogleEnCours] = useState(false);

  // --- Code OTP ---
  // null tant qu'aucun code n'est attendu ; sinon la réponse du serveur
  // ({ ticket, email, ... }) + `origine` : "connexion" ou "inscription".
  const [otp, setOtp] = useState(null);

  function basculerVersInscription() {
    setModeInscription(true);
    setLoginErreur("");
    setOtp(null);
    navigate("/register", { replace: true, state: location.state });
  }

  function basculerVersConnexion() {
    setModeInscription(false);
    setRegErreur("");
    setOtp(null);
    navigate("/login", { replace: true, state: location.state });
  }

  // Après connexion/inscription : retour à la page d'origine (ex. la Library)
  // si on en vient, sinon vers /quiz.
  function apresConnexion(profil) {
    // Un administrateur arrive directement sur son tableau de bord.
    if (profil?.est_admin) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const destination = location.state?.from || "/quiz";
    const matiereId = location.state?.matiereId;
    navigate(destination, { state: matiereId ? { matiereId } : null });
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErreur("");
    setLoginChargement(true);
    try {
      // Mot de passe correct : le serveur a envoyé un code par e-mail
      const reponse = await login(loginUsername, loginPassword);
      setLoginPassword("");
      setOtp({ ...reponse, origine: "connexion" });
    } catch (err) {
      setLoginErreur(messageConnexion(err));
    } finally {
      setLoginChargement(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegErreur("");
    setRegChargement(true);
    try {
      // Compte créé : il reste à saisir le code reçu par e-mail
      const reponse = await register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });
      setRegPassword("");
      setOtp({ ...reponse, origine: "inscription" });
    } catch (err) {
      setRegErreur(messageInscription(err));
    } finally {
      setRegChargement(false);
    }
  }

  // Appelé par Google quand la personne a choisi son compte. Le compte est créé
  // tout seul à la première connexion : le bouton sert donc aussi à s'inscrire.
  async function surJetonGoogle(jeton) {
    const setErreur = modeInscription ? setRegErreur : setLoginErreur;
    setErreur("");
    setGoogleEnCours(true);
    try {
      const profil = await loginGoogle(jeton);
      apresConnexion(profil);
    } catch (err) {
      setErreur(messageGoogle(err));
      setGoogleEnCours(false);
    }
  }

  const google = useConnexionGoogle(surJetonGoogle);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 font-sans">
      <style>{`
        @keyframes floatShape {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-12px, 14px) rotate(8deg); }
        }
        @keyframes floatShapeSlow {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(10px, -16px) rotate(-6deg); }
        }

        .auth-container {
          position: relative;
          width: 100%;
          max-width: 900px;
          min-height: 620px;
          border-radius: 28px;
          box-shadow: 0 25px 60px -15px rgba(3, 22, 50, 0.3);
          overflow: hidden;
          background: #fff;
        }

        .auth-form-container {
          position: absolute;
          top: 0;
          height: 100%;
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.4s ease;
        }

        /* Connexion : visible par défaut */
        .auth-sign-in-container {
          left: 0;
          width: 50%;
          z-index: 2;
          opacity: 1;
          visibility: visible;
        }

        /* Inscription : cachée par défaut (invisible, non cliquable, hors focus clavier) */
        .auth-sign-up-container {
          left: 0;
          width: 50%;
          z-index: 1;
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        /* Quand on bascule sur "Inscription" : la connexion s'efface COMPLÈTEMENT
           (fondu + non cliquable + retirée du focus clavier), pour que ses champs
           ne transparaissent plus sous le formulaire d'inscription. */
        .auth-container.right-active .auth-sign-in-container {
          transform: translateX(100%);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.3s ease,
            visibility 0s linear 0.6s;
        }

        .auth-container.right-active .auth-sign-up-container {
          transform: translateX(100%);
          opacity: 1;
          z-index: 5;
          pointer-events: auto;
          visibility: visible;
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.5s ease 0.15s,
            visibility 0s linear 0s;
        }

        .auth-overlay-container {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 100%;
          overflow: hidden;
          transition: transform 0.6s cubic-bezier(0.65, 0, 0.35, 1);
          z-index: 100;
        }

        .auth-container.right-active .auth-overlay-container {
          transform: translateX(-100%);
        }

        .auth-overlay {
          position: relative;
          left: -100%;
          height: 100%;
          width: 200%;
          background: linear-gradient(120deg, #031632 0%, #0d2a52 45%, #fb691a 150%);
          transform: translateX(0);
          transition: transform 0.6s cubic-bezier(0.65, 0, 0.35, 1);
        }

        .auth-container.right-active .auth-overlay {
          transform: translateX(50%);
        }

        .auth-overlay-panel {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          top: 0;
          height: 100%;
          width: 50%;
          padding: 0 2.5rem;
        }

        .auth-overlay-left {
          transform: translateX(-20%);
          left: 0;
        }

        .auth-container.right-active .auth-overlay-left {
          transform: translateX(0);
        }

        .auth-overlay-right {
          right: 0;
          transform: translateX(0);
        }

        .auth-container.right-active .auth-overlay-right {
          transform: translateX(20%);
        }

        /* ═══ Version téléphone : le panneau coulisse à la verticale ═══
           Carte de 620 px = panneau de 210 px + zone de formulaire de 410 px.
           Mode connexion : panneau en haut, formulaire en dessous.
           Mode inscription : le panneau descend, le formulaire passe au-dessus. */
        .auth-m-container {
          position: relative;
          width: 100%;
          height: 620px;
          border-radius: 28px;
          box-shadow: 0 25px 60px -15px rgba(3, 22, 50, 0.3);
          overflow: hidden;
          background: #fff;
        }

        .auth-m-form {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 410px;
          transform: translateY(210px);
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.4s ease;
        }

        .auth-m-signin {
          z-index: 2;
          opacity: 1;
          visibility: visible;
        }

        .auth-m-signup {
          z-index: 1;
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        .auth-m-container.bas-actif .auth-m-signin {
          transform: translateY(0);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.3s ease,
            visibility 0s linear 0.6s;
        }

        .auth-m-container.bas-actif .auth-m-signup {
          transform: translateY(0);
          opacity: 1;
          z-index: 5;
          pointer-events: auto;
          visibility: visible;
          transition:
            transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
            opacity 0.5s ease 0.15s,
            visibility 0s linear 0s;
        }

        .auth-m-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 210px;
          z-index: 100;
          overflow: hidden;
          background: linear-gradient(120deg, #031632 0%, #0d2a52 45%, #fb691a 150%);
          transition: transform 0.6s cubic-bezier(0.65, 0, 0.35, 1);
        }

        .auth-m-container.bas-actif .auth-m-overlay {
          transform: translateY(410px);
        }

        /* Les deux textes du panneau se relaient en fondu */
        .auth-m-panel {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 1.5rem;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.3s ease, visibility 0s linear 0.3s;
        }

        .auth-m-container:not(.bas-actif) .auth-m-panel-signup,
        .auth-m-container.bas-actif .auth-m-panel-login {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition: opacity 0.4s ease 0.25s, visibility 0s linear 0s;
        }
      `}</style>

      {/* ═══ Version desktop/tablette — panneau glissant ═══ */}
      <div className={`auth-container hidden sm:block ${modeInscription ? "right-active" : ""}`}>
        {/* ── Formulaire de connexion ── */}
        <div className="auth-form-container auth-sign-in-container">
          {otp?.origine === "connexion" ? (
            <EtapeOtp
              otp={otp}
              className="h-full flex flex-col items-center justify-center px-10 md:px-14"
              surSucces={apresConnexion}
              surRetour={() => setOtp(null)}
            />
          ) : (
            <form
              onSubmit={handleLogin}
              className="h-full flex flex-col items-center justify-center px-10 md:px-14"
            >
              <div className="w-full max-w-xs mx-auto">
                <h1 className="text-2xl font-bold text-primary mb-1 text-center">
                  Connexion
                </h1>
                <p className="text-sm text-on-surface-variant mb-6 text-center">
                  Content de te revoir sur DMAEDUCATION
                </p>

                {loginErreur && (
                  <div className="w-full bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5 mb-4">
                    {loginErreur}
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginChargement}
                  className="w-full mt-6 bg-[#fb691a] hover:bg-[#e35e16] text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  {loginChargement ? "Connexion..." : "Se connecter"}
                </button>

                <ZoneGoogle google={google} enCours={googleEnCours} />
              </div>
            </form>
          )}
        </div>

        {/* ── Formulaire d'inscription ── */}
        <div className="auth-form-container auth-sign-up-container">
          {otp?.origine === "inscription" ? (
            <EtapeOtp
              otp={otp}
              className="h-full flex flex-col items-center justify-center px-10 md:px-14 overflow-y-auto"
              surSucces={apresConnexion}
              surRetour={() => setOtp(null)}
            />
          ) : (
            <form
              onSubmit={handleRegister}
              className="h-full flex flex-col items-center justify-center px-10 md:px-14 overflow-y-auto"
            >
              <div className="w-full max-w-xs mx-auto">
                <h1 className="text-2xl font-bold text-primary mb-1 text-center">
                  Créer un compte
                </h1>
                <p className="text-sm text-on-surface-variant mb-6 text-center">
                  Rejoins la communauté DMAEDUCATION
                </p>

                {regErreur && (
                  <div className="w-full bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5 mb-4">
                    {regErreur}
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                  />
                  <input
                    type="email"
                    placeholder="E-mail"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regChargement}
                  className="w-full mt-6 bg-[#fb691a] hover:bg-[#e35e16] text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  {regChargement ? "Création..." : "Créer mon compte"}
                </button>

                <ZoneGoogle google={google} enCours={googleEnCours} inscription />
              </div>
            </form>
          )}
        </div>

        {/* ── Panneau coloré qui glisse par-dessus ── */}
        <div className="auth-overlay-container">
          <div className="auth-overlay">
            {/* Formes flottantes décoratives (effet "plus" demandé) */}
            <span
              className="absolute w-24 h-24 rounded-3xl bg-white/10"
              style={{ top: "12%", left: "10%", animation: "floatShape 6s ease-in-out infinite" }}
            />
            <span
              className="absolute w-16 h-16 rounded-full bg-[#fb691a]/30"
              style={{ bottom: "15%", right: "12%", animation: "floatShapeSlow 7s ease-in-out infinite" }}
            />
            <span
              className="absolute w-10 h-10 rounded-xl bg-white/10 rotate-45"
              style={{ top: "55%", right: "20%", animation: "floatShape 5s ease-in-out infinite" }}
            />

            <div className="auth-overlay-panel auth-overlay-left">
              <h1 className="text-2xl font-bold text-white mb-3">Déjà inscrit ?</h1>
              <p className="text-sm text-white/80 mb-7 leading-relaxed">
                Reconnecte-toi pour reprendre tes révisions là où tu les as
                laissées.
              </p>
              <button
                onClick={basculerVersConnexion}
                className="border-2 border-white text-white font-bold text-sm px-10 py-3 rounded-full hover:bg-white/10 transition-colors"
              >
                Se connecter
              </button>
            </div>

            <div className="auth-overlay-panel auth-overlay-right">
              <h1 className="text-2xl font-bold text-white mb-3">Nouveau ici ?</h1>
              <p className="text-sm text-white/80 mb-7 leading-relaxed">
                Crée ton compte et commence à réviser avec les vraies annales
                ESATIC dès maintenant.
              </p>
              <button
                onClick={basculerVersInscription}
                className="border-2 border-white text-white font-bold text-sm px-10 py-3 rounded-full hover:bg-white/10 transition-colors"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Version téléphone — même effet, mais le panneau glisse à la verticale ═══ */}
      <div className="sm:hidden w-full max-w-sm">
        <div className={`auth-m-container ${modeInscription ? "bas-actif" : ""}`}>
          {/* ── Connexion ── */}
          <div className="auth-m-form auth-m-signin">
            {otp?.origine === "connexion" ? (
              <EtapeOtp
                otp={otp}
                compact
                className="h-full flex flex-col items-center justify-center px-7"
                surSucces={apresConnexion}
                surRetour={() => setOtp(null)}
              />
            ) : (
              <form
                onSubmit={handleLogin}
                className="h-full flex flex-col items-center justify-center px-7"
              >
                <div className="w-full">
                  <h1 className="text-xl font-bold text-primary mb-1 text-center">
                    Connexion
                  </h1>
                  <p className="text-xs text-on-surface-variant mb-4 text-center">
                    Content de te revoir sur DMAEDUCATION
                  </p>

                  {loginErreur && (
                    <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-3">
                      {loginErreur}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Nom d'utilisateur"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                    />
                    <input
                      type="password"
                      placeholder="Mot de passe"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginChargement}
                    className="w-full mt-4 bg-[#fb691a] hover:bg-[#e35e16] text-white font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {loginChargement ? "Connexion..." : "Se connecter"}
                  </button>

                  <ZoneGoogle google={google} enCours={googleEnCours} compact />
                </div>
              </form>
            )}
          </div>

          {/* ── Inscription ── */}
          <div className="auth-m-form auth-m-signup">
            {otp?.origine === "inscription" ? (
              <EtapeOtp
                otp={otp}
                compact
                className="h-full flex flex-col items-center justify-center px-7"
                surSucces={apresConnexion}
                surRetour={() => setOtp(null)}
              />
            ) : (
              <form
                onSubmit={handleRegister}
                className="h-full flex flex-col items-center justify-center px-7"
              >
                <div className="w-full">
                  <h1 className="text-xl font-bold text-primary mb-1 text-center">
                    Créer un compte
                  </h1>
                  <p className="text-xs text-on-surface-variant mb-4 text-center">
                    Rejoins la communauté DMAEDUCATION
                  </p>

                  {regErreur && (
                    <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-3">
                      {regErreur}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Nom d'utilisateur"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                    />
                    <input
                      type="email"
                      placeholder="E-mail"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                    />
                    <input
                      type="password"
                      placeholder="Mot de passe"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={regChargement}
                    className="w-full mt-4 bg-[#fb691a] hover:bg-[#e35e16] text-white font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {regChargement ? "Création..." : "Créer mon compte"}
                  </button>

                  <ZoneGoogle google={google} enCours={googleEnCours} inscription compact />
                </div>
              </form>
            )}
          </div>

          {/* ── Panneau coloré qui coulisse de haut en bas ── */}
          <div className="auth-m-overlay">
            <span
              className="absolute w-16 h-16 rounded-2xl bg-white/10"
              style={{ top: "12%", left: "8%", animation: "floatShape 6s ease-in-out infinite" }}
            />
            <span
              className="absolute w-12 h-12 rounded-full bg-[#fb691a]/30"
              style={{ bottom: "12%", right: "10%", animation: "floatShapeSlow 7s ease-in-out infinite" }}
            />
            <span
              className="absolute w-8 h-8 rounded-lg bg-white/10 rotate-45"
              style={{ top: "20%", right: "22%", animation: "floatShape 5s ease-in-out infinite" }}
            />

            {/* Visible en mode connexion */}
            <div className="auth-m-panel auth-m-panel-signup">
              <h2 className="text-xl font-bold text-white mb-2">Nouveau ici ?</h2>
              <p className="text-xs text-white/80 mb-4 leading-relaxed">
                Crée ton compte et révise avec les vraies annales ESATIC.
              </p>
              <button
                onClick={basculerVersInscription}
                className="border-2 border-white text-white font-bold text-sm px-8 py-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                Créer un compte
              </button>
            </div>

            {/* Visible en mode inscription */}
            <div className="auth-m-panel auth-m-panel-login">
              <h2 className="text-xl font-bold text-white mb-2">Déjà inscrit ?</h2>
              <p className="text-xs text-white/80 mb-4 leading-relaxed">
                Reconnecte-toi pour reprendre tes révisions.
              </p>
              <button
                onClick={basculerVersConnexion}
                className="border-2 border-white text-white font-bold text-sm px-8 py-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                Se connecter
              </button>
            </div>
          </div>
        </div>

        <Link
          to="/"
          className="block text-center text-xs text-on-surface-variant mt-5 hover:text-primary"
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}