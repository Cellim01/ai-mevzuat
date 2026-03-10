import { Link } from "react-router-dom";

const cols = [
  {
    heading: "Platform",
    links: [
      { label: "Özellikler", href: "/ozellikler" },
      { label: "Nasıl Çalışır", href: "/#nasil-calisir" },
      { label: "Fiyatlandırma", href: "/fiyatlandirma" },
      { label: "API", href: "/api" },
    ],
  },
  {
    heading: "Araçlar",
    links: [
      { label: "Diff-Checker", href: "/diff" },
      { label: "Legal Chat", href: "/chat" },
      { label: "Bildirimler", href: "/bildirimler" },
      { label: "Kategoriler", href: "/kategoriler" },
    ],
  },
  {
    heading: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/#hakkinda" },
      { label: "Blog", href: "/blog" },
      { label: "İletişim", href: "/iletisim" },
      { label: "Gizlilik", href: "/gizlilik" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gold-700/10 bg-obsidian-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 border border-gold-500/60 rotate-45" />
                <div className="absolute inset-[6px] bg-gold-500/20 rotate-45" />
              </div>
              <span className="font-display text-xl font-light tracking-[0.08em] text-slate2-200">
                AI<span className="text-gold-400">—</span>Mevzuat
              </span>
            </Link>
            <p className="text-slate2-400 text-sm leading-relaxed max-w-xs font-light">
              Türkiye'nin ilk yapay zekâ destekli Resmi Gazete analiz ve mevzuat
              takip platformu.
            </p>
            <div className="mt-8 flex items-center gap-2">
              <div className="glow-dot" />
              <span className="font-mono text-xs text-gold-500 tracking-widest uppercase">
                Canlı Sistem
              </span>
            </div>
          </div>

          {/* Links */}
          {cols.map((col) => (
            <div key={col.heading}>
              <p className="section-label mb-6 text-xs">{col.heading}</p>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      to={l.href}
                      className="text-slate2-400 text-sm hover:text-gold-300 animated-underline transition-colors duration-300"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="gold-line mt-16 mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate2-400 font-light">
          <p>© {new Date().getFullYear()} AI-Mevzuat. Tüm hakları saklıdır.</p>
          <p className="font-mono tracking-wider">
            RAG · Embedding · LLM · Türkiye Resmi Gazetesi
          </p>
        </div>
      </div>
    </footer>
  );
}
