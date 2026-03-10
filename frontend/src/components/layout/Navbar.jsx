import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

const navLinks = [
  { label: "Özellikler", href: "/ozellikler" },
  { label: "Nasıl Çalışır", href: "/#nasil-calisir" },
  { label: "Fiyatlar", href: "/fiyatlandirma" },
  { label: "Hakkında", href: "/#hakkinda" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  return (
    <header
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-obsidian-950/95 backdrop-blur-xl border-b border-gold-700/10"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border border-gold-500/60 rotate-45 group-hover:rotate-[135deg] transition-transform duration-700" />
            <div className="absolute inset-[6px] bg-gold-500/20 rotate-45 group-hover:bg-gold-500/40 transition-colors duration-500" />
          </div>
          <span className="font-display text-xl font-light tracking-[0.08em] text-slate2-200">
            AI<span className="text-gold-400">—</span>Mevzuat
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => (
            <Link key={l.href} to={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/giris" className="nav-link">
            Giriş
          </Link>
          <Link to="/demo" className="btn-primary text-xs">
            Ücretsiz Dene
            <span className="text-gold-300">→</span>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate2-400 hover:text-gold-400 transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={clsx(
          "md:hidden overflow-hidden transition-all duration-500 border-t border-gold-700/10",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
        style={{ background: "rgba(5,5,8,0.98)", backdropFilter: "blur(20px)" }}
      >
        <div className="px-6 py-6 flex flex-col gap-6">
          {navLinks.map((l) => (
            <Link key={l.href} to={l.href} className="nav-link text-base">
              {l.label}
            </Link>
          ))}
          <div className="gold-line" />
          <Link to="/demo" className="btn-primary self-start">
            Ücretsiz Dene →
          </Link>
        </div>
      </div>
    </header>
  );
}
