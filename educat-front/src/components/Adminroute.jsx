// src/components/AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Comme ProtectedRoute, mais réservé aux administrateurs.
// - pas connecté          -> page de connexion
// - connecté, pas admin   -> accueil
// ⚠️ Ce contrôle ne sert qu'au confort : la vraie protection est côté Django
//    (permission EstAdmin sur /api/admin/stats/), qui refuse tout non-admin.
export default function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Le profil arrive un instant après le chargement de la page : on attend
  // plutôt que de rediriger un administrateur par erreur.
  if (!user) {
    return (
      <p className="text-center text-slate-500 py-24">Chargement...</p>
    );
  }

  if (!user.est_admin) return <Navigate to="/" replace />;

  return children;
}