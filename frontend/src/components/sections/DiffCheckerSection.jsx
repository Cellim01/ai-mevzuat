import { useRevealAll } from "../../hooks/useReveal";
import { GitCompare, Minus, Plus } from "lucide-react";

const diffLines = [
  { type: "context", text: "Madde 5 — KDV Oranları" },
  { type: "removed", text: "Konut teslimlerinde KDV oranı %18 olarak uygulanır." },
  { type: "added",   text: "Konut teslimlerinde KDV oranı %20 olarak uygulanır." },
  { type: "context", text: "" },
  { type: "context", text: "Madde 7 — İstisnalar" },
  { type: "removed", text: "150 m²'nin altındaki konutlar bu maddeden muaftır." },
  { type: "added",   text: "150 m²'nin altındaki ve değeri 4.000.000 TL'yi aşmayan konutlar bu maddeden muaftır." },
];

export default function DiffCheckerSection() {
  useRevealAll(".diff-reveal");

  return (
    <section className="py-32 relative">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-px h-24 bg-gradient-to-b from-transparent via-gold-600/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="diff-reveal reveal text-center mb-16">
          <p className="section-label mb-5 justify-center">Diff-Checker</p>
          <h2 className="font-display font-light text-5xl text-slate2-200 leading-tight">
            Değişikliği Anında{" "}
            <em className="italic text-gold-400">Görün & Anlayın</em>
          </h2>
        </div>

        <div className="diff-reveal reveal reveal-delay-1 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border border-gold-700/15 border-b-0 bg-obsidian-900">
            <GitCompare size={16} className="text-gold-500" />
            <span className="font-mono text-xs text-slate2-400 tracking-widest">
              Katma Değer Vergisi Kanunu · Değişiklik: 14.09.2024 · Sayı: 32681
            </span>
          </div>

          {/* Diff */}
          <div className="border border-gold-700/15 bg-obsidian-950 font-mono text-xs overflow-x-auto">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 px-6 py-2.5 border-b border-gold-700/5 ${
                  line.type === "removed"
                    ? "bg-red-500/5 border-l-2 border-l-red-500/30"
                    : line.type === "added"
                    ? "bg-green-500/5 border-l-2 border-l-green-500/30"
                    : "border-l-2 border-l-transparent"
                }`}
              >
                <span className="flex-none w-4 mt-0.5">
                  {line.type === "removed" ? (
                    <Minus size={12} className="text-red-400/70" />
                  ) : line.type === "added" ? (
                    <Plus size={12} className="text-green-400/70" />
                  ) : null}
                </span>
                <span
                  className={
                    line.type === "removed"
                      ? "text-red-300/80 line-through"
                      : line.type === "added"
                      ? "text-green-300/80"
                      : "text-slate2-400/50"
                  }
                >
                  {line.text || "\u00a0"}
                </span>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          <div className="border border-gold-600/20 border-t-0 bg-gold-600/5 px-6 py-5">
            <p className="section-label text-xs mb-3">AI Özeti</p>
            <p className="text-slate2-300 text-sm font-light leading-relaxed">
              KDV Kanunu'nun 5. maddesinde konut teslimleri için vergi oranı %18'den %20'ye çıkarıldı.
              7. maddeye ek olarak muafiyet için 150 m² sınırına, 4.000.000 TL değer üst sınırı da
              eklendi. Bu değişiklik 150 m²'nin altında ancak yüksek değerli konutları doğrudan
              etkiliyor.
            </p>
            <p className="mt-3 font-mono text-xs text-gold-600/60 tracking-wider">
              Kaynak: RG 32681 · Madde 5, Madde 7 · 14.09.2024
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
