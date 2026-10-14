// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

// Identifiant du compte contenu dans un jeton JWT. On ne vérifie pas la signature
// (c'est le serveur qui s'en charge) : on s'en sert seulement pour savoir si deux
// jetons appartiennent à la même personne.
function idDuJeton(jeton) {
  try {
    const charge = jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(charge)).user_id ?? null;
  } catch {
    return null;
  }
}

// Fréquence du signal "je suis là" envoyé au serveur (statut en ligne / hors ligne)
const INTERVALLE_PRESENCE_MS = 20000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token")
  );
  const deconnexionEnCours = useRef(false);
  // Jeton du compte que CET onglet représente (même si un autre onglet change de compte)
  const jetonDeCetOnglet = useRef(localStorage.getItem("access_token"));
  // null = le signal de présence passe ; sinon le code d'erreur HTTP (ou "reseau").
  // Le dashboard s'en sert pour prévenir l'administrateur si le statut "en ligne" ne peut pas marcher.
  const [erreurPresence, setErreurPresence] = useState(null);

  // Au démarrage de l'appli : si un token existe déjà (rechargement de page),
  // on récupère le profil pour que `user` ne reste pas vide.
  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;

    client
      .get("/me/")
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token invalide ou expiré et non rafraîchissable : on déconnecte proprement
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setIsAuthenticated(false);
      });
  }, []);

  // Session partagée entre onglets : tous les onglets d'un même navigateur lisent
  // le même localStorage. Si un AUTRE onglet se connecte avec un autre compte (ou se
  // déconnecte), cet onglet recharge pour afficher la bonne session au lieu de
  // continuer avec une identité périmée (le dashboard afficherait des chiffres figés).
  // Un simple renouvellement du jeton, pour le même compte, est ignoré.
  useEffect(() => {
    function surStockage(e) {
      if (e.key !== null && e.key !== "access_token") return;
      const autreCompte = idDuJeton(e.newValue) !== idDuJeton(e.oldValue);
      if (e.key === null || !e.newValue || autreCompte) {
        window.location.reload();
      }
    }
    window.addEventListener("storage", surStockage);
    return () => window.removeEventListener("storage", surStockage);
  }, []);

  // Présence : tant que la personne est connectée, on prévient le serveur
  // toutes les 20 secondes (et dès que l'onglet redevient visible).
  useEffect(() => {
    if (!isAuthenticated) return;

    let avertie = false;
    const ping = () => {
      if (deconnexionEnCours.current) return;
      client
        .post("/me/ping/")
        .then(() => setErreurPresence(null))
        .catch((err) => {
          // Sans cet avertissement, un signal refusé serait invisible : le statut
          // "en ligne" ne marcherait pour personne sans qu'on sache pourquoi.
          setErreurPresence(err.response?.status ?? "reseau");
          if (avertie) return;
          avertie = true;
          console.warn(
            "Signal de présence refusé (statut en ligne indisponible) :",
            err.response?.status ?? "serveur injoignable",
            "— vérifie la route me/ping/ dans urls.py et que la migration est faite."
          );
        });
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") ping();
    };
    // Retour sur une page restaurée depuis le cache du navigateur (bouton "précédent")
    const surAffichage = (e) => {
      if (e.persisted) ping();
    };

    // Fermeture de l'onglet ou du navigateur : on prévient le serveur tout de
    // suite, sans attendre que le délai de 90 s passe la personne hors ligne.
    // sendBeacon survit à la fermeture de la page mais ne peut pas envoyer
    // d'en-tête Authorization : le jeton voyage donc dans le corps du message.
    const surFermeture = () => {
      if (deconnexionEnCours.current) return;
      // Si un autre onglet a changé de compte, on prévient pour le compte de CET
      // onglet, sans mettre hors ligne la personne qui vient de se connecter.
      const actuel = localStorage.getItem("access_token");
      const connu = jetonDeCetOnglet.current;
      const jeton = actuel && idDuJeton(actuel) === idDuJeton(connu) ? actuel : connu;
      if (!jeton || !navigator.sendBeacon) return;
      const base = (client.defaults.baseURL || "").replace(/\/$/, "");
      navigator.sendBeacon(
        `${base}/me/hors-ligne/`,
        new Blob([JSON.stringify({ access: jeton })], {
          type: "text/plain;charset=UTF-8", // type "simple" : pas de pré-requête CORS
        })
      );
    };

    ping();
    const intervalle = setInterval(ping, INTERVALLE_PRESENCE_MS);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pageshow", surAffichage);
    window.addEventListener("pagehide", surFermeture);

    return () => {
      clearInterval(intervalle);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pageshow", surAffichage);
      window.removeEventListener("pagehide", surFermeture);
    };
  }, [isAuthenticated]);

  // Le serveur renvoie les jetons ET le profil dans la même réponse (code OTP
  // validé, ou connexion Google) : un seul aller-retour suffit.
  function ouvrirSession(data) {
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    jetonDeCetOnglet.current = data.access;
    setIsAuthenticated(true);
    setUser(data.user);

    // On renvoie le profil : la page de connexion en a besoin pour savoir
    // si la personne est administrateur (et l'envoyer sur le dashboard).
    return data.user;
  }

  // Connexion et inscription par formulaire se font en deux temps : le serveur
  // envoie d'abord un code par e-mail et répond { otp_requis, ticket, email } ;
  // la session ne s'ouvre qu'avec verifierOtp(ticket, code).
  async function login(username, password) {
    const res = await client.post("/login/", { username, password });
    return res.data;
  }

  async function register(data) {
    const res = await client.post("/register/", data);
    return res.data;
  }

  async function verifierOtp(ticket, code) {
    const res = await client.post("/auth/otp/verifier/", { ticket, code });
    return ouvrirSession(res.data);
  }

  async function renvoyerOtp(ticket) {
    const res = await client.post("/auth/otp/renvoyer/", { ticket });
    return res.data;
  }

  // Connexion ET inscription avec Google : `credential` est le jeton remis par le
  // bouton Google. Le serveur le vérifie, puis retrouve ou crée le compte.
  async function loginGoogle(credential) {
    const res = await client.post("/auth/google/", { credential });
    return ouvrirSession(res.data);
  }

  async function logout() {
    // On bloque d'éventuels signaux de présence encore en route, puis on
    // prévient le serveur : la personne passe "hors ligne" tout de suite.
    deconnexionEnCours.current = true;
    try {
      await client.post("/me/ping/", { hors_ligne: true }, { timeout: 1500 });
    } catch {
      // Pas grave : le serveur la passera hors ligne de lui-même sous 2 minutes.
    }

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // Retour à l'accueil par une navigation "dure" (rechargement de la page).
    // On NE modifie volontairement PAS l'état React ici : si la page courante
    // est protégée, ProtectedRoute verrait isAuthenticated = false et
    // redirigerait vers /login avant que le retour à l'accueil n'aboutisse.
    window.location.assign("/");
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, isAuthenticated, erreurPresence, login, register, verifierOtp, renvoyerOtp, loginGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}