import { Link } from "react-router-dom";
import { useRevealAll } from "../hooks/useReveal";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Başlangıç",
    price: "Ücretsiz",
    period: "",
    desc: "Bireysel kullanıcılar ve meraklılar için",
    features: [
      "Günlük Resmi Gazete özeti",
      "3 kategori takibi",
      "Legal Chat (günlük 10 soru)",
      "Temel arama",
      "E-posta bildirimi",
    ],
    cta: "Ücretsiz Başla",
    href: "/kayit",
    highlighted: false,
  },
  {
    name: "Profesyonel",
    price: "₺990",
    period: "/ay",
    desc: "Avukatlar, danışmanlar ve araştırmacılar için",
    features: [
      "Tüm Başlangıç özellikleri",
      "Sınırsız kategori takibi",
      "Legal Chat sınırsız",
      "Diff-Checker erişimi",
      "Anlık push bildirim",
      "Tarihsel arşiv erişimi (2015+)",
      "PDF indirme",
    ],
    cta: "14 Gün Ücretsiz Dene",
    href: "/kayit?plan=pro",
    highlighted: true,
  },
  {
    name: "Kurumsal",
    price: "Özel",
    period: "",
    desc: "Şirketler ve kurumlar için",
    features: [
      "Tüm Profesyonel özellikler",
      "API erişimi",
      "Webhook entegrasyonu",
      "Çoklu kullanıcı",
      "Özel kategori tanımlama",
      "Öncelikli destek",
      "SLA garantisi",
    ],
    cta: "Demo İste",
    href: "/iletisim",
    highlighted: false,
  },
];

export default function PricingPage() {
  useRevealAll(".pp-reveal");

  return (
    <main className="min-h-screen pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="pp-reveal reveal text-center mb-20">
          <p className="section-label justify-center mb-5">Fiyatlandırma</p>
          <h1 className="font-display font-light text-6xl text-slate2-200 leading-tight mb-6">
            İhtiyacınıza Göre{" "}
            <em className="italic text-gold-400">Büyüyen</em> Bir Plan
          </h1>
          <p className="text-slate2-400 font-light max-w-md mx-auto">
            Ücretsiz başlayın. İhtiyaçlarınız büyüdükçe planı değiştirin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gold-700/10">
          {plans.map((p, i) => (
            <div
              key={p.name}
              className={`pp-reveal reveal reveal-delay-${i + 1} p-10 flex flex-col ${
                p.highlighted
                  ? "bg-obsidian-800 border border-gold-500/25"
                  : "bg-obsidian-950"
              }`}
            >
              {p.highlighted && (
                <div className="mb-6">
                  <span className="font-mono text-xs text-gold-400 tracking-widest border border-gold-500/30 px-3 py-1.5">
                    POPÜLER
                  </span>
                </div>
              )}

              <p className="section-label text-xs mb-4">{p.name}</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="font-display text-5xl font-light text-slate2-200">
                  {p.price}
                </span>
                <span className="text-slate2-400 mb-2 font-light">{p.period}</span>
              </div>
              <p className="text-slate2-400 text-sm font-light mb-8">{p.desc}</p>

              <ul className="space-y-3 mb-10 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate2-300 font-light">
                    <Check size={14} className="text-gold-500 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={p.href}
                className={`btn-primary justify-center ${
                  p.highlighted ? "border-gold-500/60 text-gold-300" : ""
                }`}
              >
                {p.cta}
                <span className="text-gold-300">→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
