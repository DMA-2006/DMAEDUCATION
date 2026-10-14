// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// <ProtectedRoute>        -> réservé aux personnes connectées
// <ProtectedRoute admin>  -> réservé aux administrateurs
export default function ProtectedRoute({ children, admin = false }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (admin) {
    // Le profil arrive un instant après le chargement de la page : on attend
    // plutôt que de rediriger un administrateur par erreur.
    if (!user) {
      return <p className="text-center text-slate-500 py-24">Chargement...</p>;
    }
    if (!user.est_admin) return <Navigate to="/" replace />;
  }

  return children;
}