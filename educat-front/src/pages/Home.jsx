// src/pages/Home.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProgressChart from "../components/ProgressChart";
import Header from "../components/Header";
import VideoAuto from "../components/VideoAuto";
import Reveal from "../components/Reveal";

// Fait défiler la page jusqu'à une section (en douceur)
function allerA(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Home() {
  const { isAuthenticated, user, logout } = useAuth();

  const lueurRef = useRef(null); // halo du héro (léger effet de profondeur)
  const [afficherHaut, setAfficherHaut] = useState(false); // bouton « remonter »

  // Un seul écouteur de défilement pour : l'effet de profondeur du héro et
  // l'apparition du bouton « remonter ». Les mises à jour
  // passent par requestAnimationFrame (au plus une par image) et modifient le style
  // directement : la page n'est pas redessinée à chaque pixel de défilement.
  useEffect(() => {
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    let raf = 0;

    const mettreAJour = () => {
      raf = 0;
      const y = window.scrollY;

      if (lueurRef.current && !reduit) {
        lueurRef.current.style.transform = `translate3d(0, ${Math.min(y, 800) * 0.18}px, 0)`;
      }
      setAfficherHaut(y > 600);
    };

    const surDefilement = () => {
      if (!raf) raf = requestAnimationFrame(mettreAJour);
    };

    mettreAJour();
    window.addEventListener("scroll", surDefilement, { passive: true });
    window.addEventListener("resize", surDefilement);
    return () => {
      window.removeEventListener("scroll", surDefilement);
      window.removeEventListener("resize", surDefilement);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <style>{`
        .clay-shadow {
          box-shadow: inset 2px 2px 8px rgba(255,255,255,0.8), inset -2px -2px 8px rgba(3,22,50,0.05), 0 8px 32px -4px rgba(3,22,50,0.1);
        }
        .clay-button-shadow {
          box-shadow: 0 4px 12px rgba(252,138,64,0.3), 0 2px 0 #9b4500;
        }
        .clay-button-shadow:active {
          box-shadow: 0 2px 4px rgba(252,138,64,0.2), 0 0 0 #9b4500;
          transform: translateY(2px);
        }
        .clay-card {
          background-color: #F4F7FA;
          border: 1px solid #e0e3e6;
        }
        /* Même fond pointillé que Library.jsx et About.jsx, pour une identité visuelle cohérente */
        .bg-pattern {
          background-image: radial-gradient(#d8e3fa 1px, transparent 1px);
          background-size: 20px 20px;
        }
        /* Variante claire du motif, pour un fond sombre (héro bleu marine) */
        .bg-pattern-dark {
          background-image: radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        /* La mascotte "respire" : flottement très lent et très léger */
        @keyframes respirer {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.015); }
        }
        .respirer { animation: respirer 7s ease-in-out infinite; }

        /* La flèche « Découvrir » invite à descendre */
        @keyframes indiceBas {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(6px); opacity: 1; }
        }
        .indice-defilement { animation: indiceBas 1.8s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .respirer, .indice-defilement { animation: none !important; }
        }
      `}</style>

     {/* HEADER COMMUN DE L'APPLICATION */}
      <Header current="quiz" />

      {/* Main Content */}
      <main className="flex-grow bg-pattern">
        {/* Hero Section */}
        <section className="bg-primary-container text-on-primary w-full overflow-hidden relative">
          <div
            ref={lueurRef}
            className="absolute inset-0 opacity-10 pointer-events-none will-change-transform"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 50%)" }}
          ></div>
          <div className="absolute inset-0 bg-pattern-dark pointer-events-none"></div>
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-32 grid grid-cols-1 md:grid-cols-2 gap-gutter items-center relative z-10">
            {/* Le texte arrive depuis la gauche, un élément après l'autre */}
            <div className="space-y-8 text-center md:text-left z-20">
              <Reveal from="left">
                <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg font-bold text-on-primary">
                  Préparez votre concours en vous amusant avec  DMA<span className="text-[#fb691a]">EDUCATION</span>
                </h1>
              </Reveal>
              <Reveal from="left" delay={120}>
                <p className="font-body-lg text-body-lg text-on-primary-container max-w-lg mx-auto md:mx-0">
                  Entraînez-vous sur de vraies questions d'annales en mathématiques, physique, informatique, anglais et français. Un quiz ne prend que quelques minutes : chaque réponse est corrigée et expliquée, et votre score vous montre où vous progressez.
                </p>
              </Reveal>
              <Reveal from="left" delay={240}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  {/* Redirige vers la config du quiz si connecté, sinon vers la connexion */}
                  <Link
                    to={isAuthenticated ? "/quiz/demarrer" : "/login"}
                    className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-8 py-4 rounded-xl font-bold clay-button-shadow transition-all duration-150 text-lg flex items-center justify-center gap-2"
                  >
                    Commencer un Quiz
                    <span className="material-symbols-outlined">play_arrow</span>
                  </Link>
                  <Link to="/library" className="bg-surface/10 text-on-primary border border-on-primary/20 hover:bg-surface/20 font-label-sm text-label-sm px-8 py-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                    Explorer la Bibliothèque
                  </Link>
                </div>
              </Reveal>
              <Reveal from="left" delay={360}>
                <p className="font-label-sm text-label-sm text-on-primary/70">
                  Compte gratuit · Quiz libres ou chronométrés · Licence, Master, Ingénieur
                </p>
              </Reveal>
            </div>

            {/* La mascotte arrive depuis la droite, puis "respire" doucement */}
            <div className="relative z-10 flex justify-center md:justify-end mt-12 md:mt-0">
              <Reveal from="right" delay={200} distance={60} className="w-full max-w-md">
                <div className="respirer">
                  {/* Owl Mascot Video */}
                  <div className="relative w-full aspect-square rounded-[40px] clay-shadow overflow-hidden bg-surface-container-highest p-4 flex items-center justify-center">
                    <VideoAuto
                      className="w-full h-full object-contain rounded-[40px] drop-shadow-2xl z-10"
                      src="/masco.mp4"
                      aria-label="Mascotte EduQuiz : un hibou 3D animé avec un chapeau de graduation tenant une tablette"
                    />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Invitation à descendre vers la suite */}
          <button
            type="button"
            onClick={() => allerA("approche")}
            aria-label="Découvrir la suite de la page"
            className="absolute bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-on-primary/70 hover:text-on-primary transition-colors"
          >
            <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em]">Voir comment ça marche</span>
            <span className="material-symbols-outlined indice-defilement">keyboard_arrow_down</span>
          </button>
        </section>

{/* Features Section */}
<section id="approche" className="scroll-mt-20 py-24 md:py-32 bg-surface bg-pattern relative overflow-hidden">

  <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
    <div className="text-center mb-20 space-y-5">
      <Reveal from="up">
        <span className="inline-flex items-center gap-2 text-secondary font-label-sm text-label-sm font-bold tracking-wide uppercase">
          <span className="w-6 h-px bg-[#fb691a]"></span>
          <h3 className="text-[#fb691a]">Notre approche</h3>
          <span className="w-6 h-px bg-[#fb691a]"></span>
        </span>
      </Reveal>
      <Reveal from="up" delay={100}>
        <h2 className="font-headline-md text-headline-md md:text-[36px] md:leading-[44px] text-primary font-bold">
          Pourquoi choisir DMA<span className="text-[#fb691a]">EDUCATION</span> ?
        </h2>
      </Reveal>
      <Reveal from="up" delay={200}>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Relire ses cours ne suffit pas pour savoir si l'on est prêt. Ici, vous vous testez sur les questions qui tombent vraiment au concours et vous voyez tout de suite ce qu'il vous reste à travailler. Voici ce qui vous attend.
        </p>
      </Reveal>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Carte principale - large avec graphique : arrive depuis la gauche */}
      <Reveal from="left" distance={60} className="md:col-span-2 md:row-span-2">
        <div className="h-full clay-card rounded-[32px] p-10 clay-shadow relative overflow-hidden flex flex-col justify-between min-h-[340px] group transition-shadow duration-300 hover:shadow-[0_16px_48px_-8px_rgba(3,22,50,0.18)]">
          <div className="relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-[#fb691a] from-secondary-container to-secondary flex items-center justify-center mb-6 shadow-[0_6px_16px_-4px_rgba(252,138,64,0.5)]">
              <span className="material-symbols-outlined text-white text-2xl">trending_up</span>
            </div>
            <h3 className="font-headline-md text-[22px] leading-tight text-primary font-bold mb-3">
              Une progression que vous pouvez voir
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
              Chaque quiz terminé s'ajoute à votre historique. Vous repérez vos matières fortes, celles à retravailler, et vous voyez vos résultats monter session après session.
            </p>
          </div>

          {/* Vrai graphique en courbe (SVG) */}
          <div className="relative z-10 mt-8">
           <div className="relative z-10 mt-8">
              <ProgressChart />
           </div>
          </div>
        </div>
      </Reveal>

      {/* Carte secondaire 1 : monte depuis le bas */}
      <Reveal from="up" delay={150}>
        <div className="h-full clay-card rounded-[32px] p-8 clay-shadow flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-8px_rgba(3,22,50,0.15)]">
          <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">extension</span>
          </div>
          <h3 className="font-headline-md text-[20px] leading-tight text-primary font-bold mb-2">
            Des quiz à votre rythme
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Choisissez une matière, un niveau et un mode : entraînement libre pour apprendre tranquillement, ou chronométré pour vous mettre dans les conditions du concours.
          </p>
        </div>
      </Reveal>

      {/* Carte secondaire 2 : monte depuis le bas, juste après la précédente */}
      <Reveal from="up" delay={300}>
        <div className="h-full clay-card rounded-[32px] p-8 clay-shadow flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-8px_rgba(3,22,50,0.15)]">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-tertiary text-2xl">groups</span>
          </div>
          <h3 className="font-headline-md text-[20px] leading-tight text-primary font-bold mb-2">
            Vous n'êtes pas seul
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Rejoignez les candidats qui préparent les mêmes concours que vous et révisez sur les mêmes sujets qu'eux.
          </p>
        </div>
      </Reveal>
    </div>

    {/* Appel à l'action de fin de page */}
    <Reveal from="up" delay={150}>
      <div className="mt-16 text-center space-y-5">
        <h3 className="font-headline-md text-[22px] leading-tight text-primary font-bold">
          Prêt à vous tester ?
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto">
          Votre premier quiz prend moins de cinq minutes. Choisissez une matière et découvrez votre niveau dès maintenant.
        </p>
        <Link
          to="/library"
          className="inline-flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-8 py-4 rounded-xl font-bold clay-button-shadow transition-all duration-150 text-lg"
        >
          Choisir une matière
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </div>
    </Reveal>
  </div>
</section>
      </main>

      {/* Footer */}
      <footer className="bg-primary bg-pattern-dark text-on-primary w-full mt-auto">
        <Reveal from="up" distance={24}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto border-t border-on-primary/10">
            <div className="flex flex-col gap-4">
               <Link to="/" className="flex items-center ">
              <h1 className="font-sans font-bold text-xl h-10 ">DMA<span className="text-[#fb691a]">EDUCATION</span></h1>
              </Link>
              <p className="font-body-md text-body-md text-on-primary/80">© 2026 DMAEDUCATION.</p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end md:gap-8">
              <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">Confidentialité</a>
              <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">Conditions</a>
              <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">Aide</a>
              <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">Contact</a>
            </div>
          </div>
        </Reveal>
      </footer>

      {/* Bouton « remonter » : apparaît quand on a bien défilé */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Remonter en haut de la page"
        aria-hidden={!afficherHaut}
        tabIndex={afficherHaut ? 0 : -1}
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-300 active:scale-95 ${
          afficherHaut ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(135deg, #fb691a 0%, #d4540f 100%)" }}
      >
        <span className="material-symbols-outlined">keyboard_arrow_up</span>
      </button>
    </div>
  );
}

export default Home;