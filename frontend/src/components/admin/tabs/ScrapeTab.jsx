import { Activity, AlertCircle, Calendar, CheckCircle, Database, Layers, Play, RefreshCw } from "lucide-react";
import Reveal from "../Reveal";

export default function ScrapeTab({
  scrapeDate,
  setScrapeDate,
  saveToBackend,
  setSaveToBackend,
  rawLoading,
  rawInfo,
  rawError,
  rawOutput,
  onStart,
  onLoadOutput,
  onRefreshJobs,
}) {
  return (
    <div className="max-w-6xl space-y-8">
      <Reveal delay={0}>
        <p className="section-label mb-2">Raw OCR Pipeline</p>
        <p className="text-slate2-400/60 text-sm mb-6">Secili tarih icin OCR pipeline calistir.</p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-5">
        <Reveal delay={1} className="lg:col-span-2">
          <div className="admin-card p-6 space-y-6">
            <h3 className="text-slate2-200 text-sm font-medium flex items-center gap-2">
              <Calendar size={14} className="text-gold-400/70" />
              Ayarlar
            </h3>

            <div>
              <label className="block text-slate2-400/70 text-xs mb-2 tracking-wider uppercase font-mono">Tarih</label>
              <input
                type="date"
                value={scrapeDate}
                onChange={(e) => setScrapeDate(e.target.value)}
                className="w-full bg-obsidian-900/80 border border-gold-700/15 rounded-xl px-4 py-3 text-slate2-200 text-sm"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-slate2-200 text-sm">Backend'e Kaydet</p>
                <p className="text-slate2-400/50 text-xs mt-0.5">Ingest otomatik yapilsin.</p>
              </div>
              <button
                onClick={() => setSaveToBackend(!saveToBackend)}
                className={`admin-toggle ${saveToBackend ? "active" : ""}`}
                aria-label="Toggle save to backend"
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={onStart}
                disabled={rawLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-gold-500 to-gold-400 text-obsidian-950 font-medium text-sm py-3.5 rounded-xl disabled:opacity-40"
              >
                <Play size={14} />
                {rawLoading ? "Calisiyor..." : "Raw OCR Baslat"}
              </button>
              <button
                onClick={onLoadOutput}
                disabled={rawLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-white/[0.03] text-slate2-200 text-sm py-3 rounded-xl border border-gold-700/15 disabled:opacity-40"
              >
                <Database size={14} className="text-gold-400/70" />
                Ciktilari Goster
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={2} className="lg:col-span-3">
          <div className="admin-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-slate2-200 text-sm font-medium flex items-center gap-2">
                <Activity size={14} className="text-gold-400/70" />
                Durum
              </h3>
              <button
                onClick={onRefreshJobs}
                className="text-slate2-400/60 hover:text-gold-400 text-xs flex items-center gap-1.5"
              >
                <RefreshCw size={11} />
                Yenile
              </button>
            </div>

            {rawInfo && (
              <div className="flex items-center gap-2 bg-emerald-400/5 border border-emerald-400/15 rounded-xl px-4 py-3">
                <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-xs">{rawInfo}</p>
              </div>
            )}
            {rawError && (
              <div className="flex items-center gap-2 bg-red-400/5 border border-red-400/15 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{rawError}</p>
              </div>
            )}

            {rawOutput ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Kaynak", value: rawOutput.source_count ?? 0 },
                    { label: "Belge", value: rawOutput.summary?.documents_written ?? 0 },
                    { label: "Tablo Sayfasi", value: rawOutput.summary?.table_pages_masked_total ?? 0 },
                    { label: "Tablo Bolgesi", value: rawOutput.summary?.table_regions_masked_total ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-obsidian-900/60 border border-gold-700/8 rounded-xl px-4 py-3">
                      <p className="text-slate2-400/60 text-[10px] tracking-wider uppercase font-mono">{label}</p>
                      <p className="text-slate2-200 text-lg font-display mt-1">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 max-h-72 overflow-auto pr-1 custom-scrollbar">
                  {(rawOutput.documents_preview || []).map((doc, idx) => (
                    <div key={`${doc.source_url || doc.title_hint || "doc"}_${idx}`} className="bg-obsidian-900/40 border border-gold-700/8 rounded-xl px-4 py-3">
                      <p className="text-slate2-200 text-xs font-medium truncate">{doc.title_hint || doc.source_url || "Belge"}</p>
                      <p className="text-slate2-400/50 text-[11px] mt-1">{doc.source_type || "unknown"} - {doc.char_count ?? 0} karakter</p>
                      {doc.table_detected && (
                        <p className="text-gold-400/80 text-[11px] mt-1 flex items-center gap-1">
                          <Layers size={10} />
                          tablo algilandi (sayfa {doc.table_pages_masked ?? 0}, bolge {doc.table_regions_masked ?? 0})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gold-500/5 flex items-center justify-center mx-auto mb-4">
                  <Database size={24} className="text-gold-400/30" />
                </div>
                <p className="text-slate2-400/50 text-sm">Henuz cikti yok</p>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
