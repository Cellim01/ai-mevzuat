import { useRevealAll } from "../../hooks/useReveal";

const categories = [
  { label: "İnsan Kaynakları", count: "142 düzenleme", active: true },
  { label: "Finans & Vergi", count: "389 düzenleme", active: false },
  { label: "Dış Ticaret", count: "217 düzenleme", active: false },
  { label: "Sermaye Piyasaları", count: "98 düzenleme", active: false },
  { label: "Akademik İlanlar", count: "654 ilan", active: false },
  { label: "Çevre & Enerji", count: "176 düzenleme", active: false },
  { label: "Sağlık", count: "203 düzenleme", active: false },
  { label: "İhale İlanları", count: "1.2K ilan", active: false },
  { label: "Yargı & Ceza", count: "88 düzenleme", active: false },
  { label: "Cumhurbaşkanlığı", count: "67 karar", active: false },
  { label: "Bankacılık", count: "134 düzenleme", active: false },
  { label: "Diğer", count: "∞", active: false },
];

export default function CategoriesSection() {
  useRevealAll(".cat-reveal");

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gold-700/4 blur-[90px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="cat-reveal reveal mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="section-label mb-5">Kategoriler</p>
            <h2 className="font-display font-light text-5xl text-slate2-200 leading-tight">
              Sadece Kendi{" "}
              <em className="italic text-gold-400">Alanınızı</em> Takip Edin
            </h2>
          </div>
          <p className="text-slate2-400 font-light text-sm max-w-xs leading-relaxed">
            12+ sektör kategorisiyle yüzlerce sayfalık içerikte kaybolmadan
            ilgili düzenlemelere anında ulaşın.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((c, i) => (
            <div
              key={c.label}
              className={`cat-reveal reveal reveal-delay-${(i % 4) + 1} group cursor-pointer p-6 border transition-all duration-400 ${
                c.active
                  ? "border-gold-500/50 bg-gold-600/8"
                  : "border-gold-700/10 bg-obsidian-900/50 hover:border-gold-600/30 hover:bg-obsidian-800/50"
              }`}
            >
              <p
                className={`font-display text-lg font-light mb-2 transition-colors duration-400 ${
                  c.active
                    ? "text-gold-300"
                    : "text-slate2-300 group-hover:text-gold-300"
                }`}
              >
                {c.label}
              </p>
              <p className="font-mono text-xs text-slate2-400/50 tracking-widest">
                {c.count}
              </p>
              {c.active && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="glow-dot w-1.5 h-1.5" />
                  <span className="font-mono text-xs text-gold-500">Aktif</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
