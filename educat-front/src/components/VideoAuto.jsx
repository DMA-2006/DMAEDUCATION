// src/components/VideoAuto.jsx
import { useLayoutEffect, useRef, useState } from "react";

// Vidéo d'ambiance (sans son) qui démarre toute seule, y compris sur téléphone et
// y compris APRÈS UN RECHARGEMENT de la page.
//
// Pourquoi « ça marche la première fois mais pas après un rechargement » :
//  1. Au rechargement, le fichier vidéo est déjà en cache : le navigateur décide de
//     démarrer la lecture IMMÉDIATEMENT, avant que React ait fini de configurer la
//     balise. Or React écrit `muted` comme propriété mais pas toujours comme attribut
//     HTML, et la lecture automatique est refusée si la vidéo n'est pas déclarée
//     « muette » à cet instant précis. Ici, on construit donc la balise nous-mêmes,
//     avec tous ses attributs posés AVANT l'adresse du fichier.
//  2. La première fois, un toucher sur la page (par exemple le bouton « Visit Site »
//     de la page d'avertissement de ngrok) compte comme une interaction avec le site,
//     ce qui débloque la lecture. Au rechargement, plus de geste : si le téléphone
//     bloque la lecture automatique (mode économie d'énergie, économiseur de données,
//     réglage du navigateur pour ce site), aucun code ne peut l'imposer. Dans ce cas
//     on affiche un gros bouton « lecture », et le premier toucher relance la vidéo.
export default function VideoAuto({
  src,
  className = "",
  poster,
  loop = true,
  "aria-label": ariaLabel,
}) {
  const conteneur = useRef(null);
  const videoRef = useRef(null);
  const [bloquee, setBloquee] = useState(false); // le navigateur a refusé le démarrage

  useLayoutEffect(() => {
    const zone = conteneur.current;
    if (!zone) return;

    // ── La balise est construite à la main : attributs d'abord, adresse ensuite ──
    const video = document.createElement("video");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    if (loop) video.setAttribute("loop", "");
    video.setAttribute("preload", "auto");
    video.setAttribute("disablepictureinpicture", "");
    if (className) video.setAttribute("class", className);
    if (ariaLabel) video.setAttribute("aria-label", ariaLabel);
    if (poster) video.setAttribute("poster", poster);
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("src", src); // en dernier
    zone.appendChild(video);
    videoRef.current = video;

    // ── Lancer la lecture (sans jamais empiler les demandes) ──
    const lancer = () => {
      if (!video.paused) return;
      const promesse = video.play();
      if (promesse && typeof promesse.then === "function") {
        promesse
          .then(() => setBloquee(false))
          .catch((err) => {
            // AbortError = demande interrompue (pause volontaire, changement de
            // source) : ce n'est PAS un refus du navigateur.
            if (err?.name === "AbortError") return;
            console.info(
              "[VideoAuto] lecture automatique refusée :",
              err?.name,
              "| politique du navigateur :",
              navigator.getAutoplayPolicy?.(video) ?? "inconnue"
            );
            setBloquee(true);
          });
      }
    };

    const surVisibilite = () => {
      if (document.visibilityState === "visible") lancer();
    };

    lancer();

    // Nouvelles tentatives : la vidéo vient d'être prête, la page vient d'être
    // restaurée (bouton « précédent »), l'onglet redevient visible, ou la personne
    // touche l'écran. On utilise touchend et non touchstart : c'est touchend que les
    // navigateurs reconnaissent comme un vrai geste de l'utilisateur.
    video.addEventListener("loadeddata", lancer);
    video.addEventListener("canplay", lancer);
    window.addEventListener("pageshow", lancer);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("touchend", lancer, { passive: true });
    window.addEventListener("click", lancer);

    // ── Économie de batterie : pause hors écran, reprise au retour ──
    // On ne met JAMAIS en pause avant que la vidéo ait été vue une première fois
    // (sinon, au rechargement, une mesure faite avant la mise en page la figerait).
    let dejaVisible = false;
    let observateur;
    if ("IntersectionObserver" in window) {
      observateur = new IntersectionObserver(
        ([entree]) => {
          if (entree.isIntersecting) {
            dejaVisible = true;
            lancer();
          } else if (dejaVisible) {
            video.pause();
          }
        },
        { threshold: 0.25 }
      );
      observateur.observe(video);
    }

    return () => {
      video.removeEventListener("loadeddata", lancer);
      video.removeEventListener("canplay", lancer);
      window.removeEventListener("pageshow", lancer);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("touchend", lancer);
      window.removeEventListener("click", lancer);
      observateur?.disconnect();
      video.pause();
      video.remove();
      videoRef.current = null;
    };
  }, [src, className, poster, loop, ariaLabel]);

  function lireManuellement() {
    videoRef.current
      ?.play()
      .then(() => setBloquee(false))
      .catch(() => {});
  }

  return (
    <div className="relative w-full h-full">
      {/* React ne touche jamais au contenu de cette zone : la balise y est ajoutée à la main */}
      <div ref={conteneur} className="w-full h-full" />

      {/* Lecture automatique refusée par le navigateur : bouton bien visible */}
      {bloquee && (
        <button
          type="button"
          onClick={lireManuellement}
          aria-label="Lancer la vidéo"
          className="absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="w-16 h-16 rounded-full bg-white/90 shadow-xl flex items-center justify-center text-[#fb691a] active:scale-95 transition-transform">
            <span
              className="material-symbols-outlined text-[40px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              play_arrow
            </span>
          </span>
        </button>
      )}
    </div>
  );
}