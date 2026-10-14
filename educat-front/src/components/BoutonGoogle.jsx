// src/components/BoutonGoogle.jsx
// Bouton officiel « Se connecter avec Google » (Google Identity Services).
import { useEffect, useRef, useState } from "react";
import client from "../api/client";

const URL_SCRIPT_GOOGLE = "https://accounts.google.com/gsi/client";

// Le script de Google n'est chargé qu'une fois, à la première page qui en a besoin.
let promesseScript = null;
function chargerScriptGoogle() {
  if (!promesseScript) {
    promesseScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = URL_SCRIPT_GOOGLE;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        promesseScript = null; // permet de réessayer plus tard
        script.remove();
        reject(new Error("script Google injoignable"));
      };
      document.head.appendChild(script);
    });
  }
  return promesseScript;
}

// Prépare la connexion Google pour une page. `surJeton(jeton)` est appelé quand la
// personne a choisi son compte Google. Renvoie :
//   etat   : "chargement" | "pret" | "non-configure" | "erreur"
//   erreur : réponse du serveur (ou erreur réseau) quand etat === "erreur"
export function useConnexionGoogle(surJeton) {
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  // Toujours la dernière version de la fonction, sans réinitialiser Google
  const surJetonRef = useRef(surJeton);
  useEffect(() => {
    surJetonRef.current = surJeton;
  });

  useEffect(() => {
    let annule = false;

    // L'identifiant client n'est défini qu'à un endroit : le .env du serveur.
    Promise.all([client.get("/auth/config/"), chargerScriptGoogle()])
      .then(([res]) => {
        if (annule) return;
        const clientId = res.data?.google_client_id;
        if (!clientId) {
          setEtat("non-configure");
          return;
        }
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (reponse) => surJetonRef.current(reponse.credential),
        });
        setEtat("pret");
      })
      .catch((err) => {
        if (annule) return;
        console.error("Connexion Google indisponible :", err);
        setErreur(err);
        setEtat("erreur");
      });

    return () => {
      annule = true;
    };
  }, []);

  return { etat, erreur };
}

const LIBELLES = {
  signin_with: "Se connecter avec Google",
  signup_with: "S'inscrire avec Google",
};

// Le bouton lui-même. `pret` vient de useConnexionGoogle (etat === "pret").
// texte : "signin_with" (Se connecter avec Google) ou "signup_with" (S'inscrire avec Google)
//
// Le bouton officiel de Google change tout seul de texte quand la personne s'est déjà
// connectée (« Continuer en tant que ... » avec son nom et sa photo), et Google ne
// permet pas de désactiver ça. On affiche donc NOTRE bouton, au texte fixe, et on pose
// le bouton officiel par-dessus, invisible : c'est lui qui reçoit le clic.
export default function BoutonGoogle({ pret, texte = "signin_with" }) {
  const conteneur = useRef(null);

  useEffect(() => {
    const element = conteneur.current;
    if (!pret || !element) return;

    let largeurAffichee = 0;
    function dessiner() {
      // Google impose une largeur en pixels, entre 200 et 400
      const largeur = Math.round(Math.min(400, Math.max(200, element.offsetWidth)));
      if (!element.offsetWidth || largeur === largeurAffichee) return;
      largeurAffichee = largeur;
      window.google.accounts.id.renderButton(element, {
        type: "standard",
        theme: "outline",
        size: "large", // 40 px de haut, comme notre bouton (h-10)
        shape: "pill",
        text: texte,
        locale: "fr",
        width: largeur,
      });
    }

    dessiner();
    // Redessine si la place disponible change (rotation du téléphone, redimensionnement)
    const observateur = new ResizeObserver(dessiner);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [pret, texte]);

  return (
    <div className="relative w-full max-w-[320px] h-10 mx-auto">
      {/* Bouton visible */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center gap-3 rounded-full border border-outline-variant bg-white text-sm font-semibold text-[#1f1f1f] ${
          pret ? "" : "opacity-60"
        }`}
      >
        <svg viewBox="0 0 48 48" className="w-[18px] h-[18px] shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {LIBELLES[texte] || LIBELLES.signin_with}
      </div>

      {/* Bouton officiel de Google, invisible, posé par-dessus pour recevoir le clic */}
      <div
        ref={conteneur}
        className="absolute inset-0 overflow-hidden rounded-full opacity-[0.01]"
      />
    </div>
  );
}
