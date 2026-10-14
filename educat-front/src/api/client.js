// src/api/client.js
import axios from "axios";

// Adresse de l'API.
// Par défaut : "/api", c'est-à-dire la MÊME adresse que le site. En développement,
// Vite transmet ces requêtes à Django (voir `proxy` dans vite.config.js). Le site
// marche donc de la même façon sur l'ordinateur, sur un téléphone du même Wi-Fi et à
// travers ngrok, sans CORS à configurer et sans ouvrir le port 8000.
// Pour une API hébergée ailleurs (production) : VITE_API_URL dans le fichier .env
// (ex. VITE_API_URL=https://api.monsite.ci/api).
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Avant chaque requête, on ajoute automatiquement le token JWT
// s'il existe (stocké dans localStorage après connexion).
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Pages que l'on peut voir sans être connecté : un jeton périmé ne doit JAMAIS y
// renvoyer vers /login, ni empêcher d'y afficher des données publiques (matières...).
const PAGES_PUBLIQUES = ["/", "/quiz", "/library", "/about", "/login", "/register"];
const surPagePublique = () => PAGES_PUBLIQUES.includes(window.location.pathname);

// Retire l'en-tête Authorization d'une requête déjà préparée (jeton périmé)
function retirerAuthorization(config) {
  if (config.headers?.delete) config.headers.delete("Authorization");
  else if (config.headers) delete config.headers.Authorization;
}

// Ces routes répondent 401 pour une raison qui n'a rien à voir avec un jeton
// expiré (mauvais mot de passe...) : on ne tente jamais de renouvellement pour elles.
const ROUTES_SANS_RENOUVELLEMENT = ["/login/", "/register/", "/auth/otp/", "/auth/google/", "/token/refresh/"];

// Un seul renouvellement à la fois : si plusieurs requêtes reçoivent un 401 en même
// temps (le dashboard en envoie plusieurs), elles attendent toutes le même résultat.
let renouvellementEnCours = null;

function renouvelerJeton(refreshToken) {
  if (!renouvellementEnCours) {
    renouvellementEnCours = axios
      .post(`${API_BASE_URL}/token/refresh/`, { refresh: refreshToken })
      .then((res) => {
        localStorage.setItem("access_token", res.data.access);
        // Si le serveur renouvelle aussi le refresh token (rotation), on le garde.
        if (res.data.refresh) localStorage.setItem("refresh_token", res.data.refresh);
        return res.data.access;
      })
      .finally(() => {
        renouvellementEnCours = null;
      });
  }
  return renouvellementEnCours;
}

// Si le token a expiré (401), on tente automatiquement de le rafraîchir
// avec le refresh_token, puis on relance la requête initiale.
client.interceptors.response.use(
  (response) => {
    // Une réponse HTML à la place des données de l'API = mauvaise configuration
    // (typiquement : Vite n'a pas été relancé après l'ajout du proxy dans
    // vite.config.js, et renvoie la page du site à la place de la réponse de Django).
    // Sans ce contrôle, les pages recevraient du texte, ne trouveraient aucune
    // liste dedans et afficheraient « rien » sans la moindre erreur.
    const type = String(response.headers?.["content-type"] || "");
    const debut = typeof response.data === "string" ? response.data.trimStart().slice(0, 15).toLowerCase() : "";
    if (type.includes("text/html") || debut.startsWith("<!doctype") || debut.startsWith("<html")) {
      const erreur = new Error(
        "L'API a répondu par une page HTML au lieu de données JSON : le proxy vers Django n'est pas actif (relance « npm run dev ») ou l'adresse de l'API est incorrecte."
      );
      erreur.estReponseHtml = true;
      erreur.config = response.config;
      return Promise.reject(erreur);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const estRouteAuth = ROUTES_SANS_RENOUVELLEMENT.some((route) =>
      originalRequest?.url?.includes(route)
    );

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !estRouteAuth
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        // Une autre requête a peut-être DÉJÀ renouvelé le jeton pendant que celle-ci
        // était en route (elle était partie avec l'ancien). Inutile de renouveler une
        // 2e fois : on la rejoue avec le jeton actuel. (Avec la rotation des refresh
        // tokens de SimpleJWT, un 2e renouvellement avec l'ancien refresh token serait
        // refusé et déconnecterait la personne.)
        const jetonEnvoye = String(originalRequest.headers?.Authorization || "").replace("Bearer ", "");
        const jetonActuel = localStorage.getItem("access_token");
        if (jetonActuel && jetonEnvoye && jetonActuel !== jetonEnvoye) {
          originalRequest.headers.Authorization = `Bearer ${jetonActuel}`;
          return client(originalRequest);
        }

        try {
          const nouveauJeton = await renouvelerJeton(refreshToken);
          originalRequest.headers.Authorization = `Bearer ${nouveauJeton}`;
          return client(originalRequest);
        } catch (e) {
          // Le refresh token est refusé (expiré ou invalide) : on déconnecte.
          // Une simple coupure réseau (sur téléphone, par exemple) ne doit PAS
          // déconnecter la personne : dans ce cas on garde sa session.
          const refus = [400, 401, 403].includes(e.response?.status);
          if (refus) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            if (surPagePublique()) {
              // Page publique : la session a expiré, on continue en simple visiteur
              // (la requête est rejouée sans jeton) au lieu de renvoyer vers /login.
              retirerAuthorization(originalRequest);
              return client(originalRequest);
            }
            window.location.href = "/login";
          }
        }
      } else if (originalRequest.headers?.Authorization && surPagePublique()) {
        // Jeton périmé et aucun moyen de le renouveler : sur une page publique,
        // on repart en visiteur pour que les données publiques s'affichent.
        localStorage.removeItem("access_token");
        retirerAuthorization(originalRequest);
        return client(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default client;