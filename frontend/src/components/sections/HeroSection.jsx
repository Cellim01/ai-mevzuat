import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function HeroSection() {
  const canvasRef = useRef(null);

  // Animated particle/grid background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Grid dots
    const particles = [];
    const cols = Math.ceil(window.innerWidth / 60);
    const rows = Math.ceil(window.innerHeight / 60);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        particles.push({
          x: c * 60 + 30,
          y: r * 60 + 30,
          opacity: Math.random() * 0.3,
          speed: 0.003 + Math.random() * 0.005,
          offset: Math.random() * Math.PI * 2,
        });
      }
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        const o = (Math.sin(t * p.speed + p.offset) + 1) / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 130, 20, ${o * p.opacity})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden noise-overlay">
      {/* Canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] rounded-full bg-gold-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full bg-gold-700/4 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-32 pb-24">
        <div className="max-w-4xl">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-3 mb-10 px-4 py-2 card-glass rounded-none"
            style={{ animationDelay: "0s" }}
          >
            <div className="glow-dot" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-gold-400">
              Türkiye · Resmi Gazete · RAG Mimarisi
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-light leading-[1.05] mb-8">
            <span
              className="block text-6xl md:text-7xl lg:text-8xl text-slate2-200"
              style={{ animation: "fadeUp 0.9s ease 0.1s both" }}
            >
              Mevzuatı
            </span>
            <span
              className="block text-6xl md:text-7xl lg:text-8xl text-gold-shimmer mt-1"
              style={{ animation: "fadeUp 0.9s ease 0.25s both" }}
            >
              Yapay Zekâyla
            </span>
            <span
              className="block text-6xl md:text-7xl lg:text-8xl text-slate2-200 mt-1"
              style={{ animation: "fadeUp 0.9s ease 0.4s both" }}
            >
              Takip Edin.
            </span>
          </h1>

          {/* Sub */}
          <p
            className="text-slate2-400 text-lg md:text-xl font-light leading-relaxed max-w-xl mb-12"
            style={{ animation: "fadeUp 0.9s ease 0.55s both" }}
          >
            Her gün yayımlanan Resmi Gazete içeriklerini anlayın. Değişiklikleri
            karşılaştırın. Soru sorun. Kaynaklı yanıt alın.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap items-center gap-5"
            style={{ animation: "fadeUp 0.9s ease 0.7s both" }}
          >
            <Link to="/demo" className="btn-primary">
              Platformu Keşfedin
              <span className="text-gold-300 text-base">→</span>
            </Link>
            <Link
              to="/#nasil-calisir"
              className="flex items-center gap-2 text-slate2-400 text-sm tracking-widest uppercase hover:text-gold-300 transition-colors duration-300 animated-underline"
            >
              Nasıl Çalışır
            </Link>
          </div>

          {/* Stats */}
          <div
            className="mt-20 grid grid-cols-3 gap-0 max-w-lg"
            style={{ animation: "fadeUp 0.9s ease 0.85s both" }}
          >
            {[
              { num: "365", label: "Gün/Yıl Canlı" },
              { num: "12+", label: "Sektör Kategorisi" },
              { num: "RAG", label: "Kaynaklı Yanıt" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`pr-8 ${i !== 2 ? "border-r border-gold-700/20 mr-8" : ""}`}
              >
                <p className="font-display text-4xl font-light text-gold-400 leading-none">
                  {s.num}
                </p>
                <p className="text-slate2-400 text-xs tracking-widest uppercase mt-2 font-mono">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ animation: "fadeIn 1s ease 1.5s both" }}
      >
        <span className="font-mono text-xs text-slate2-400/50 tracking-[0.2em] uppercase">
          Kaydırın
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-gold-600/50 to-transparent animate-pulse" />
      </div>
    </section>
  );
}
