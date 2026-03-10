import { useRevealAll } from "../hooks/useReveal";
import { FileSearch, GitCompare, Bell, MessageSquare, Tag, Shield, Database, Zap } from "lucide-react";

const featureDetails = [
  {
    icon: FileSearch,
    title: "Otomatik Resmi Gazete Takibi",
    desc: "Sistem her gün saat 05:00'te Resmi Gazete'yi otomatik olarak tarar. Tüm sayfalar OCR ile işlenir, metin haline getirilir ve kategorilere ayrılır. Hiçbir yayın kaçmaz.",
    detail: "Günlük ortalama 200-900 sayfa · Tam metin arama · PDF indirme",
  },
  {
    icon: GitCompare,
    title: "Mevzuat Diff-Checker",
    desc: "Bir kanun veya yönetmelikte değişiklik olduğunda AI otomatik olarak tespit eder. Eski ve yeni metin yan yana karşılaştırılır, değişikliğin önemi yorumlanır.",
    detail: "Madde bazlı karşılaştırma · Renk kodlu görünüm · AI yorumu",
  },
  {
    icon: Bell,
    title: "Anlık Bildirim & Özet E-Posta",
    desc: "Takip ettiğiniz anahtar kelime veya kategori için anında bildirim alın. Ya da her sabah size özel hazırlanmış günlük mevzuat özetini e-posta ile takip edin.",
    detail: "Push bildirim · E-posta · Webhook entegrasyonu",
  },
  {
    icon: MessageSquare,
    title: "Legal Chat (RAG Asistanı)",
    desc: "Doğal dilde sorular sorun. Sistem RAG mimarisiyle ilgili mevzuatı bulur ve LLM ile yanıt üretir. Her yanıt kaynak sayfa ve bağlantısıyla birlikte gelir.",
    detail: "GPT-4o · text-embedding-3-large · Türkçe optimizasyonu",
  },
  {
    icon: Tag,
    title: "Sektörel Kategori Filtreleri",
    desc: "12+ sektör kategorisiyle yalnızca alanınızı ilgilendiren düzenlemelere odaklanın. Çoklu kategori takibi yapılabilir.",
    detail: "IK · Finans · Dış Ticaret · Sermaye Piyasaları · Daha fazlası",
  },
  {
    icon: Shield,
    title: "Kaynaklı & Güvenilir Yanıtlar",
    desc: "Tüm özetler ve cevaplar doğrudan resmi metne dayanır. Sayfa numarası ve Resmi Gazete bağlantısı her yanıta eklenir. Yanlış bilgi üretimi minimize edilir.",
    detail: "Kaynak referansı · Güven skoru · Hallucination kontrolü",
  },
  {
    icon: Database,
    title: "Tarihsel Mevzuat Arşivi",
    desc: "Geçmişe dönük araştırma yapın. Yıllık arşiv üzerinden arama ve filtreleme imkânı. Eski versiyonlarla karşılaştırma.",
    detail: "2015'ten bugüne · Tam metin · PDF arşivi",
  },
  {
    icon: Zap,
    title: "API Erişimi",
    desc: "Kurumsal kullanıcılar için REST API desteği. Kendi uygulamalarınıza mevzuat analiz özelliği ekleyin. Webhook ile entegrasyon.",
    detail: "REST API · Webhook · SDK (yakında)",
  },
];

export default function FeaturesPage() {
  useRevealAll(".fp-reveal");

  return (
    <main className="min-h-screen pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="fp-reveal reveal mb-20">
          <p className="section-label mb-5">Tüm Özellikler</p>
          <h1 className="font-display font-light text-6xl text-slate2-200 leading-tight max-w-2xl">
            Mevzuat Takibini{" "}
            <em className="italic text-gold-400">Yeniden Tanımlıyoruz</em>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gold-700/10">
          {featureDetails.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`fp-reveal reveal reveal-delay-${(i % 2) + 1} card-glass bg-obsidian-950 p-10 group`}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 border border-gold-700/20 group-hover:border-gold-500/40 transition-colors duration-500">
                    <Icon size={20} className="text-gold-500" />
                  </div>
                  <h2 className="font-display text-2xl font-light text-slate2-200 group-hover:text-gold-200 transition-colors duration-500">
                    {f.title}
                  </h2>
                </div>
                <p className="text-slate2-400 text-sm leading-relaxed font-light mb-5">
                  {f.desc}
                </p>
                <p className="font-mono text-xs text-gold-600/60 tracking-wider">
                  {f.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
