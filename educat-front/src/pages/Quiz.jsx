import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";

export default function Quiz() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <style>{`
        .clay-shadow {
          box-shadow: inset 2px 2px 8px rgba(255,255,255,0.8), inset -2px -2px 8px rgba(3,22,50,0.05), 0 8px 32px -4px rgba(3,22,50,0.1);
        }
        .clay-button-shadow {
          box-shadow: 0 4px 12px rgba(252,138,64,0.3), 0 2px 0 #9b4500;
          transition: all 0.1s ease;
        }
        .clay-button-shadow:active {
          box-shadow: 0 2px 4px rgba(252,138,64,0.2), 0 0 0 #9b4500;
          transform: translateY(2px);
        }
        .clay-card {
          background-color: #F4F7FA;
          border: 1px solid #e0e3e6;
        }
        /* Même fond pointillé que Home.jsx, Library.jsx et About.jsx */
        .bg-pattern {
          background-image: radial-gradient(#d8e3fa 1px, transparent 1px);
          background-size: 20px 20px;
        }
        /* Variante claire du motif, pour un fond sombre (héro bleu marine) */
        .bg-pattern-dark {
          background-image: radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>

      {/* Header commun de l'application */}
      <Header current="quiz" />

      {/* Main Content */}
      <main className="flex-grow bg-pattern">
        {/* Hero Section */}
        <section className="bg-primary-container text-on-primary w-full overflow-hidden relative">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 50%)",
            }}
          />
          <div className="absolute inset-0 bg-pattern-dark pointer-events-none" />
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-32 grid grid-cols-1 md:grid-cols-2 gap-gutter items-center relative z-10">
            <div className="space-y-8 text-center md:text-left z-20">
              <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg font-bold text-on-primary">
                Apprenez en vous amusant avec{" "}
                <span className="text-secondary-fixed">DMAEDUCATION</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-primary-container max-w-lg mx-auto md:mx-0">
                Transformez vos sessions de révision en défis interactifs.
                Découvrez une nouvelle façon d'apprendre, de tester vos
                connaissances et d'atteindre vos objectifs pour les concours
                INPHB et ESATIC.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Link
                  to={isAuthenticated ? "/quiz/demarrer" : "/login"}
                  className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-8 py-4 rounded-xl font-bold clay-button-shadow transition-all duration-150 text-lg flex items-center justify-center gap-2"
                >
                  Commencer un Quiz
                  <span className="material-symbols-outlined">play_arrow</span>
                </Link>
                <Link
                  to="/library"
                  className="bg-surface/10 text-on-primary border border-on-primary/20 hover:bg-surface/20 font-label-sm text-label-sm px-8 py-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Explorer la librairie
                </Link>
              </div>
            </div>

            <div className="relative z-10 flex justify-center md:justify-end mt-12 md:mt-0">
              {/* Owl Mascot Video */}
              <div className="relative w-full max-w-md aspect-square rounded-[40px] clay-shadow overflow-hidden bg-surface-container-highest p-4 flex items-center justify-center">
                <video
                  className="w-full h-full object-contain drop-shadow-2xl z-10"
                  src="/masco.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Mascotte EduQuiz : un hibou 3D animé avec un chapeau de graduation tenant une tablette"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section (Bento Grid) */}
        <section className="py-24 bg-surface max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-headline-md text-headline-md text-primary font-bold">
              Pourquoi choisir EduQuiz ?
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              Une approche tangible de la préparation aux concours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            {/* Feature 1 */}
            <div className="md:col-span-2 clay-card rounded-[32px] p-8 clay-shadow relative overflow-hidden flex flex-col justify-end group">
              <div className="relative z-10 bg-surface/80 backdrop-blur-md p-6 rounded-2xl w-full max-w-md border border-white/50">
                <div className="bg-secondary-container/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-secondary">
                    trending_up
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-2">
                  Progression Tangible
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Suivez votre progression pas à pas, matière par matière.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="clay-card rounded-[32px] p-8 clay-shadow flex flex-col hover:translate-y-[-4px] transition-transform duration-300">
              <div className="bg-primary-container/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-auto">
                <span className="material-symbols-outlined text-primary text-3xl">
                  extension
                </span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-3">
                  Apprentissage Interactif
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  QCM et exercices tirés des vraies annales de concours.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="clay-card rounded-[32px] p-8 clay-shadow flex flex-col hover:translate-y-[-4px] transition-transform duration-300">
              <div className="bg-tertiary-container/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-auto">
                <span className="material-symbols-outlined text-tertiary text-3xl">
                  groups
                </span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-3">
                  Communauté Active
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Rejoignez d'autres candidats et partagez vos contributions.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="md:col-span-2 clay-card rounded-[32px] p-8 clay-shadow bg-surface-container-low flex flex-col md:flex-row items-center gap-8 border-none ring-1 ring-outline-variant/30">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full text-sm font-semibold text-primary shadow-sm border border-surface-dim">
                  <span className="w-2 h-2 rounded-full bg-secondary-container" />
                  Nouveau
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold">
                  Statistiques Détaillées
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Visualisez vos performances avec des graphiques clairs.
                </p>
              </div>
              <div className="flex-1 w-full relative h-48 bg-white rounded-2xl clay-shadow p-6 flex flex-col justify-between">
                <div className="flex justify-between items-end h-full gap-2 px-4 pb-2 border-b-2 border-surface-container-high">
                  <div className="w-full bg-surface-container-high rounded-t-lg h-[40%]" />
                  <div className="w-full bg-secondary-container rounded-t-lg h-[80%] shadow-[0_0_15px_rgba(252,138,64,0.3)]" />
                  <div className="w-full bg-surface-container-high rounded-t-lg h-[60%]" />
                  <div className="w-full bg-surface-container-high rounded-t-lg h-[90%]" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-on-primary w-full mt-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto border-t border-on-primary/10">
          <div className="flex flex-col gap-4">
            <span className="font-headline-md text-headline-md text-on-primary font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">
                school
              </span>
              EduQuiz
            </span>
            <p className="font-body-md text-body-md text-on-primary/80">
              © 2026 EduQuiz. Apprendre en s'amusant.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end md:gap-8">
            <Link
              to="/about"
              className="font-label-sm text-label-sm text-on-primary/80 hover:text-on-primary hover:opacity-80 transition-all"
            >
              À propos
            </Link>
            <a
              href="mailto:diarrassoubamohamedaliou@gmail.com"
              className="font-label-sm text-label-sm text-on-primary/80 hover:text-on-primary hover:opacity-80 transition-all"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}