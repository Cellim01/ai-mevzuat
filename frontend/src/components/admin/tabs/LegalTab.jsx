import { AlertCircle, Database, ExternalLink, Search } from "lucide-react";
import Reveal from "../Reveal";

export default function LegalTab({
  queryText,
  setQueryText,
  maxResults,
  setMaxResults,
  loading,
  result,
  error,
  cacheInfo,
  cacheLoading,
  onSearch,
  onClearCache,
}) {
  return (
    <div className="max-w-6xl space-y-8">
      <Reveal delay={0}>
        <p className="section-label mb-2">Legal Query Test</p>
        <p className="text-slate2-400/60 text-sm mb-6">Local + MCP sorgusunu admin panelden test et.</p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-5">
        <Reveal delay={1} className="lg:col-span-2">
          <div className="admin-card p-6 space-y-5">
            <div>
              <label className="block text-slate2-400/70 text-xs mb-2 tracking-wider uppercase font-mono">Sorgu</label>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
                placeholder="orn: ozel tuketim vergisi"
                className="w-full bg-obsidian-900/80 border border-gold-700/15 rounded-xl px-4 py-3 text-slate2-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-slate2-400/70 text-xs mb-2 tracking-wider uppercase font-mono">Max Sonuc</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                className="w-full bg-obsidian-900/80 border border-gold-700/15 rounded-xl px-4 py-3 text-slate2-200 text-sm"
              />
            </div>

            <button
              onClick={onSearch}
              disabled={loading || !queryText.trim()}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-gold-500 to-gold-400 text-obsidian-950 font-medium text-sm py-3.5 rounded-xl disabled:opacity-40"
            >
              <Search size={14} />
              {loading ? "Sorgulaniyor..." : "Sorgula"}
            </button>

            <div className="h-px bg-gradient-to-r from-transparent via-gold-700/15 to-transparent" />

            <button
              onClick={() => onClearCache(queryText)}
              disabled={cacheLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-white/[0.03] text-slate2-200 text-sm py-3 rounded-xl border border-gold-700/15 disabled:opacity-40"
            >
              <Database size={14} className="text-gold-400/70" />
              Bu sorgu cache temizle
            </button>
            <button
              onClick={() => onClearCache("")}
              disabled={cacheLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-red-400/5 text-red-300 text-sm py-3 rounded-xl border border-red-400/20 disabled:opacity-40"
            >
              Tum cache temizle
            </button>
          </div>
        </Reveal>

        <Reveal delay={2} className="lg:col-span-3">
          <div className="admin-card p-6 space-y-5 min-h-[420px]">
            {cacheInfo && (
              <div className="text-xs px-3 py-2 rounded-lg border border-gold-700/20 bg-gold-700/5 text-gold-300">
                {cacheInfo}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-400/5 border border-red-400/15 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {!result ? (
              <div className="text-center py-16 text-slate2-400/50 text-sm">Sorgu sonucu burada gosterilecek.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-obsidian-900/60 border border-gold-700/8 rounded-xl px-4 py-3">
                    <p className="text-slate2-400/60 text-[10px] tracking-wider uppercase font-mono">Kaynak</p>
                    <p className="text-slate2-200 text-sm mt-1">{result.usedExternalFallback ? "External fallback" : "Local RG"}</p>
                  </div>
                  <div className="bg-obsidian-900/60 border border-gold-700/8 rounded-xl px-4 py-3">
                    <p className="text-slate2-400/60 text-[10px] tracking-wider uppercase font-mono">Cache</p>
                    <p className="text-slate2-200 text-sm mt-1">{result.fromCache ? "Cache" : "Canli"}</p>
                  </div>
                  <div className="bg-obsidian-900/60 border border-gold-700/8 rounded-xl px-4 py-3">
                    <p className="text-slate2-400/60 text-[10px] tracking-wider uppercase font-mono">Sonuc</p>
                    <p className="text-slate2-200 text-sm mt-1">{(result.sources || []).length}</p>
                  </div>
                </div>

                <p className="text-slate2-400/70 text-xs italic">{result.message}</p>

                <div className="space-y-2 max-h-96 overflow-auto pr-1 custom-scrollbar">
                  {(result.sources || []).map((src, idx) => (
                    <div key={`${src.title}-${idx}`} className="bg-obsidian-900/40 border border-gold-700/8 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-slate2-200 text-xs font-medium">{src.title}</p>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gold-400/70 hover:text-gold-400 mt-0.5"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-slate2-400/60 text-[11px] mt-1">{src.provider}</p>
                      <p className="text-slate2-300/80 text-xs mt-2 leading-relaxed">{src.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
