// src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    try {
      await login(username, password);
      navigate("/library");
    } catch (err) {
      setErreur("Identifiants incorrects. Vérifie ton nom d'utilisateur et ton mot de passe.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-surface-container-low flex items-center justify-center p-4 md:p-8 font-body-md text-on-surface overflow-hidden relative">
      <style>{`
        .clay-card {
          background: #F4F7FA;
          border: 1px solid #E2E8F0;
          box-shadow: 8px 8px 16px rgba(3, 22, 50, 0.05), -8px -8px 16px rgba(255, 255, 255, 0.8);
        }
        .clay-input {
          background: #F4F7FA;
          border: 1px solid #E2E8F0;
          box-shadow: inset 4px 4px 8px rgba(3, 22, 50, 0.05), inset -4px -4px 8px rgba(255, 255, 255, 0.8);
          transition: all 0.2s ease;
        }
        .clay-input:focus {
          outline: none;
          box-shadow: inset 4px 4px 8px rgba(3, 22, 50, 0.1), inset -4px -4px 8px rgba(255, 255, 255, 0.9), 0 0 0 2px rgba(182, 199, 235, 0.4);
        }
        .clay-btn-primary {
          background-color: #fc8a40;
          color: white;
          box-shadow: 0 4px 10px rgba(252, 138, 64, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.5);
          border-bottom: 2px solid #9b4500;
          transition: all 0.1s ease;
        }
        .clay-btn-primary:active {
          transform: translateY(2px);
          border-bottom-width: 0;
          box-shadow: inset 0 4px 8px rgba(155, 69, 0, 0.4);
        }
        .clay-btn-outline {
          border: 2px solid white;
          color: white;
          transition: all 0.2s ease;
        }
        .clay-btn-outline:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .floating-shape { animation: float 6s ease-in-out infinite; }
        .floating-shape-reverse { animation: float-reverse 8s ease-in-out infinite; }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes float-reverse {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-10deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
      `}</style>

      {/* Décor de fond */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary-fixed opacity-30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary-fixed opacity-40 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 left-1/4 w-16 h-16 bg-surface-variant rounded-xl rotate-12 floating-shape clay-card backdrop-blur-sm opacity-60"></div>
        <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-surface-container-highest rounded-full floating-shape-reverse clay-card backdrop-blur-sm opacity-50"></div>
        <div className="absolute top-1/2 right-[8%] w-12 h-12 bg-primary-fixed-dim rounded-lg -rotate-12 floating-shape clay-card backdrop-blur-sm opacity-70"></div>
      </div>

      <main className="w-full max-w-[1000px] clay-card rounded-[24px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative z-10">
        {/* Panneau gauche - Bienvenue */}
        <section className="w-full md:w-2/5 bg-primary-container text-on-primary p-8 md:p-12 flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-primary opacity-50 rounded-full blur-2xl"></div>
          <div className="absolute bottom-[-100px] left-[-50px] w-64 h-64 bg-surface-tint opacity-30 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col items-center">
            <img
              src="/momoli.png"
              alt="DMAEducation"
              className="w-16 h-16 mb-8 rounded-xl bg-white p-1 shadow-md object-contain"
            />
            <h1 className="font-display-lg-mobile md:font-headline-md text-on-primary mb-4 font-bold">
              Content de te revoir&nbsp;!
            </h1>
            <p className="font-body-md text-on-primary-container mb-12 max-w-xs">
              Pas encore de compte ? Rejoins DMAEducation en quelques secondes et commence à progresser.
            </p>
            <Link
              to="/register"
              className="clay-btn-outline rounded-full py-3 px-12 font-label-sm uppercase tracking-wider"
            >
              Créer un compte
            </Link>
          </div>
        </section>

        {/* Panneau droit - Formulaire de connexion */}
        <section className="w-full md:w-3/5 bg-surface-container-lowest p-8 md:p-16 flex flex-col justify-center items-center">
          <h2 className="font-display-lg-mobile md:font-headline-md text-primary mb-2 font-bold">
            Connexion
          </h2>
          <p className="font-label-sm text-on-surface-variant mb-8 text-center opacity-70">
            Entre tes identifiants pour accéder à ton espace
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Nom d'utilisateur"
                className="clay-input w-full pl-12 pr-4 py-3 rounded-xl font-body-md text-on-surface placeholder-on-surface-variant border-none focus:ring-0"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mot de passe"
                className="clay-input w-full pl-12 pr-12 py-3 rounded-xl font-body-md text-on-surface placeholder-on-surface-variant border-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {erreur && (
              <div className="bg-red-50 text-error text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {erreur}
              </div>
            )}

            <div className="flex justify-end -mt-1">
              <a href="#" className="font-label-sm text-[13px] text-secondary hover:underline">
                Mot de passe oublié ?
              </a>
            </div>

            <button
              type="submit"
              disabled={chargement}
              className="clay-btn-primary rounded-full py-4 px-8 font-label-sm uppercase tracking-wider self-center w-48 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {chargement ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default Login;