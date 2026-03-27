import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { adminApi, gazetteApi } from "../services/api";
import DashboardTab from "../components/admin/tabs/DashboardTab";
import ScrapeTab from "../components/admin/tabs/ScrapeTab";
import JobsTab from "../components/admin/tabs/JobsTab";
import IssuesTab from "../components/admin/tabs/IssuesTab";
import LegalTab from "../components/admin/tabs/LegalTab";

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [health, setHealth] = useState({ backend: null, ai: null });
  const [jobs, setJobs] = useState({});
  const [issues, setIssues] = useState([]);

  const [scrapeDate, setScrapeDate] = useState(new Date().toISOString().split("T")[0]);
  const [saveToBackend, setSaveToBackend] = useState(true);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState(null);
  const [rawInfo, setRawInfo] = useState("");
  const [rawError, setRawError] = useState("");

  const [legalQueryText, setLegalQueryText] = useState("ozel tuketim vergisi");
  const [legalMaxResults, setLegalMaxResults] = useState(5);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalResult, setLegalResult] = useState(null);
  const [legalError, setLegalError] = useState("");
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState("");

  const pollRef = useRef(null);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "scrape", label: "Scrape", icon: Zap },
    { id: "jobs", label: "Job'lar", icon: RefreshCw },
    { id: "issues", label: "Son Sayilar", icon: FileText },
    { id: "legal", label: "Legal Test", icon: Search },
  ];

  const currentTab = tabs.find((x) => x.id === activeTab);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const jobList = useMemo(
    () => Object.entries(jobs).map(([id, job]) => ({ id, ...job })).sort((a, b) => b.id.localeCompare(a.id)),
    [jobs]
  );

  const checkHealth = async () => {
    const [be, ai] = await Promise.allSettled([adminApi.backendHealth(), adminApi.aiHealth()]);
    setHealth({
      backend: be.status === "fulfilled" && be.value?.status === "ok",
      ai: ai.status === "fulfilled" && ai.value?.status === "ok",
    });
  };

  const refreshJobs = async () => {
    try {
      const data = await adminApi.listJobs();
      setJobs(data.jobs || {});
    } catch {}
  };

  const loadIssues = async () => {
    try {
      const data = await gazetteApi.getIssues({ pageSize: 15 });
      setIssues(data.items || data || []);
    } catch {}
  };

  useEffect(() => {
    checkHealth();
    refreshJobs();
    loadIssues();

    pollRef.current = setInterval(refreshJobs, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
        setRawInfo("Raw OCR tetiklendi.");
      }
      setTimeout(refreshJobs, 1200);
    } catch (e) {
      setRawError(`Raw OCR baslatilamadi: ${e.message}`);
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
      setRawOutput(data);
      setRawInfo(`${scrapeDate} icin raw cikti yuklendi.`);
    } catch (e) {
      setRawOutput(null);
      setRawError(`Raw cikti okunamadi: ${e.message}`);
    } finally {
      setRawLoading(false);
    }
  };

  const handleLegalSearch = async () => {
    setLegalLoading(true);
    setLegalError("");
    setCacheInfo("");
    try {
      const data = await adminApi.legalQuery(legalQueryText, legalMaxResults);
      setLegalResult(data);
    } catch (e) {
      setLegalResult(null);
      setLegalError(e.message);
    } finally {
      setLegalLoading(false);
    }
  };

  const handleClearCache = async (query) => {
    setCacheLoading(true);
    setCacheInfo("");
    try {
      const data = await adminApi.clearLegalCache(query || "");
      setCacheInfo(data.message || "Cache temizlendi.");
    } catch (e) {
      setCacheInfo(`Cache temizleme hatasi: ${e.message}`);
    } finally {
      setCacheLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/giris");
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate2-200 relative">
      <aside className="fixed top-0 left-0 h-full w-60 bg-gradient-to-b from-obsidian-900 via-obsidian-900 to-obsidian-950 border-r border-gold-700/10 flex flex-col z-40">
        <div className="px-6 py-7 border-b border-gold-700/10">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border border-gold-500/60 rotate-45" />
              <div className="absolute inset-[6px] bg-gold-500/20 rotate-45" />
            </div>
            <div>
              <span className="font-display text-lg font-light tracking-[0.08em]">
                AI<span className="text-gold-400">-</span>Mevzuat
              </span>
              <p className="text-gold-400/60 text-[10px] tracking-[0.2em] uppercase font-mono">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
                activeTab === id
                  ? "bg-gold-500/10 text-gold-400 tab-active-bar"
                  : "text-slate2-400 hover:text-slate2-200 hover:bg-white/[0.02]"
              }`}
            >
              <Icon size={16} />
              <span className="tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mx-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gold-700/20 to-transparent" />
        </div>

        <div className="px-5 py-5">
          <div className="admin-card p-3 mb-3">
            <p className="text-slate2-300 text-xs font-medium truncate">{user?.email}</p>
            <p className="text-slate2-400/60 text-[10px] mt-0.5 font-mono">Yonetici</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate2-400 hover:text-red-400 text-xs transition-colors w-full px-1"
          >
            <LogOut size={13} />
            <span className="tracking-wider">Cikis Yap</span>
          </button>
        </div>
      </aside>

      <main className="ml-60 relative z-10 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 admin-header-glass px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentTab && <currentTab.icon size={18} className="text-gold-400/70" />}
              <div className="flex items-center gap-2">
                <span className="text-slate2-300 text-xs tracking-[0.15em] uppercase font-mono">Admin</span>
                <ChevronRight size={12} className="text-slate2-400/40" />
                <span className="text-slate2-200 text-sm font-medium">{currentTab?.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate2-400/60 text-xs font-mono">{dateStr} - {timeStr}</span>
              <button
                onClick={() => {
                  checkHealth();
                  refreshJobs();
                  loadIssues();
                }}
                className="flex items-center gap-1.5 text-slate2-400 hover:text-gold-400 text-xs px-3 py-1.5 rounded-lg hover:bg-gold-400/5"
              >
                <RefreshCw size={12} />
                Yenile
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8">
          {activeTab === "dashboard" && (
            <DashboardTab
              health={health}
              jobs={jobs}
              issues={issues}
              jobList={jobList}
              onGoJobs={() => setActiveTab("jobs")}
            />
          )}

          {activeTab === "scrape" && (
            <ScrapeTab
              scrapeDate={scrapeDate}
              setScrapeDate={setScrapeDate}
              saveToBackend={saveToBackend}
              setSaveToBackend={setSaveToBackend}
              rawLoading={rawLoading}
              rawInfo={rawInfo}
              rawError={rawError}
              rawOutput={rawOutput}
              onStart={handleRawScrape}
              onLoadOutput={loadRawOutput}
              onRefreshJobs={refreshJobs}
            />
          )}

          {activeTab === "jobs" && (
            <JobsTab
              jobList={jobList}
              jobs={jobs}
              onRefresh={refreshJobs}
              onGoScrape={() => setActiveTab("scrape")}
            />
          )}

          {activeTab === "issues" && <IssuesTab issues={issues} onRefresh={loadIssues} />}

          {activeTab === "legal" && (
            <LegalTab
              queryText={legalQueryText}
              setQueryText={setLegalQueryText}
              maxResults={legalMaxResults}
              setMaxResults={setLegalMaxResults}
              loading={legalLoading}
              result={legalResult}
              error={legalError}
              cacheInfo={cacheInfo}
              cacheLoading={cacheLoading}
              onSearch={handleLegalSearch}
              onClearCache={handleClearCache}
            />
          )}
        </div>
      </main>
    </div>
  );
}
