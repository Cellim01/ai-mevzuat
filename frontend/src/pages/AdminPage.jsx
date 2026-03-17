import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminApi, gazetteApi } from "../services/api";
import { RefreshCw, Play, CheckCircle, Clock, Database, Zap, LogOut } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

function JobCard({ job }) {
  const statusColors = {
    completed: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
    running:   "text-gold-400 border-gold-400/20 bg-gold-400/5",
    failed:    "text-red-400 border-red-400/20 bg-red-400/5",
    error:     "text-red-400 border-red-400/20 bg-red-400/5",
  };
  const color = statusColors[job.status] || "text-slate2-400 border-slate2-400/20 bg-slate2-400/5";

  return (
    <div className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate2-200 text-sm font-medium">{job.date || "—"}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>
          {job.status}
        </span>
      </div>
      {job.issue_number && (
        <p className="text-slate2-400 text-xs">Sayı: {job.issue_number}</p>
      )}
      {job.document_count != null && (
        <p className="text-slate2-400 text-xs">{job.document_count} belge</p>
      )}
      {job.pipeline && (
        <p className="text-slate2-400 text-xs">Pipeline: {job.pipeline}</p>
      )}
      {job.table_pages_masked_total != null && (
        <p className="text-slate2-400 text-xs">Maskelenen tablo sayfasi: {job.table_pages_masked_total}</p>
      )}
      {job.table_regions_masked_total != null && (
        <p className="text-slate2-400 text-xs">Maskelenen tablo bolgesi: {job.table_regions_masked_total}</p>
      )}
      {job.message && (
        <p className="text-slate2-400 text-xs mt-1 truncate">{job.message}</p>
      )}
      {job.sample_titles?.length > 0 && (
        <div className="mt-2 space-y-1">
          {job.sample_titles.map((t, i) => (
            <p key={i} className="text-slate2-400/70 text-xs truncate">· {t}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [health, setHealth]       = useState({ backend: null, ai: null });
  const [jobs, setJobs]           = useState({});
  const [issues, setIssues]       = useState([]);
  const [scrapeDate, setScrapeDate] = useState(new Date().toISOString().split("T")[0]);
  const [saveToBackend, setSaveToBackend] = useState(true);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState(null);
  const [rawInfo, setRawInfo] = useState("");
  const [rawError, setRawError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const pollRef = useRef(null);

  // ── Sağlık kontrolü ───────────────────────────────────────────────────────
  const checkHealth = async () => {
    const [be, ai] = await Promise.allSettled([
      adminApi.backendHealth(),
      adminApi.aiHealth(),
    ]);
    setHealth({
      backend: be.status === "fulfilled" && be.value?.status === "ok",
      ai:      ai.status === "fulfilled" && ai.value?.status === "ok",
    });
  };

  // ── Jobs yenile ───────────────────────────────────────────────────────────
  const refreshJobs = async () => {
    try {
      const data = await adminApi.listJobs();
      setJobs(data.jobs || {});
    } catch {}
  };

  // ── Son sayılar ───────────────────────────────────────────────────────────
  const loadIssues = async () => {
    try {
      const data = await gazetteApi.getIssues({ pageSize: 10 });
      setIssues(data.items || data || []);
    } catch {}
  };

  useEffect(() => {
    checkHealth();
    refreshJobs();
    loadIssues();
    pollRef.current = setInterval(refreshJobs, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  // ── Scrape tetikle ────────────────────────────────────────────────────────
  const handleRawScrape = async () => {
    setRawLoading(true);
    setRawInfo("");
    setRawError("");
    try {
      const result = await adminApi.scrapeRaw(scrapeDate, {
        maxDocs: 0,
        keepDebugImages: true,
        allowTablePages: false,
        saveToBackend,
        previewLimit: 30,
      });

      if (result?.status === "started" && result?.job_id) {
        setRawInfo(`Raw OCR job baslatildi: ${result.job_id}`);
      } else if (result?.status === "completed") {
        setRawInfo("Raw OCR tamamlandi.");
      } else {
        setRawInfo("Raw OCR job tetiklendi.");
      }

      setTimeout(refreshJobs, 1000);
    } catch (e) {
      setRawError("Raw OCR baslatilamadi: " + e.message);
    } finally {
      setRawLoading(false);
    }
  };

  const loadRawOutput = async () => {
    setRawLoading(true);
    setRawInfo("");
    setRawError("");
    try {
      const data = await adminApi.getRawOutput(scrapeDate, 30);
      if (data?.error) {
        throw new Error(data.error);
      }
      setRawOutput(data);
      setRawInfo(`${scrapeDate} icin raw cikti yuklendi.`);
    } catch (e) {
      setRawOutput(null);
      setRawError("Raw cikti okunamadi: " + e.message);
    } finally {
      setRawLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/giris");
  };

  const jobList = Object.entries(jobs).map(([id, job]) => ({ id, ...job }))
    .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate2-200">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-56 bg-obsidian-900 border-r border-gold-700/10 flex flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gold-700/10">
          <span className="font-display text-lg font-light tracking-[0.08em]">
            AI<span className="text-gold-400">—</span>Mevzuat
          </span>
          <p className="text-slate2-400 text-xs mt-1">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: "dashboard", label: "Dashboard",   icon: Database },
            { id: "scrape",    label: "Scrape",       icon: Zap },
            { id: "jobs",      label: "Job'lar",      icon: Clock },
            { id: "issues",    label: "Son Sayılar",  icon: RefreshCw },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === id
                  ? "bg-gold-500/10 text-gold-400"
                  : "text-slate2-400 hover:text-slate2-200 hover:bg-obsidian-800"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gold-700/10">
          <p className="text-slate2-400 text-xs truncate mb-2">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate2-400 hover:text-red-400 text-xs transition-colors"
          >
            <LogOut size={13} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 p-8">
        {/* ── Dashboard ── */}
        {activeTab === "dashboard" && (
          <div>
            <h1 className="font-display text-3xl mb-8">Dashboard</h1>

            {/* Servis durumları */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Backend API", ok: health.backend, port: "5000" },
                { label: "AI Service",  ok: health.ai,      port: "8000" },
              ].map(({ label, ok, port }) => (
                <div key={label} className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate2-400 text-xs mb-1">{label}</p>
                      <p className="text-slate2-200 font-medium">:{port}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusDot ok={ok} />
                      <span className={`text-sm ${ok ? "text-emerald-400" : ok === null ? "text-slate2-400" : "text-red-400"}`}>
                        {ok === null ? "Kontrol ediliyor..." : ok ? "Çevrimiçi" : "Çevrimdışı"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Özet istatistikler */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Toplam İş",      value: Object.keys(jobs).length },
                { label: "Tamamlanan",     value: Object.values(jobs).filter(j => j.status === "completed").length },
                { label: "Kayıtlı Sayı",   value: issues.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-5">
                  <p className="text-slate2-400 text-xs mb-2">{label}</p>
                  <p className="text-3xl font-display text-gold-400">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => { checkHealth(); refreshJobs(); loadIssues(); }}
              className="mt-6 flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Yenile
            </button>
          </div>
        )}

        {/* ── Scrape ── */}
        {activeTab === "scrape" && (
          <div className="max-w-6xl">
            <h1 className="font-display text-3xl mb-8">Raw OCR Pipeline</h1>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-6 space-y-6">
              {/* Tarih seç */}
              <div>
                <label className="block text-slate2-400 text-xs mb-2 tracking-wider uppercase">
                  Tarih
                </label>
                <input
                  type="date"
                  value={scrapeDate}
                  onChange={(e) => setScrapeDate(e.target.value)}
                  className="w-full bg-obsidian-900 border border-gold-700/20 rounded-lg px-4 py-3 text-slate2-200 text-sm focus:outline-none focus:border-gold-500/50 transition-colors"
                />
              </div>

              {/* Backend'e kaydet toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate2-200 text-sm">Backend'e Kaydet</p>
                  <p className="text-slate2-400 text-xs">MSSQL'e ingest edilsin mi?</p>
                </div>
                <button
                  onClick={() => setSaveToBackend(!saveToBackend)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    saveToBackend ? "bg-gold-500" : "bg-obsidian-600"
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    saveToBackend ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3">
                <button
                  onClick={handleRawScrape}
                  disabled={rawLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-obsidian-950 font-medium text-sm py-3 rounded-lg transition-colors"
                >
                  <Play size={14} />
                  {rawLoading ? "Çalışıyor..." : "Raw OCR Başlat"}
                </button>
                <button
                  onClick={loadRawOutput}
                  disabled={rawLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-obsidian-700 hover:bg-obsidian-600 disabled:opacity-50 text-slate2-200 text-sm py-3 rounded-lg border border-gold-700/20 transition-colors"
                >
                  <Database size={14} />
                  Çıktıyı Göster
                </button>
              </div>

              <p className="text-slate2-400 text-xs">
                Raw OCR arka planda çalışır. SQL kaydı için yukarıdaki toggle kullanılır.
              </p>
            </div>
            <div className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-slate2-200 font-medium">Raw OCR Pipeline</h2>
                  <p className="text-slate2-400 text-xs">Seçilen tarih için ham OCR çıktıları yüklenir.</p>
                </div>
                <button
                  onClick={refreshJobs}
                  className="text-slate2-400 hover:text-gold-400 text-xs transition-colors"
                >
                  Job'ları Yenile
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRawScrape}
                  disabled={rawLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-obsidian-950 font-medium text-sm py-3 rounded-lg transition-colors"
                >
                  <Play size={14} />
                  {rawLoading ? "Çalışıyor..." : "Raw OCR Başlat"}
                </button>
                <button
                  onClick={loadRawOutput}
                  disabled={rawLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-obsidian-700 hover:bg-obsidian-600 disabled:opacity-50 text-slate2-200 text-sm py-3 rounded-lg border border-gold-700/20 transition-colors"
                >
                  <Database size={14} />
                  Çıktıyı Göster
                </button>
              </div>

              {rawInfo && (
                <p className="text-emerald-400 text-xs">{rawInfo}</p>
              )}
              {rawError && (
                <p className="text-red-400 text-xs">{rawError}</p>
              )}

              {rawOutput && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-obsidian-900 border border-gold-700/10 rounded-lg px-3 py-2">
                      <p className="text-slate2-400 text-[11px]">Kaynak</p>
                      <p className="text-slate2-200 text-sm">{rawOutput.source_count ?? 0}</p>
                    </div>
                    <div className="bg-obsidian-900 border border-gold-700/10 rounded-lg px-3 py-2">
                      <p className="text-slate2-400 text-[11px]">Belge</p>
                      <p className="text-slate2-200 text-sm">{rawOutput.summary?.documents_written ?? 0}</p>
                    </div>
                    <div className="bg-obsidian-900 border border-gold-700/10 rounded-lg px-3 py-2">
                      <p className="text-slate2-400 text-[11px]">Tablo Sayfası</p>
                      <p className="text-slate2-200 text-sm">{rawOutput.summary?.table_pages_masked_total ?? 0}</p>
                    </div>
                    <div className="bg-obsidian-900 border border-gold-700/10 rounded-lg px-3 py-2">
                      <p className="text-slate2-400 text-[11px]">Tablo Bölgesi</p>
                      <p className="text-slate2-200 text-sm">{rawOutput.summary?.table_regions_masked_total ?? 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-auto pr-1">
                    {(rawOutput.documents_preview || []).map((doc, idx) => (
                      <div
                        key={`${doc.source_url || doc.title_hint || "doc"}_${idx}`}
                        className="bg-obsidian-900 border border-gold-700/10 rounded-lg px-3 py-2"
                      >
                        <p className="text-slate2-200 text-xs font-medium truncate">
                          {doc.title_hint || doc.source_url || "Belge"}
                        </p>
                        <p className="text-slate2-400 text-[11px] mt-1">
                          {doc.source_type || "unknown"} • {doc.char_count ?? 0} karakter
                        </p>
                        {doc.table_detected && (
                          <p className="text-gold-400 text-[11px] mt-1">
                            tablo algılandı (sayfa {doc.table_pages_masked ?? 0}, bölge {doc.table_regions_masked ?? 0})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* ── Jobs ── */}
        {activeTab === "jobs" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="font-display text-3xl">Job'lar</h1>
              <button
                onClick={refreshJobs}
                className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-sm transition-colors"
              >
                <RefreshCw size={14} />
                Yenile
              </button>
            </div>

            {jobList.length === 0 ? (
              <p className="text-slate2-400">Henüz job yok.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {jobList.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Son Sayılar ── */}
        {activeTab === "issues" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="font-display text-3xl">Son Sayılar</h1>
              <button
                onClick={loadIssues}
                className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-sm transition-colors"
              >
                <RefreshCw size={14} />
                Yenile
              </button>
            </div>

            {issues.length === 0 ? (
              <p className="text-slate2-400">Henüz kayıtlı sayı yok.</p>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="bg-obsidian-800 border border-gold-700/10 rounded-xl p-5 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-slate2-200 font-medium">Sayı {issue.issueNumber}</p>
                      <p className="text-slate2-400 text-sm">{issue.publishedDate?.split("T")[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gold-400 text-sm">{issue.documentCount ?? "—"} belge</p>
                      <CheckCircle size={16} className="text-emerald-400 ml-auto mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
