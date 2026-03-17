import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminApi, gazetteApi } from "../services/api";
import {
  RefreshCw, Play, CheckCircle, Clock, Database, Zap, LogOut,
  LayoutDashboard, FileText, Activity, ChevronRight, AlertCircle,
  Server, Cpu, BarChart3, Calendar, Layers, Info
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ ok }) {
  const color = ok ? "bg-emerald-400" : ok === null ? "bg-slate2-400" : "bg-red-400";
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${ok ? "status-pulse" : ""}`} />
  );
}

function AnimatedNumber({ value }) {
  return (
    <span className="admin-stat-value font-display text-4xl lg:text-5xl font-light leading-none">
      {value}
    </span>
  );
}

function JobCard({ job }) {
  const statusConfig = {
    completed: { color: "text-emerald-400", bg: "bg-emerald-400/5", border: "border-emerald-400/20", icon: CheckCircle },
    running:   { color: "text-gold-400",    bg: "bg-gold-400/5",    border: "border-gold-400/20",    icon: RefreshCw },
    failed:    { color: "text-red-400",     bg: "bg-red-400/5",     border: "border-red-400/20",     icon: AlertCircle },
    error:     { color: "text-red-400",     bg: "bg-red-400/5",     border: "border-red-400/20",     icon: AlertCircle },
  };
  const cfg = statusConfig[job.status] || { color: "text-slate2-400", bg: "bg-slate2-400/5", border: "border-slate2-400/20", icon: Info };
  const StatusIcon = cfg.icon;

  return (
    <div className="admin-card p-5 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-slate2-400" />
          <span className="text-slate2-200 text-sm font-medium">{job.date || "—"}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          <StatusIcon size={11} className={job.status === "running" ? "animate-spin" : ""} />
          {job.status}
        </span>
      </div>

      <div className="space-y-1.5">
        {job.issue_number && (
          <p className="text-slate2-400 text-xs flex items-center gap-1.5">
            <FileText size={11} /> Sayı: {job.issue_number}
          </p>
        )}
        {job.document_count != null && (
          <p className="text-slate2-400 text-xs flex items-center gap-1.5">
            <Layers size={11} /> {job.document_count} belge
          </p>
        )}
        {job.pipeline && (
          <p className="text-slate2-400 text-xs flex items-center gap-1.5">
            <Activity size={11} /> Pipeline: {job.pipeline}
          </p>
        )}
        {job.table_pages_masked_total != null && (
          <p className="text-slate2-400 text-xs">
            Maskelenen tablo sayfası: {job.table_pages_masked_total}
          </p>
        )}
        {job.table_regions_masked_total != null && (
          <p className="text-slate2-400 text-xs">
            Maskelenen tablo bölgesi: {job.table_regions_masked_total}
          </p>
        )}
        {job.message && (
          <p className="text-slate2-400/70 text-xs mt-2 truncate italic">{job.message}</p>
        )}
      </div>

      {job.sample_titles?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gold-700/10 space-y-1">
          {job.sample_titles.map((t, i) => (
            <p key={i} className="text-slate2-400/60 text-xs truncate">· {t}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// Animated reveal wrapper
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50 + delay * 100);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.6s ease ${delay * 0.08}s, transform 0.6s ease ${delay * 0.08}s`,
      }}
    >
      {children}
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

  // ── Health check ─────────────────────────────────────────────────────────
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

  // ── Refresh jobs ─────────────────────────────────────────────────────────
  const refreshJobs = async () => {
    try {
      const data = await adminApi.listJobs();
      setJobs(data.jobs || {});
    } catch {}
  };

  // ── Load issues ──────────────────────────────────────────────────────────
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

  // ── Scrape trigger ───────────────────────────────────────────────────────
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
        setRawInfo(`Raw OCR job başlatıldı: ${result.job_id}`);
      } else if (result?.status === "completed") {
        setRawInfo("Raw OCR tamamlandı.");
      } else {
        setRawInfo("Raw OCR job tetiklendi.");
      }
      setTimeout(refreshJobs, 1000);
    } catch (e) {
      setRawError("Raw OCR başlatılamadı: " + e.message);
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
      if (data?.error) throw new Error(data.error);
      setRawOutput(data);
      setRawInfo(`${scrapeDate} için raw çıktı yüklendi.`);
    } catch (e) {
      setRawOutput(null);
      setRawError("Raw çıktı okunamadı: " + e.message);
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

  const tabs = [
    { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
    { id: "scrape",    label: "Scrape",       icon: Zap },
    { id: "jobs",      label: "Job'lar",      icon: Clock },
    { id: "issues",    label: "Son Sayılar",  icon: FileText },
  ];

  const currentTab = tabs.find(t => t.id === activeTab);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate2-200 relative">
      {/* Decorative gradient orbs */}
      <div className="fixed top-0 left-56 right-0 bottom-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-gold-600/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/3 -right-20 w-[400px] h-[400px] rounded-full bg-gold-700/[0.025] blur-[100px]" />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full bg-gold-500/[0.02] blur-[80px]" />
      </div>

      {/* ── Sidebar ── */}
      <aside className="fixed top-0 left-0 h-full w-60 bg-gradient-to-b from-obsidian-900 via-obsidian-900 to-obsidian-950 border-r border-gold-700/10 flex flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-7 border-b border-gold-700/10">
          <div className="flex items-center gap-3 group">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border border-gold-500/60 rotate-45 group-hover:rotate-[135deg] transition-transform duration-700" />
              <div className="absolute inset-[6px] bg-gold-500/20 rotate-45 group-hover:bg-gold-500/40 transition-colors duration-500" />
            </div>
            <div>
              <span className="font-display text-lg font-light tracking-[0.08em]">
                AI<span className="text-gold-400">—</span>Mevzuat
              </span>
              <p className="text-gold-400/60 text-[10px] tracking-[0.2em] uppercase font-mono">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
                activeTab === id
                  ? "bg-gold-500/10 text-gold-400 tab-active-bar shadow-[inset_0_0_20px_rgba(212,160,23,0.03)]"
                  : "text-slate2-400 hover:text-slate2-200 hover:bg-white/[0.02]"
              }`}
            >
              <Icon size={16} strokeWidth={activeTab === id ? 2 : 1.5} />
              <span className="tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gold-700/20 to-transparent" />
        </div>

        {/* User Section */}
        <div className="px-5 py-5">
          <div className="admin-card p-3 mb-3">
            <p className="text-slate2-300 text-xs font-medium truncate">{user?.email}</p>
            <p className="text-slate2-400/60 text-[10px] mt-0.5 font-mono">Yönetici</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate2-400 hover:text-red-400 text-xs transition-colors duration-300 group w-full px-1"
          >
            <LogOut size={13} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="tracking-wider">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="ml-60 relative z-10 min-h-screen flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 admin-header-glass px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentTab && <currentTab.icon size={18} className="text-gold-400/70" />}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-slate2-300 text-xs tracking-[0.15em] uppercase font-mono">Admin</span>
                  <ChevronRight size={12} className="text-slate2-400/40" />
                  <span className="text-slate2-200 text-sm font-medium">{currentTab?.label}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate2-400/60 text-xs font-mono">{dateStr} · {timeStr}</span>
              <button
                onClick={() => { checkHealth(); refreshJobs(); loadIssues(); }}
                className="flex items-center gap-1.5 text-slate2-400 hover:text-gold-400 text-xs transition-all duration-300 hover:gap-2 px-3 py-1.5 rounded-lg hover:bg-gold-400/5"
              >
                <RefreshCw size={12} />
                <span className="tracking-wider">Yenile</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8">

          {/* ═══════════════ Dashboard Tab ═══════════════ */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Service Health */}
              <Reveal delay={0}>
                <p className="section-label mb-5">Servis Durumları</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { label: "Backend API", ok: health.backend, port: "5000", icon: Server, desc: "REST API Sunucusu" },
                    { label: "AI Service",  ok: health.ai,      port: "8000", icon: Cpu, desc: "OCR & RAG Pipeline" },
                  ].map(({ label, ok, port, icon: SIcon, desc }) => (
                    <div key={label} className="admin-card p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                            <SIcon size={18} className="text-gold-400" />
                          </div>
                          <div>
                            <p className="text-slate2-200 font-medium text-sm">{label}</p>
                            <p className="text-slate2-400/60 text-xs mt-0.5">{desc}</p>
                            <p className="text-slate2-400 text-xs mt-1 font-mono">:{port}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <StatusDot ok={ok} />
                          <span className={`text-xs font-medium ${ok ? "text-emerald-400" : ok === null ? "text-slate2-400" : "text-red-400"}`}>
                            {ok === null ? "Kontrol..." : ok ? "Çevrimiçi" : "Çevrimdışı"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Summary Stats */}
              <Reveal delay={1}>
                <p className="section-label mb-5">Genel Bakış</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    { label: "Toplam İş", value: Object.keys(jobs).length, icon: BarChart3 },
                    { label: "Tamamlanan", value: Object.values(jobs).filter(j => j.status === "completed").length, icon: CheckCircle },
                    { label: "Kayıtlı Sayı", value: issues.length, icon: FileText },
                  ].map(({ label, value, icon: SIcon }, idx) => (
                    <div key={label} className="admin-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center">
                          <SIcon size={16} className="text-gold-400/70" />
                        </div>
                        <p className="text-slate2-400 text-xs tracking-wider uppercase font-mono">{label}</p>
                      </div>
                      <AnimatedNumber value={value} />
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Recent Jobs Preview */}
              {jobList.length > 0 && (
                <Reveal delay={2}>
                  <div className="flex items-center justify-between mb-5">
                    <p className="section-label">Son İşler</p>
                    <button
                      onClick={() => setActiveTab("jobs")}
                      className="text-gold-400/60 hover:text-gold-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      Tümünü Gör <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {jobList.slice(0, 3).map(job => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                </Reveal>
              )}
            </div>
          )}

          {/* ═══════════════ Scrape Tab ═══════════════ */}
          {activeTab === "scrape" && (
            <div className="max-w-6xl space-y-8">
              <Reveal delay={0}>
                <p className="section-label mb-2">Raw OCR Pipeline</p>
                <p className="text-slate2-400/60 text-sm mb-6">Resmi Gazete belgelerini seçili tarih için OCR işleminden geçirin.</p>
              </Reveal>

              <div className="grid gap-6 lg:grid-cols-5">
                {/* Left: Configuration (3 cols) */}
                <Reveal delay={1} className="lg:col-span-2">
                  <div className="admin-card p-6 space-y-6">
                    <h3 className="text-slate2-200 text-sm font-medium flex items-center gap-2">
                      <Calendar size={14} className="text-gold-400/70" />
                      Yapılandırma
                    </h3>

                    {/* Date picker */}
                    <div>
                      <label className="block text-slate2-400/70 text-xs mb-2 tracking-wider uppercase font-mono">
                        Tarih
                      </label>
                      <input
                        type="date"
                        value={scrapeDate}
                        onChange={(e) => setScrapeDate(e.target.value)}
                        className="w-full bg-obsidian-900/80 border border-gold-700/15 rounded-xl px-4 py-3 text-slate2-200 text-sm focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/10 transition-all"
                      />
                    </div>

                    {/* Save to Backend toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-slate2-200 text-sm">Backend'e Kaydet</p>
                        <p className="text-slate2-400/50 text-xs mt-0.5">MSSQL'e ingest edilsin mi?</p>
                      </div>
                      <button
                        onClick={() => setSaveToBackend(!saveToBackend)}
                        className={`admin-toggle ${saveToBackend ? "active" : ""}`}
                        aria-label="Toggle save to backend"
                      />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-gold-700/15 to-transparent" />

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={handleRawScrape}
                        disabled={rawLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 disabled:opacity-40 disabled:cursor-not-allowed text-obsidian-950 font-medium text-sm py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-gold-500/10 hover:shadow-gold-500/20"
                      >
                        <Play size={14} />
                        {rawLoading ? "Çalışıyor..." : "Raw OCR Başlat"}
                      </button>
                      <button
                        onClick={loadRawOutput}
                        disabled={rawLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed text-slate2-200 text-sm py-3 rounded-xl border border-gold-700/15 hover:border-gold-700/30 transition-all duration-300"
                      >
                        <Database size={14} className="text-gold-400/70" />
                        Çıktıyı Göster
                      </button>
                    </div>

                    <p className="text-slate2-400/40 text-[11px] leading-relaxed">
                      Raw OCR arka planda çalışır. SQL kaydı için yukarıdaki toggle kullanılır.
                    </p>
                  </div>
                </Reveal>

                {/* Right: Results & Output (2 cols) */}
                <Reveal delay={2} className="lg:col-span-3">
                  <div className="admin-card p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-slate2-200 text-sm font-medium flex items-center gap-2">
                        <Activity size={14} className="text-gold-400/70" />
                        Pipeline Durumu
                      </h3>
                      <button
                        onClick={refreshJobs}
                        className="text-slate2-400/60 hover:text-gold-400 text-xs transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCw size={11} />
                        Yenile
                      </button>
                    </div>

                    {/* Status Messages */}
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

                    {/* Raw Output */}
                    {rawOutput ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Kaynak",        value: rawOutput.source_count ?? 0 },
                            { label: "Belge",          value: rawOutput.summary?.documents_written ?? 0 },
                            { label: "Tablo Sayfası",  value: rawOutput.summary?.table_pages_masked_total ?? 0 },
                            { label: "Tablo Bölgesi",  value: rawOutput.summary?.table_regions_masked_total ?? 0 },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-obsidian-900/60 border border-gold-700/8 rounded-xl px-4 py-3">
                              <p className="text-slate2-400/60 text-[10px] tracking-wider uppercase font-mono">{label}</p>
                              <p className="text-slate2-200 text-lg font-display mt-1">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 max-h-72 overflow-auto pr-1 custom-scrollbar">
                          {(rawOutput.documents_preview || []).map((doc, idx) => (
                            <div
                              key={`${doc.source_url || doc.title_hint || "doc"}_${idx}`}
                              className="bg-obsidian-900/40 border border-gold-700/8 rounded-xl px-4 py-3 hover:border-gold-700/20 transition-colors"
                            >
                              <p className="text-slate2-200 text-xs font-medium truncate">
                                {doc.title_hint || doc.source_url || "Belge"}
                              </p>
                              <p className="text-slate2-400/50 text-[11px] mt-1">
                                {doc.source_type || "unknown"} • {doc.char_count ?? 0} karakter
                              </p>
                              {doc.table_detected && (
                                <p className="text-gold-400/80 text-[11px] mt-1 flex items-center gap-1">
                                  <Layers size={10} />
                                  tablo algılandı (sayfa {doc.table_pages_masked ?? 0}, bölge {doc.table_regions_masked ?? 0})
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
                        <p className="text-slate2-400/50 text-sm">Henüz çıktı yok</p>
                        <p className="text-slate2-400/30 text-xs mt-1">Bir tarih seçip OCR başlatın veya mevcut çıktıyı yükleyin.</p>
                      </div>
                    )}
                  </div>
                </Reveal>
              </div>
            </div>
          )}

          {/* ═══════════════ Jobs Tab ═══════════════ */}
          {activeTab === "jobs" && (
            <div>
              <Reveal delay={0}>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="section-label mb-2">Job'lar</p>
                    <p className="text-slate2-400/50 text-sm">
                      {jobList.length > 0
                        ? `Toplam ${jobList.length} iş · ${Object.values(jobs).filter(j => j.status === "running").length} çalışıyor`
                        : "Henüz herhangi bir iş yok."}
                    </p>
                  </div>
                  <button
                    onClick={refreshJobs}
                    className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-xs transition-all duration-300 px-3 py-2 rounded-lg hover:bg-gold-400/5"
                  >
                    <RefreshCw size={13} />
                    Yenile
                  </button>
                </div>
              </Reveal>

              {jobList.length === 0 ? (
                <Reveal delay={1}>
                  <div className="text-center py-20">
                    <div className="w-20 h-20 rounded-2xl bg-gold-500/5 flex items-center justify-center mx-auto mb-5">
                      <Clock size={32} className="text-gold-400/20" />
                    </div>
                    <p className="text-slate2-400/50 text-sm">Henüz job yok</p>
                    <p className="text-slate2-400/30 text-xs mt-1">Bir scrape işlemi başlattığınızda burada görünecektir.</p>
                    <button
                      onClick={() => setActiveTab("scrape")}
                      className="mt-5 text-gold-400/60 hover:text-gold-400 text-xs flex items-center gap-1 mx-auto transition-colors"
                    >
                      Scrape'e Git <ChevronRight size={12} />
                    </button>
                  </div>
                </Reveal>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {jobList.map((job, idx) => (
                    <Reveal key={job.id} delay={idx < 9 ? idx + 1 : 9}>
                      <JobCard job={job} />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ Issues Tab ═══════════════ */}
          {activeTab === "issues" && (
            <div>
              <Reveal delay={0}>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="section-label mb-2">Son Sayılar</p>
                    <p className="text-slate2-400/50 text-sm">
                      {issues.length > 0
                        ? `Kayıtlı ${issues.length} sayı`
                        : "Henüz kayıtlı sayı yok."}
                    </p>
                  </div>
                  <button
                    onClick={loadIssues}
                    className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-xs transition-all duration-300 px-3 py-2 rounded-lg hover:bg-gold-400/5"
                  >
                    <RefreshCw size={13} />
                    Yenile
                  </button>
                </div>
              </Reveal>

              {issues.length === 0 ? (
                <Reveal delay={1}>
                  <div className="text-center py-20">
                    <div className="w-20 h-20 rounded-2xl bg-gold-500/5 flex items-center justify-center mx-auto mb-5">
                      <FileText size={32} className="text-gold-400/20" />
                    </div>
                    <p className="text-slate2-400/50 text-sm">Henüz kayıtlı sayı yok</p>
                    <p className="text-slate2-400/30 text-xs mt-1">Bir scrape tamamlandığında burada listelenir.</p>
                  </div>
                </Reveal>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue, idx) => (
                    <Reveal key={issue.id} delay={idx < 8 ? idx + 1 : 8}>
                      <div className="admin-card p-5 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gold-500/8 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-500/12 transition-colors">
                            <FileText size={16} className="text-gold-400/70" />
                          </div>
                          <div>
                            <p className="text-slate2-200 font-medium text-sm">Sayı {issue.issueNumber}</p>
                            <p className="text-slate2-400/50 text-xs mt-0.5 font-mono">
                              {issue.publishedDate?.split("T")[0]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5 bg-gold-400/5 border border-gold-400/10 text-gold-400 text-xs px-3 py-1.5 rounded-full">
                            <Layers size={11} />
                            {issue.documentCount ?? "—"} belge
                          </span>
                          <CheckCircle size={16} className="text-emerald-400/60" />
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
