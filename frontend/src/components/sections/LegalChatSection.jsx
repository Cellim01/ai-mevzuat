import { useState } from "react";
import { useRevealAll } from "../../hooks/useReveal";
import { Send, BookOpen } from "lucide-react";

const demoMessages = [
  {
    role: "user",
    text: "Son 1 yılda KDV ile ilgili hangi değişiklikler oldu?",
  },
  {
    role: "ai",
    text: "Son 12 ay içinde KDV'ye ilişkin toplam 7 düzenleme yayımlandı. Öne çıkan değişiklikler şunlar:",
    bullets: [
      "Konut teslimlerinde %20 oranı, belirli koşullarda %10'a indirildi (Tebliğ No: 2024/47, s.3)",
      "Elektronik hizmet ihracatında KDV istisnası genişletildi (RG: 14.03.2024)",
      "Tarımsal ürünlerde KDV matrah düzenlemesi güncellendi (RG: 02.07.2024)",
    ],
    source: "Kaynak: Resmi Gazete · 3 belge · Sayfa 3, 12, 47",
  },
];

const suggested = [
  "İhracat teşviklerinde yeni karar var mı?",
  "Asgari ücret 2024'te kaç kez değişti?",
  "Sermaye piyasasındaki son SPK kararları neler?",
];

export default function LegalChatSection() {
  useRevealAll(".chat-reveal");
  const [input, setInput] = useState("");

  return (
    <section className="py-32 relative">
      <div className="absolute right-0 bottom-0 w-[600px] h-[300px] bg-gold-700/3 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left text */}
          <div>
            <div className="chat-reveal reveal">
              <p className="section-label mb-5">Legal Chat</p>
              <h2 className="font-display font-light text-5xl text-slate2-200 leading-tight mb-6">
                Mevzuata{" "}
                <em className="italic text-gold-400">Doğrudan Sorun</em>
              </h2>
              <p className="text-slate2-400 font-light leading-relaxed mb-10">
                Karmaşık hukuki metinleri okumak zorunda değilsiniz. Sorunuzu
                doğal dille yazın; yapay zekâ kaynak göstererek yanıtlasın.
              </p>
            </div>

            <div className="chat-reveal reveal reveal-delay-2 space-y-4">
              <p className="section-label text-xs mb-4">Örnek Sorular</p>
              {suggested.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-5 py-4 border border-gold-700/10 bg-obsidian-900/50 text-slate2-400 text-sm hover:border-gold-500/30 hover:text-gold-300 transition-all duration-300 font-light"
                >
                  <span className="text-gold-600 mr-2">›</span> {s}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Chat UI mock */}
          <div className="chat-reveal reveal reveal-delay-1">
            <div className="border border-gold-700/15 bg-obsidian-900 overflow-hidden">
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-gold-700/10 flex items-center gap-3">
                <div className="glow-dot" />
                <span className="font-mono text-xs text-gold-500 tracking-widest">
                  LEGAL CHAT · RAG AKTİF
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <BookOpen size={14} className="text-slate2-400/50" />
                  <span className="font-mono text-xs text-slate2-400/50">
                    3.240 belge
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-6 space-y-6 min-h-[320px]">
                {demoMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-5 py-4 text-sm font-light leading-relaxed ${
                        m.role === "user"
                          ? "bg-gold-600/12 border border-gold-500/20 text-slate2-200"
                          : "bg-obsidian-800/80 border border-gold-700/10 text-slate2-300"
                      }`}
                    >
                      <p>{m.text}</p>
                      {m.bullets && (
                        <ul className="mt-3 space-y-2">
                          {m.bullets.map((b) => (
                            <li key={b} className="flex gap-2 text-xs">
                              <span className="text-gold-500 flex-none mt-0.5">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.source && (
                        <p className="mt-3 font-mono text-xs text-gold-600/70 border-t border-gold-700/10 pt-3">
                          {m.source}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="px-6 pb-6">
                <div className="flex gap-3 border border-gold-700/15 bg-obsidian-800/50 px-4 py-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mevzuat hakkında bir soru sorun..."
                    className="flex-1 bg-transparent text-slate2-300 text-sm placeholder-slate2-400/30 outline-none font-light"
                  />
                  <button className="text-gold-500 hover:text-gold-300 transition-colors">
                    <Send size={16} />
                  </button>
                </div>
                <p className="mt-2 font-mono text-xs text-slate2-400/30 text-center tracking-widest">
                  Her yanıt resmi metne dayanır · Kaynak referanslı
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
