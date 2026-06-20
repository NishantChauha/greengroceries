import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import HotelDashboard from "@/pages/HotelDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

function RoleRoot() {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground" data-testid="root-loading">
        Loading…
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/hotel"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RoleRoot />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/hotel"
              element={
                <ProtectedRoute role="hotel">
                  <HotelDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
