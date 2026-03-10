import { useRevealAll } from "../../hooks/useReveal";
import {
  FileSearch,
  GitCompare,
  Bell,
  MessageSquare,
  Tag,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    tag: "01 — Analiz",
    title: "Otomatik İçerik İşleme",
    desc: "Her gün yayımlanan Resmi Gazete sayıları otomatik olarak işlenir, OCR ile metinleştirilir ve vektör veritabanına eklenir.",
  },
  {
    icon: GitCompare,
    tag: "02 — Diff",
    title: "Mevzuat Diff-Checker",
    desc: "Kanun veya yönetmelikte değişiklik olduğunda eski ve yeni metin yan yana karşılaştırılır; değişikliğin önemi sade dille açıklanır.",
  },
  {
    icon: Bell,
    tag: "03 — Takip",
    title: "Kişisel Bildirim Sistemi",
    desc: "Belirlediğiniz anahtar kelime veya sektörler için anlık bildirim alın ya da her sabah size özel özet e-postasını takip edin.",
  },
  {
    icon: MessageSquare,
    tag: "04 — AI",
    title: "Legal Chat Asistanı",
    desc: "'KDV\u2019de son 1 yılda ne değişti?' gibi soruları sorun; sistem RAG mimarisiyle resmi metinden kaynaklı yanıt üretir.",
  },
  {
    icon: Tag,
    tag: "05 — Kategori",
    title: "Sektörel Filtreleme",
    desc: "İK, Finans & Vergi, Dış Ticaret, Akademik İlanlar ve daha fazlası. Sadece kendi alanınızdaki değişiklikleri görün.",
  },
  {
    icon: Shield,
    tag: "06 — Güvenilirlik",
    title: "Kaynaklı & Doğrulanmış",
    desc: "Her özet ve yanıt doğrudan resmi metne dayanır. Sayfa numarası ve kaynak bağlantısıyla birlikte sunulur; halüsinasyon minimize.",
  },
];

export default function FeaturesOverview() {
  useRevealAll(".feat-reveal");

  return (
    <section id="ozellikler" className="py-32 relative">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-gold-600/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="feat-reveal reveal mb-20 max-w-2xl">
          <p className="section-label mb-5">Özellikler</p>
          <h2 className="font-display font-light text-5xl md:text-6xl text-slate2-200 leading-tight">
            Mevzuatı anlamak{" "}
            <em className="italic text-gold-400">hiç bu kadar</em> kolay
            olmamıştı
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gold-700/10">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.tag}
                className={`feat-reveal reveal reveal-delay-${(i % 3) + 1} card-glass bg-obsidian-950 p-10 group transition-all duration-500`}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="p-3 border border-gold-700/20 group-hover:border-gold-500/40 transition-colors duration-500">
                    <Icon size={20} className="text-gold-500 group-hover:text-gold-300 transition-colors duration-500" />
                  </div>
                  <span className="font-mono text-xs text-slate2-400/40 tracking-widest">
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-light text-slate2-200 mb-4 group-hover:text-gold-200 transition-colors duration-500">
                  {f.title}
                </h3>
                <p className="text-slate2-400 text-sm leading-relaxed font-light">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
