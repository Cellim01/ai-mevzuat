import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { gazetteApi, legalApi } from "../services/api";
import {
  Search, ChevronLeft, ChevronRight, LogOut, Calendar,
  SlidersHorizontal, X, ChevronDown, User, BookOpen,
  Sparkles, Bell, Send, FileSearch,
} from "lucide-react";

/* ─── Sabitler ─────────────────────────────────────────────── */
const PAGE_SIZE = 15;

const CATEGORIES = [
  { value: "", label: "Tümü" },
  { value: "Yonetmelik", label: "Yönetmelik" },
  { value: "Teblig", label: "Tebliğ" },
  { value: "Kanun", label: "Kanun" },
  { value: "Cumhurbaskanligi", label: "Cumhurbaşkanlığı" },
  { value: "Bankacilik", label: "Bankacılık" },
  { value: "SermayePiyasasi", label: "Sermaye Piyasası" },
  { value: "FinansVergi", label: "Finans & Vergi" },
  { value: "DisTicaret", label: "Dış Ticaret" },
  { value: "AkademikIlan", label: "Akademik İlan" },
  { value: "InsanKaynaklari", label: "İnsan Kaynakları" },
  { value: "Saglik", label: "Sağlık" },
  { value: "CevreEnerji", label: "Çevre & Enerji" },
  { value: "IhaleIlan", label: "İhale İlanı" },
  { value: "YargiKarari", label: "Yargı Kararı" },
  { value: "YargiIlan", label: "Yargı İlanı" },
  { value: "CesitliIlan", label: "Çeşitli İlan" },
  { value: "Diger", label: "Diğer" },
];

const CAT_COLORS = {
  Yonetmelik: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  Teblig: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  Kanun: "bg-red-500/10 text-red-300 border-red-500/20",
  Cumhurbaskanligi: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  Bankacilik: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  SermayePiyasasi: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  FinansVergi: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  DisTicaret: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  AkademikIlan: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  InsanKaynaklari: "bg-pink-500/10 text-pink-300 border-pink-500/20",
  Saglik: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  CevreEnerji: "bg-lime-500/10 text-lime-300 border-lime-500/20",
  IhaleIlan: "bg-yellow-600/10 text-yellow-200 border-yellow-600/20",
  YargiKarari: "bg-red-700/10 text-red-300 border-red-700/20",
  YargiIlan: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  CesitliIlan: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  Diger: "bg-white/5 text-slate2-400 border-white/10",
};

function catLabel(v) { return CATEGORIES.find(c => c.value === v)?.label ?? v; }
function catColor(v) { return CAT_COLORS[v] ?? CAT_COLORS.Diger; }

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function excerpt(t, n = 150) {
  if (!t) return "";
  const c = t.replace(/\s+/g, " ").trim();
  return c.length > n ? c.slice(0, n) + "…" : c;
}

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="panel-doc-card p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-obsidian-700" />
        <div className="h-4 w-16 rounded-full bg-obsidian-700" />
      </div>
      <div className="h-4 w-3/4 rounded bg-obsidian-700" />
      <div className="h-3 w-5/6 rounded bg-obsidian-800" />
      <div className="h-3 w-2/3 rounded bg-obsidian-800" />
    </div>
  );
}

