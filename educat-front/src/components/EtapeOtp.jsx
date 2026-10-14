// src/components/EtapeOtp.jsx
// Saisie du code à 6 chiffres envoyé par e-mail (après l'inscription ou après un
// mot de passe correct). Remplace le formulaire le temps de la vérification.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

const LONGUEUR_CODE = 6;

function messageErreur(err) {
  if (!err.response) {
    return "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.";
  }
  const detail = err.response.data?.detail;
  return typeof detail === "string"
    ? detail
    : `Le serveur a rencontré une erreur (${err.response.status}). Réessaie dans un instant.`;
}

// otp : réponse du serveur ({ ticket, email, renvoi_dans_s })
// surSucces(profil) : appelé une fois la personne connectée
// surRetour() : revenir au formulaire
export default function EtapeOtp({ otp, compact, className, surSucces, surRetour }) {
  const { verifierOtp, renvoyerOtp } = useAuth();

  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [chargement, setChargement] = useState(false);
  const [attente, setAttente] = useState(otp.renvoi_dans_s ?? 60);
  const champ = useRef(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  // Compte à rebours avant de pouvoir redemander un code
  useEffect(() => {
    if (attente <= 0) return;
    const minuteur = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [attente]);

  async function valider(valeur) {
    if (chargement || valeur.length !== LONGUEUR_CODE) return;
    setErreur("");
    setInfo("");
    setChargement(true);
    try {
      const profil = await verifierOtp(otp.ticket, valeur);
      surSucces(profil);
    } catch (err) {
      setErreur(messageErreur(err));
      setCode("");
      setChargement(false);
      champ.current?.focus();
    }
  }

  function surSaisie(e) {
    const valeur = e.target.value.replace(/\D/g, "").slice(0, LONGUEUR_CODE);
    setCode(valeur);
    // Dès que les 6 chiffres sont là (saisie ou collage), on valide tout seul
    if (valeur.length === LONGUEUR_CODE) valider(valeur);
  }

  async function renvoyer() {
    setErreur("");
    setInfo("");
    try {
      const res = await renvoyerOtp(otp.ticket);
      setAttente(res.renvoi_dans_s ?? 60);
      setCode("");
      setInfo("Nouveau code envoyé.");
      champ.current?.focus();
    } catch (err) {
      const secondes = err.response?.data?.renvoi_dans_s;
      if (secondes) setAttente(secondes);
      setErreur(messageErreur(err));
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        valider(code);
      }}
      className={className}
    >
      <div className={compact ? "w-full" : "w-full max-w-xs mx-auto"}>
        <h1
          className={`font-bold text-primary mb-1 text-center ${compact ? "text-xl" : "text-2xl"}`}
        >
          Vérifie ton e-mail
        </h1>
        <p
          className={`text-on-surface-variant text-center ${
            compact ? "text-xs mb-4" : "text-sm mb-6"
          }`}
        >
          Saisis le code à {LONGUEUR_CODE} chiffres envoyé à{" "}
          <span className="font-semibold text-primary">{otp.email}</span>
        </p>

        {erreur && (
          <div
            className={`w-full bg-red-50 text-red-600 rounded-lg ${
              compact ? "text-xs px-3 py-2 mb-3" : "text-sm px-4 py-2.5 mb-4"
            }`}
          >
            {erreur}
          </div>
        )}
        {info && !erreur && (
          <div
            className={`w-full bg-green-50 text-green-700 rounded-lg ${
              compact ? "text-xs px-3 py-2 mb-3" : "text-sm px-4 py-2.5 mb-4"
            }`}
          >
            {info}
          </div>
        )}

        <input
          ref={champ}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Code de vérification"
          placeholder="••••••"
          maxLength={LONGUEUR_CODE}
          value={code}
          onChange={surSaisie}
          disabled={chargement}
          className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] rounded-xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[#fb691a] disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={chargement || code.length !== LONGUEUR_CODE}
          className={`w-full bg-[#fb691a] hover:bg-[#e35e16] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 ${
            compact ? "mt-4 py-3" : "mt-6 py-3.5"
          }`}
        >
          {chargement ? "Vérification..." : "Valider"}
        </button>

        <div className="flex items-center justify-between mt-4 text-xs">
          <button
            type="button"
            onClick={surRetour}
            className="text-on-surface-variant hover:text-primary"
          >
            ← Retour
          </button>
          <button
            type="button"
            onClick={renvoyer}
            disabled={attente > 0}
            className="font-semibold text-[#fb691a] disabled:text-on-surface-variant disabled:font-normal"
          >
            {attente > 0 ? `Renvoyer le code (${attente} s)` : "Renvoyer le code"}
          </button>
        </div>

        <p className="text-[11px] text-on-surface-variant text-center mt-3">
          Rien reçu ? Regarde dans les courriers indésirables.
        </p>
      </div>
    </form>
  );
}
