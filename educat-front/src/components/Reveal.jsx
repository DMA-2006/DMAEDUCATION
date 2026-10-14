// src/components/Reveal.jsx
import { useEffect, useRef, useState } from "react";

// Fait apparaître son contenu en le faisant glisser doucement quand il entre à l'écran.
//
//   <Reveal from="left">...</Reveal>              arrive depuis la gauche
//   <Reveal from="up" delay={150}>...</Reveal>    monte depuis le bas, avec 150 ms de retard
//
// from     : "up" | "down" | "left" | "right" | "zoom" | "fade"
// delay    : retard en ms (pour enchaîner plusieurs éléments l'un après l'autre)
// duration : durée en ms
// distance : de combien de pixels l'élément glisse
// once     : true = l'effet ne joue qu'une fois ; false = il rejoue à chaque passage
// as       : balise HTML à utiliser (div par défaut)
//
// Respecte le réglage « réduire les animations » de l'appareil : dans ce cas le
// contenu est simplement affiché, sans mouvement.

const DEPART = {
  up: (d) => `translate3d(0, ${d}px, 0)`,
  down: (d) => `translate3d(0, ${-d}px, 0)`,
  left: (d) => `translate3d(${-d}px, 0, 0)`,
  right: (d) => `translate3d(${d}px, 0, 0)`,
  zoom: () => "scale(0.94)",
  fade: () => "none",
};

function mouvementReduit() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

export default function Reveal({
  children,
  from = "up",
  delay = 0,
  duration = 700,
  distance = 40,
  once = true,
  as: Balise = "div",
  className = "",
  style,
  ...autres
}) {
  const ref = useRef(null);

  // Sans observateur de visibilité (très vieux navigateur) ou avec « réduire les
  // animations » : le contenu est visible tout de suite.
  const [visible, setVisible] = useState(
    () => mouvementReduit() || typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined" || mouvementReduit()) return;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          if (once) observateur.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [once]);

  const cache = (DEPART[from] ?? DEPART.up)(distance);

  return (
    <Balise
      ref={ref}
      data-reveal={from}
      data-visible={visible}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : cache,
        transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: visible ? "auto" : "opacity, transform",
        ...style,
      }}
      {...autres}
    >
      {children}
    </Balise>
  );
}