/* ─── DocCard ───────────────────────────────────────────────── */
function DocCard({ doc }) {
  const navigate = useNavigate();
  const preview = excerpt(doc.summary, 170);

  return (
    <article
      onClick={() => navigate(`/panel/belge/${doc.id}`)}
      className="panel-doc-card group cursor-pointer p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-slate2-400/50 text-[11px] font-mono">
          <Calendar size={10} />
          <span>{fmtDate(doc.publishedDate ?? doc.issue?.publishedDate)}</span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 ${catColor(doc.category)}`}>
          {catLabel(doc.category)}
        </span>
      </div>

      <h3 className="font-display text-sm font-light text-slate2-200 leading-snug mb-2 group-hover:text-gold-200 transition-colors line-clamp-2">
        {doc.title}
      </h3>

      {preview ? (
        <p className="text-slate2-400/55 text-[11px] leading-relaxed line-clamp-3 mb-3">
          {preview}
        </p>
      ) : (
        <p className="text-slate2-400/45 text-[11px] leading-relaxed line-clamp-2 mb-3 italic">
          Kisa ozet bulunamadi. Detay ve resmi kaynaklar icin belgeyi acin.
        </p>
      )}

      <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
        <span className="text-[10px] text-slate2-400/35 font-mono">
          {doc.pdfUrl || doc.htmlUrl ? "Resmi kaynak mevcut" : "Kaynak bilgisi yok"}
        </span>
        <ChevronRight size={11} className="text-gold-500/25 group-hover:text-gold-400 transition-colors" />
      </div>
    </article>
  );
}

/* ─── Legal Chat ────────────────────────────────────────────── */
function LegalChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await legalApi.query(q, 3);
      setMessages(m => [...m, {
        role: "ai",
        text: res.message,
        sources: res.sources ?? [],
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: "ai", text: `Hata: ${e.message}`, sources: [] }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const SUGGESTIONS = [
    "2024'te KDV oranında değişiklik var mı?",
    "Anonim şirket kurmak için ne gerekli?",
    "İhracat destekleri nelerdir?",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mesaj listesi */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-1 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-11 h-11 rounded-2xl bg-gold-500/6 flex items-center justify-center mb-3">
              <Sparkles size={18} className="text-gold-400/35" />
            </div>
            <p className="text-slate2-400/50 text-sm mb-4">Mevzuat hakkında soru sorun</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-xs text-slate2-400/60 hover:text-gold-400 px-3 py-1.5 rounded-lg border border-gold-700/10 hover:border-gold-500/25 transition-all text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gold-500/10 border border-gold-500/18 text-slate2-200 rounded-br-sm"
                  : "bg-obsidian-800 border border-white/6 text-slate2-300 rounded-bl-sm"
              }`}>
                <p className="font-light">{m.text}</p>
                {m.sources?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
                    {m.sources.map((s, j) => (
                      <div key={j}>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gold-500/50 font-mono">·</span>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer"
                              className="text-gold-400/75 hover:text-gold-300 underline underline-offset-2 truncate max-w-[260px]">
                              {s.title}
                            </a>
                          ) : (
                            <span className="text-slate2-400 truncate max-w-[260px]">{s.title}</span>
                          )}
                        </div>
                        {s.snippet && (
                          <p className="text-slate2-400/55 text-[11px] pl-3 mt-0.5 leading-relaxed line-clamp-2">
                            {s.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-obsidian-800 border border-white/6">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold-400/50 inline-block"
                    style={{ animation: `bounce 1s ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-white/5 mt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Soru sorun…"
          className="flex-1 bg-obsidian-900 border border-gold-700/15 rounded-xl px-3.5 py-2.5 text-slate2-200 text-sm placeholder-slate2-400/30 focus:outline-none focus:border-gold-500/40 transition-colors"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-3 py-2.5 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/18 text-gold-400 rounded-xl transition-all disabled:opacity-30 flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

/* ─── Pagination ────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const nums = [];
  const half = 2;
  let from = Math.max(1, page - half);
  let to = Math.min(totalPages, page + half);
  if (to - from < half * 2) {
    from = Math.max(1, to - half * 2);
    to = Math.min(totalPages, from + half * 2);
  }
  for (let i = from; i <= to; i++) nums.push(i);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button
        onClick={() => onChange(page - 1)} disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gold-700/12 text-slate2-400 hover:text-gold-400 disabled:opacity-25 transition-all"
      >
        <ChevronLeft size={13} />
      </button>
      {from > 1 && <><button onClick={() => onChange(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gold-700/10 text-slate2-400 text-xs hover:text-slate2-200">1</button>{from > 2 && <span className="text-slate2-400/40 text-xs px-1">…</span>}</>}
      {nums.map(n => (
        <button key={n} onClick={() => onChange(n)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all ${n === page ? "bg-gold-500/12 border border-gold-500/28 text-gold-400" : "border border-gold-700/10 text-slate2-400 hover:text-slate2-200"}`}>
          {n}
        </button>
      ))}
      {to < totalPages && <>{to < totalPages - 1 && <span className="text-slate2-400/40 text-xs px-1">…</span>}<button onClick={() => onChange(totalPages)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gold-700/10 text-slate2-400 text-xs hover:text-slate2-200">{totalPages}</button></>}
      <button
        onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gold-700/12 text-slate2-400 hover:text-gold-400 disabled:opacity-25 transition-all"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

/* ─── Ana Sayfa ─────────────────────────────────────────────── */
export default function PanelPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* Nav durumu */
  const [activeNav, setActiveNav] = useState("belgeler");

  /* Belge filtreler */
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  /* Belge verisi */
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount = [search, category, dateFrom, dateTo].filter(Boolean).length;

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await gazetteApi.getDocuments({ page, pageSize: PAGE_SIZE, category, from: dateFrom, to: dateTo, search });
      setDocs(d.items ?? []);
      setTotal(d.totalCount ?? d.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, category, search, dateFrom, dateTo]);

  useEffect(() => { if (activeNav === "belgeler") fetchDocs(); }, [fetchDocs, activeNav]);

  const applySearch = () => { setSearch(draft); setPage(1); };
  const clearAll = () => { setSearch(""); setDraft(""); setCategory(""); setDateFrom(""); setDateTo(""); setPage(1); setFilterOpen(false); };

  const NAV = [
    { id: "belgeler", label: "Belgeler", icon: BookOpen },
    { id: "chat", label: "Legal Chat", icon: Sparkles },
    { id: "bildirimler", label: "Bildirimler", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 flex text-slate2-200">

      {/* ─ Sidebar ─ */}
      <aside className="fixed inset-y-0 left-0 w-52 flex flex-col bg-obsidian-900/95 border-r border-gold-700/10 z-40 backdrop-blur-xl">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-gold-700/10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-6 h-6 flex-shrink-0">
              <div className="absolute inset-0 border border-gold-500/55 rotate-45 group-hover:rotate-[135deg] transition-transform duration-700" />
              <div className="absolute inset-[4px] bg-gold-500/18 rotate-45" />
            </div>
            <span className="font-display text-base font-light tracking-[0.08em]">
              AI<span className="text-gold-400">—</span>Mevzuat
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeNav === id
                  ? "bg-gold-500/10 text-gold-400 tab-active-bar"
                  : "text-slate2-400 hover:text-slate2-200 hover:bg-white/[0.025]"
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="font-light">{label}</span>
            </button>
          ))}
        </nav>

        {/* Kullanıcı */}
        <div className="px-3 pb-5 pt-4 border-t border-gold-700/10 space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-gold-500/12 border border-gold-500/18 flex items-center justify-center flex-shrink-0">
              <User size={12} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-slate2-200 text-xs font-medium truncate">{user?.name || user?.email}</p>
              <p className="text-slate2-400/45 text-[10px] font-mono truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/giris"); }}
            className="flex items-center gap-2.5 px-2 py-2 text-slate2-400 hover:text-red-400 text-xs transition-colors w-full rounded-xl hover:bg-red-400/5"
          >
            <LogOut size={13} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* ─ Main ─ */}
      <main className="ml-52 flex-1 flex flex-col min-h-screen">

        {/* ── BELGELER ── */}
        {activeNav === "belgeler" && (
          <>
            {/* Sticky arama header */}
            <header className="sticky top-0 z-30 bg-obsidian-950/96 backdrop-blur-xl border-b border-gold-700/8 px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400/40" />
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applySearch()}
                    placeholder="Başlık veya içerik ara…"
                    className="w-full bg-obsidian-800/70 border border-gold-700/12 rounded-xl pl-8 pr-3 py-2 text-slate2-200 text-sm placeholder-slate2-400/30 focus:outline-none focus:border-gold-500/38 transition-colors"
                  />
                </div>
                <button
                  onClick={applySearch}
                  className="px-3 py-2 bg-gold-500/10 hover:bg-gold-500/18 border border-gold-500/18 text-gold-400 text-xs rounded-xl transition-all"
                >
                  Ara
                </button>
                <button
                  onClick={() => setFilterOpen(v => !v)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                    filterOpen || activeCount > 0
                      ? "bg-gold-500/10 border-gold-500/28 text-gold-400"
                      : "bg-obsidian-800/50 border-gold-700/12 text-slate2-400 hover:text-slate2-200"
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  Filtre
                  {activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold-500 rounded-full text-[9px] text-obsidian-950 font-bold flex items-center justify-center leading-none">
                      {activeCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Filtre paneli */}
              {filterOpen && (
                <div className="mt-3 p-4 bg-obsidian-900/80 border border-gold-700/10 rounded-2xl backdrop-blur-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Kategori */}
                    <div>
                      <label className="block text-slate2-400/55 text-[10px] tracking-wider uppercase font-mono mb-1.5">Kategori</label>
                      <div className="relative">
                        <select
                          value={category}
                          onChange={e => { setCategory(e.target.value); setPage(1); }}
                          className="w-full bg-obsidian-800 border border-gold-700/12 rounded-xl px-3 py-2 text-slate2-200 text-xs appearance-none focus:outline-none focus:border-gold-500/38 pr-7"
                        >
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate2-400/40 pointer-events-none" />
                      </div>
                    </div>
                    {/* Başlangıç tarihi */}
                    <div>
                      <label className="block text-slate2-400/55 text-[10px] tracking-wider uppercase font-mono mb-1.5">Başlangıç</label>
                      <input
                        type="date" value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                        className="w-full bg-obsidian-800 border border-gold-700/12 rounded-xl px-3 py-2 text-slate2-200 text-xs focus:outline-none focus:border-gold-500/38"
                      />
                    </div>
                    {/* Bitiş tarihi */}
                    <div>
                      <label className="block text-slate2-400/55 text-[10px] tracking-wider uppercase font-mono mb-1.5">Bitiş</label>
                      <input
                        type="date" value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); }}
                        className="w-full bg-obsidian-800 border border-gold-700/12 rounded-xl px-3 py-2 text-slate2-200 text-xs focus:outline-none focus:border-gold-500/38"
                      />
                    </div>
                  </div>
                  {activeCount > 0 && (
                    <button
                      onClick={clearAll}
                      className="mt-3 flex items-center gap-1.5 text-slate2-400 hover:text-red-400 text-xs transition-colors"
                    >
                      <X size={11} /> Tüm filtreleri temizle
                    </button>
                  )}
                </div>
              )}
            </header>

            {/* İçerik */}
            <div className="flex-1 p-6">
              {/* Başlık + aktif filtre chips */}
              <div className="flex items-start justify-between mb-5 gap-4">
                <div>
                  <h1 className="font-display text-xl font-light text-slate2-200">
                    {category ? catLabel(category) : "Tüm Belgeler"}
                  </h1>
                  <p className="text-slate2-400/45 text-xs mt-0.5 font-mono">
                    {loading ? "Yükleniyor…" : `${total.toLocaleString("tr-TR")} belge`}
                  </p>
                </div>
                {activeCount > 0 && !loading && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-xs">
                    {search && (
                      <span className="filter-chip">
                        "{search}"
                        <button onClick={() => { setSearch(""); setDraft(""); setPage(1); }}><X size={9} /></button>
                      </span>
                    )}
                    {category && (
                      <span className="filter-chip">
                        {catLabel(category)}
                        <button onClick={() => { setCategory(""); setPage(1); }}><X size={9} /></button>
                      </span>
                    )}
                    {(dateFrom || dateTo) && (
                      <span className="filter-chip">
                        {dateFrom || "?"} – {dateTo || "?"}
                        <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}><X size={9} /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Hata */}
              {error && (
                <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-500/6 border border-red-500/18 rounded-xl text-red-400 text-sm">
                  <X size={14} className="flex-shrink-0" /> {error}
                </div>
              )}

              {/* Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => <Skeleton key={i} />)}
                </div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gold-500/5 flex items-center justify-center mb-4">
                    <FileSearch size={24} className="text-gold-400/20" />
                  </div>
                  <p className="text-slate2-400/45 text-sm">Belge bulunamadı</p>
                  {activeCount > 0 && (
                    <button onClick={clearAll} className="mt-3 text-gold-400/55 hover:text-gold-400 text-xs transition-colors">
                      Filtreleri temizle →
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {docs.map(doc => <DocCard key={doc.id} doc={doc} />)}
                </div>
              )}

              <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </div>
          </>
        )}

        {/* ── LEGAL CHAT ── */}
        {activeNav === "chat" && (
          <div className="flex-1 flex flex-col p-6 max-w-2xl w-full mx-auto">
            <div className="mb-5">
              <p className="section-label mb-2">Legal Chat</p>
              <p className="text-slate2-400/50 text-sm">Local RG veritabanı ve dış kaynaklardan yanıt verilir.</p>
            </div>
            <div className="flex-1 admin-card p-5 flex flex-col min-h-0">
              <LegalChat />
            </div>
          </div>
        )}

        {/* ── BİLDİRİMLER ── */}
        {activeNav === "bildirimler" && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-500/5 flex items-center justify-center mb-4">
                <Bell size={22} className="text-gold-400/20" />
              </div>
              <p className="text-slate2-400/45 text-sm">Bildirim sistemi yakında</p>
              <p className="text-slate2-400/30 text-xs mt-2 leading-relaxed">
                Anahtar kelime aboneliği ile yeni Resmi Gazete yayınlarından anında haberdar olacaksınız.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
