import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Footer from "./components/layout/Footer";
import Navbar from "./components/layout/Navbar";
import FeaturesPage from "./pages/FeaturesPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PricingPage from "./pages/PricingPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPage from "./pages/AdminPage";
import PanelPage from "./pages/PanelPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";

function AdminRoute({ children }) {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <Navigate to="/giris" replace />;
  return isAdmin ? children : <Navigate to="/panel" replace />;
}
function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  return isLoggedIn ? children : <Navigate to="/giris" replace />;
}
function GuestRoute({ children }) {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return children;
  return <Navigate to={isAdmin ? "/admin" : "/panel"} replace />;
}
function WithLayout({ children }) {
  return (
    <div className="min-h-screen bg-obsidian-950 relative overflow-x-hidden">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WithLayout><HomePage /></WithLayout>} />
      <Route path="/ozellikler" element={<WithLayout><FeaturesPage /></WithLayout>} />
      <Route path="/fiyatlandirma" element={<WithLayout><PricingPage /></WithLayout>} />
      <Route path="/giris" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/kayit" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/panel" element={<ProtectedRoute><PanelPage /></ProtectedRoute>} />
      <Route path="/panel/belge/:id" element={<ProtectedRoute><DocumentDetailPage /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
