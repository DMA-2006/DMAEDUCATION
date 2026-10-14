import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Astuce classique iOS Safari : sans ce listener, les effets CSS ":active"
// (ex. .clay-button-shadow:active) ne se déclenchent JAMAIS au toucher sur
// les <a>/<Link> — seulement à la souris. Un simple listener vide "réveille"
// ce comportement pour toute l'application.
document.addEventListener("touchstart", function () {}, false);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);