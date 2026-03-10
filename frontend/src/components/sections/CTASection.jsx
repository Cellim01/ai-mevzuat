import { Link } from "react-router-dom";
import { useRevealAll } from "../../hooks/useReveal";

export default function CTASection() {
  useRevealAll(".cta-reveal");

  return (
    <section className="py-40 relative overflow-hidden">
      {/* Big glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[400px] rounded-full bg-gold-600/6 blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 lg:px-12 text-center">
        <div className="cta-reveal reveal">
          <p className="section-label justify-center mb-8">Platforma Katılın</p>
          <h2 className="font-display font-light text-6xl md:text-7xl text-slate2-200 leading-[1.05] mb-8">
            Türkiye'nin Mevzuatını{" "}
            <span className="text-gold-shimmer">Yapay Zekâyla</span>{" "}
            Takip Edin
          </h2>
          <p className="text-slate2-400 font-light text-lg leading-relaxed max-w-xl mx-auto mb-12">
            Hukuk profesyonelleri, akademisyenler ve şirketler için tasarlandı.
            Ücretsiz başlayın, ihtiyacınıza göre büyütün.
          </p>
        </div>

        <div className="cta-reveal reveal reveal-delay-2 flex flex-wrap items-center justify-center gap-5">
          <Link to="/kayit" className="btn-primary px-10 py-4 text-sm">
            Ücretsiz Hesap Oluştur
            <span className="text-gold-300 text-base">→</span>
          </Link>
          <Link
            to="/demo"
            className="flex items-center gap-2 text-slate2-400 text-sm tracking-widest uppercase hover:text-gold-300 transition-colors duration-300 animated-underline"
          >
            Demo İste
          </Link>
        </div>

        <div className="cta-reveal reveal reveal-delay-3 mt-14 gold-line max-w-xs mx-auto" />
        <p className="cta-reveal reveal reveal-delay-4 mt-6 font-mono text-xs text-slate2-400/40 tracking-widest">
          Kredi kartı gerekmez · 14 gün ücretsiz deneme
        </p>
      </div>
    </section>
  );
}
