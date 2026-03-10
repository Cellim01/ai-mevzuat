import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import HomePage from "./pages/HomePage";
import FeaturesPage from "./pages/FeaturesPage";
import PricingPage from "./pages/PricingPage";

export default function App() {
  return (
    <div className="min-h-screen bg-obsidian-950 relative overflow-x-hidden">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ozellikler" element={<FeaturesPage />} />
        <Route path="/fiyatlandirma" element={<PricingPage />} />
      </Routes>
      <Footer />
    </div>
  );
}
