import { useRevealAll } from "../../hooks/useReveal";

const steps = [
  {
    num: "01",
    title: "Resmi Gazete Otomatik Toplanır",
    desc: "Her gün saat 05:00'te sistemimiz Resmi Gazete'yi çeker, sayfalara ayırır ve metin haline getirir. Yeni yayın hiçbir zaman kaçmaz.",
  },
  {
    num: "02",
    title: "AI ile Analiz & Vektörleştirme",
    desc: "Her belge embedding modeliyle vektörleştirilir ve sektör/kategori etiketiyle birlikte veritabanına eklenir. RAG altyapısı hazır hale gelir.",
  },
  {
    num: "03",
    title: "Diff-Checker Değişiklikleri Tespit Eder",
    desc: "Değiştirilen kanun ve yönetmelikler önceki versiyonlarıyla karşılaştırılır. Değişikliğin anlamı LLM ile sade Türkçeye çevrilir.",
  },
  {
    num: "04",
    title: "Siz Sorun, Sistem Cevaplasın",
    desc: "Legal Chat üzerinden sorunuzu yazın. RAG sistemi ilgili mevzuatı bulur, LLM cevabı oluşturur, kaynak sayfa ve bağlantıyı ekler.",
  },
];

export default function HowItWorks() {
  useRevealAll(".how-reveal");

  return (
    <section id="nasil-calisir" className="py-32 relative">
      {/* Background accent */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gold-700/3 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          {/* Left */}
          <div className="how-reveal reveal sticky top-32">
            <p className="section-label mb-5">Nasıl Çalışır</p>
            <h2 className="font-display font-light text-5xl md:text-6xl text-slate2-200 leading-tight mb-8">
              Dörde Adımda{" "}
              <em className="italic text-gold-400">Tam Otomatik</em> Analiz
            </h2>
            <p className="text-slate2-400 font-light leading-relaxed">
              Siz sadece platformu kullanın. Arka planda çalışan sistem Resmi
              Gazete'yi her gün takip eder, analiz eder ve hazır hale getirir.
            </p>

            {/* Terminal mock */}
            <div className="mt-10 border border-gold-700/15 bg-obsidian-900 p-6 font-mono text-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-2 text-slate2-400/40 tracking-widest">ai-mevzuat · rag-pipeline</span>
              </div>
              <div className="space-y-1.5 text-slate2-400">
                <p><span className="text-gold-500">$</span> fetch --source resmi-gazete --date today</p>
                <p className="text-green-400/70">✓ 847 sayfa çekildi</p>
                <p><span className="text-gold-500">$</span> embed --model text-embedding-3-large</p>
                <p className="text-green-400/70">✓ Vektörleştirme tamamlandı</p>
                <p><span className="text-gold-500">$</span> diff-check --compare yesterday</p>
                <p className="text-green-400/70">✓ 3 değişiklik tespit edildi</p>
                <p><span className="text-gold-500">$</span> notify --subscribers all</p>
                <p className="text-green-400/70">✓ Bildirimler gönderildi</p>
              </div>
            </div>
          </div>

          {/* Right — Steps */}
          <div className="space-y-0">
            {steps.map((s, i) => (
              <div
                key={s.num}
                className={`how-reveal reveal reveal-delay-${i + 1} group flex gap-8 pb-12 ${
                  i !== steps.length - 1 ? "border-b border-gold-700/10" : ""
                } pt-12`}
              >
                <div className="flex-none">
                  <span className="font-mono text-5xl font-light text-gold-700/30 group-hover:text-gold-500/60 transition-colors duration-500">
                    {s.num}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-light text-slate2-200 mb-3 group-hover:text-gold-200 transition-colors duration-500">
                    {s.title}
                  </h3>
                  <p className="text-slate2-400 text-sm leading-relaxed font-light">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
