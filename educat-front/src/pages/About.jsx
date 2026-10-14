// src/pages/About.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import VideoAuto from "../components/VideoAuto";
import Reveal from "../components/Reveal";

export default function About() {
  const [afficherHaut, setAfficherHaut] = useState(false); // bouton « remonter »

  // Le bouton « remonter » apparaît quand on a bien défilé (au plus une mise à jour par image)
  useEffect(() => {
    let raf = 0;
    const mettreAJour = () => {
      raf = 0;
      setAfficherHaut(window.scrollY > 600);
    };
    const surDefilement = () => {
      if (!raf) raf = requestAnimationFrame(mettreAJour);
    };
    mettreAJour();
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", surDefilement);
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
        .clay-icon-container {
          box-shadow:
            inset 1px 1px 3px rgba(255,255,255,0.8),
            inset -1px -1px 3px rgba(0,0,0,0.08),
            0 4px 10px rgba(3,22,50,0.08);
        }
        .bg-pattern {
          background-image: radial-gradient(#d8e3fa 1px, transparent 1px);
          background-size: 20px 20px;
        }

        /* La vidéo "respire" : flottement très lent et très léger */
        @keyframes respirer {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.015); }
        }
        .respirer { animation: respirer 7s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .respirer { animation: none !important; }
        }
      `}</style>

      <Header current="about" />

      <main className="flex-grow overflow-x-clip">
        {/* ── Hero avec vidéo ── */}
        <header className="relative pt-16 pb-16 md:pt-20 md:pb-20 px-margin-mobile md:px-margin-desktop bg-pattern">
          <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 text-center md:text-left">
              <Reveal from="left">
                <div className="inline-flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full clay-icon-container">
                  <span
                    className="material-symbols-outlined text-[#fb691a]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                  <span className="font-sans font-bold text-sm text-primary">
                    La pédagogie DMAEDUCATION
                  </span>
                </div>
              </Reveal>

              <Reveal from="left" delay={100}>
                <h1 className="font-headline-md text-headline-md md:text-[40px] md:leading-[48px] text-primary font-bold">
                  Un apprentissage pensé pour l'étudiant moderne.
                </h1>
              </Reveal>

              <Reveal from="left" delay={200}>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto md:mx-0">
                  Nous pensons que réviser devrait être aussi stimulant qu'efficace.
                  En combinant rigueur pédagogique et expérience interactive, nous
                  transformons la préparation aux concours en un parcours motivant,
                  matière après matière.
                </p>
              </Reveal>

              <Reveal from="left" delay={300}>
                <Link
                  to="/library"
                  className="bg-secondary-container text-on-secondary-container font-sans font-bold px-8 py-4 rounded-lg clay-button-shadow mt-4 inline-flex items-center gap-2"
                >
                  Essayez par vous-même
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              </Reveal>
            </div>

            <div className="flex-1 relative w-full max-w-md aspect-square md:h-[460px]">
              <Reveal from="right" delay={200} distance={60} className="w-full h-full">
                <div className="respirer w-full h-full">
                  <div className="clay-card rounded-[32px] clay-shadow p-2 w-full h-full overflow-hidden">
                    <VideoAuto
                      className="w-full h-full object-cover rounded-[24px]"
                      src="/girl.mp4"
                      aria-label="Présentation de DMAEducation"
                    />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </header>

        {/* ── Contenu ── */}
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-20 space-y-24">
          {/* ── Notre mission ── */}
          <section id="mission" className="scroll-mt-20 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <Reveal from="left" distance={60} className="order-2 md:order-1">
              <div className="clay-card clay-shadow rounded-[32px] p-2 aspect-square overflow-hidden">
                <img
                  src="https://images.pexels.com/photos/31869847/pexels-photo-31869847.jpeg"
                  alt="Étudiant en pleine révision"
                  className="w-full h-full object-cover rounded-[24px]"
                />
              </div>
            </Reveal>

            <div className="order-1 md:order-2 space-y-6">
              <Reveal from="right">
                <h2 className="font-headline-md text-headline-md text-primary font-bold">
                  Notre mission : un savoir tangible
                </h2>
              </Reveal>
              <Reveal from="right" delay={100}>
                <div className="w-12 h-1 bg-[#fb691a] rounded-full" />
              </Reveal>
              <Reveal from="right" delay={150}>
                <p className="text-on-surface-variant">
                  Chez DMAEDUCATION, notre mission est de rendre les concepts abstraits
                  concrets. Nous misons sur un apprentissage structuré, où chaque
                  module te rapproche visiblement de ton objectif.
                </p>
              </Reveal>
              <Reveal from="right" delay={250}>
                <p className="text-on-surface-variant">
                  Un design clair, des espaces aérés et un suivi précis de ta
                  progression : tout est pensé pour réduire la charge mentale et
                  nourrir un vrai sentiment d'accomplissement à chaque révision.
                </p>
              </Reveal>
              <ul className="space-y-4 mt-6">
                <Reveal as="li" from="right" delay={350} className="flex items-start gap-3">
                  <div className="mt-1 bg-surface-container-high rounded-full p-1 clay-icon-container">
                    <span className="material-symbols-outlined text-[#fb691a] text-sm">
                      check
                    </span>
                  </div>
                  <span className="text-on-surface">
                    Réduire la charge mentale grâce à un design clair et épuré.
                  </span>
                </Reveal>
                <Reveal as="li" from="right" delay={450} className="flex items-start gap-3">
                  <div className="mt-1 bg-surface-container-high rounded-full p-1 clay-icon-container">
                    <span className="material-symbols-outlined text-[#fb691a] text-sm">
                      check
                    </span>
                  </div>
                  <span className="text-on-surface">
                    Encourager la régularité grâce à un retour immédiat et motivant.
                  </span>
                </Reveal>
              </ul>
            </div>
          </section>

          {/* ── Pourquoi DMAEDUCATION ── */}
          <section className="space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <Reveal from="up">
                <h2 className="font-headline-md text-headline-md text-primary font-bold">
                  Pourquoi DMAEDUCATION
                </h2>
              </Reveal>
              <Reveal from="up" delay={100}>
                <p className="text-on-surface-variant">
                  Une plateforme pensée pour une préparation sérieuse, sans
                  détour inutile.
                </p>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Reveal from="up" delay={0} className="clay-card clay-shadow rounded-[28px] p-8 flex items-start gap-5">
                <div className="w-14 h-14 shrink-0 bg-surface-container-high rounded-2xl flex items-center justify-center clay-icon-container">
                  <span className="material-symbols-outlined text-[#fb691a] text-2xl">
                    fact_check
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-primary font-bold mb-2">
                    De vraies annales
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Des questions tirées des concours ESATIC, organisées par
                    matière et par niveau — pas d'exercices génériques.
                  </p>
                </div>
              </Reveal>

              <Reveal from="up" delay={120} className="clay-card clay-shadow rounded-[28px] p-8 flex items-start gap-5">
                <div className="w-14 h-14 shrink-0 bg-surface-container-high rounded-2xl flex items-center justify-center clay-icon-container">
                  <span className="material-symbols-outlined text-[#fb691a] text-2xl">
                    bolt
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-primary font-bold mb-2">
                    Correction immédiate
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Chaque réponse est corrigée sur-le-champ, avec une
                    explication claire — pas besoin d'attendre pour comprendre
                    ton erreur.
                  </p>
                </div>
              </Reveal>

              <Reveal from="up" delay={0} className="clay-card clay-shadow rounded-[28px] p-8 flex items-start gap-5">
                <div className="w-14 h-14 shrink-0 bg-surface-container-high rounded-2xl flex items-center justify-center clay-icon-container">
                  <span className="material-symbols-outlined text-[#fb691a] text-2xl">
                    function
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-primary font-bold mb-2">
                    Formules bien affichées
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    En maths, physique et chimie, les formules s'affichent
                    correctement — plus de symboles mal rendus ou illisibles.
                  </p>
                </div>
              </Reveal>

              <Reveal from="up" delay={120} className="clay-card clay-shadow rounded-[28px] p-8 flex items-start gap-5">
                <div className="w-14 h-14 shrink-0 bg-surface-container-high rounded-2xl flex items-center justify-center clay-icon-container">
                  <span className="material-symbols-outlined text-[#fb691a] text-2xl">
                    group_add
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-primary font-bold mb-2">
                    Fait par et pour les candidats
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Chaque étudiant peut s'entraîner autant de fois qu'il le souhaite.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Message de motivation ── */}
          <Reveal as="section" from="zoom" className="rounded-[32px] bg-primary-container text-on-primary px-8 py-14 md:py-16 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 50%)",
              }}
            />
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <span className="material-symbols-outlined text-[#fb691a] text-4xl">
                format_quote
              </span>
              <p className="font-headline-md text-headline-md md:text-[28px] md:leading-[36px] font-bold text-on-primary">
                Chaque exercice résolu aujourd'hui te rapproche un peu plus de
                ta place à l'ESATIC.
              </p>
              <p className="text-on-primary-container text-sm md:text-base">
                La régularité bat le talent quand le talent ne travaille pas
                régulièrement. Continue, une question à la fois.
              </p>
            </div>
          </Reveal>
        </div>
      </main>

      {/* ── Footer (identique à Home.jsx) ── */}
      <footer className="bg-primary text-on-primary w-full mt-auto">
        <Reveal from="up" distance={24}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto border-t border-on-primary/10">
          <div className="flex flex-col gap-4">
            <Link to="/" className="flex items-center">
              <h1 className="font-sans font-bold text-xl h-10">
                DMA<span className="text-[#fb691a]">EDUCATION</span>
              </h1>
            </Link>
            <p className="font-body-md text-body-md text-on-primary/80">© 2026 DMAEDUCATION.</p>
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end md:gap-8">
            <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">
              Confidentialité
            </a>
            <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">
              Conditions
            </a>
            <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">
              Aide
            </a>
            <a className="font-sans font-bold text-on-primary/80 hover:text-on-primary transition-all" href="#">
              Contact
            </a>
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