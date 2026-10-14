// src/components/Header.jsx
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LIENS_MOBILE = [
  { to: "/quiz", cle: "quiz", label: "Quiz", icone: "quiz" },
  { to: "/library", cle: "library", label: "Library", icone: "menu_book" },
  { to: "/about", cle: "about", label: "About", icone: "info" },
];

// "current" indique quel lien doit apparaître actif (souligné/orange).
// Valeurs possibles : "quiz" | "library" | "community" | "about" | "profile" | "dashboard"
// "masquerMobile" cache le header sur petit écran (utilisé par la page profil,
// qui a son propre bouton de retour sur téléphone).
export default function Header({ current, masquerMobile = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const conteneurRef = useRef(null);

  // Ferme le menu au clic en dehors du bouton/panneau (comportement dropdown
  // classique, pas de fond plein écran à fermer).
  useEffect(() => {
    function surClicExterieur(e) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
        setMenuOuvert(false);
      }
    }
    if (menuOuvert) {
      document.addEventListener("mousedown", surClicExterieur);
    }
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [menuOuvert]);

  const lienClasse = (cle) =>
    current === cle
      ? "text-[#fb691a] font-sans font-bold border-b-2 border-[#fb691a] pb-1"
      : "text-on-surface-variant font-sans font-bold hover:text-primary transition-colors";

  function fermerMenu() {
    setMenuOuvert(false);
  }

  return (
    <header
      className={`w-full top-0 sticky bg-surface shadow-[0_4px_20px_-2px_rgba(3,22,50,0.1)] z-50 ${
        masquerMobile ? "hidden md:block" : ""
      }`}
    >
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Fond légèrement flouté derrière le dropdown — cliquable pour fermer */}
      {menuOuvert && (
        <div
          className="md:hidden fixed inset-0 bg-primary/10 backdrop-blur-[2px] z-40"
          style={{ animation: "fadeInBackdrop 0.2s ease-out" }}
          onClick={fermerMenu}
        />
      )}

      <div className="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Link to="/" className="flex items-center" onClick={fermerMenu}>
          <img
            src="/MOO.png"
            alt="DMAEducation"
            className="h-16 md:h-20 w-auto object-contain block"
          />
          <h1 className="font-sans font-bold text-lg md:text-xl h-15">
            DMA<span className="text-[#fb691a]">EDUCATION</span>
          </h1>
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/quiz" className={lienClasse("quiz")}>Quiz</Link>
          <Link to="/library" className={lienClasse("library")}>Bibliothèque</Link>
          {/* <Link to="/community" className={lienClasse("community")}>Community</Link> */}
          <Link to="/about" className={lienClasse("about")}>A Propos</Link>
          {isAuthenticated && (
            <Link to="/profile" className={lienClasse("profile")}>Profil</Link>
          )}
          {/* Visible uniquement par les administrateurs */}
          {isAuthenticated && user?.est_admin && (
            <Link to="/dashboard" className={lienClasse("dashboard")}>Tableau de bord</Link>
          )}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="w-px h-6 bg-outline-variant/40" aria-hidden="true" />
              <button
                onClick={logout}
                className="bg-secondary-container text-on-secondary-container font-sans px-6 py-2 rounded-lg font-bold clay-button-shadow transition-all duration-150"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-on-surface-variant hover:text-primary font-sans font-bold transition-colors active:scale-95"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="bg-secondary-container text-on-secondary-container font-sans px-6 py-2 rounded-lg font-bold clay-button-shadow transition-all duration-150"
              >
               Créer un compte
              </Link>
            </>
          )}
        </div>

        {/* ═══ Bouton burger rond + dropdown — mobile uniquement ═══ */}
        <div className="md:hidden relative z-50" ref={conteneurRef}>
          <button
            onClick={() => setMenuOuvert((v) => !v)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-200 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #fb691a 0%, #d4540f 100%)",
              transform: menuOuvert ? "rotate(90deg)" : "rotate(0deg)",
            }}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOuvert}
          >
            <span
              className="material-symbols-outlined text-2xl transition-transform duration-200"
              style={{ transform: menuOuvert ? "rotate(-90deg)" : "rotate(0deg)" }}
            >
              {menuOuvert ? "close" : "menu"}
            </span>
          </button>

          {/* Dropdown ancré sous le bouton */}
          {menuOuvert && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 py-2 z-50"
              style={{ animation: "dropdownIn 0.15s ease-out" }}
            >
              {/* Liens de navigation */}
              <nav className="px-2">
                {LIENS_MOBILE.map((lien) => {
                  const actif = current === lien.cle;
                  return (
                    <Link
                      key={lien.cle}
                      to={lien.to}
                      onClick={fermerMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm transition-colors ${
                        actif
                          ? "text-[#fb691a] bg-surface-container-low"
                          : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          actif ? "text-[#fb691a]" : "text-on-surface-variant"
                        }`}
                      >
                        {lien.icone}
                      </span>
                      {lien.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="my-2 border-t border-outline-variant/20" />

              {/* Compte */}
              <div className="px-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={fermerMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm transition-colors ${
                        current === "profile"
                          ? "text-[#fb691a] bg-surface-container-low"
                          : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          current === "profile" ? "text-[#fb691a]" : "text-on-surface-variant"
                        }`}
                      >
                        person
                      </span>
                      Mon profil
                    </Link>

                    {/* Visible uniquement par les administrateurs */}
                    {user?.est_admin && (
                      <Link
                        to="/dashboard"
                        onClick={fermerMenu}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm transition-colors ${
                          current === "dashboard"
                            ? "text-[#fb691a] bg-surface-container-low"
                            : "text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-xl ${
                            current === "dashboard" ? "text-[#fb691a]" : "text-on-surface-variant"
                          }`}
                        >
                          monitoring
                        </span>
                        Dashboard
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        fermerMenu();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm text-[#fb691a] hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">logout</span>
                      Déconnexion
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={fermerMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl text-on-surface-variant">
                        login
                      </span>
                      Se connecter
                    </Link>
                    <Link
                      to="/register"
                      onClick={fermerMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans font-bold text-sm text-[#fb691a] hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">person_add</span>
                      Créer un compte
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}