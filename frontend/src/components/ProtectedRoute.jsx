import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children, role }) {
  const { user } = useAuth();

  if (user === null) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3" data-testid="auth-loading">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading…
        </div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/hotel"} replace />;
  }
  return children;
}
