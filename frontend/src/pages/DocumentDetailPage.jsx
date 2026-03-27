import { Link, useNavigate, useParams } from "react-router-dom";
import { gazetteApi } from "../services/api";
import { ArrowLeft, Calendar, ExternalLink, FileText, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const CAT_LABELS = {
  Yonetmelik: "Yonetmelik",
  Teblig: "Teblig",
  Kanun: "Kanun",
  Cumhurbaskanligi: "Cumhurbaskanligi",
  Bankacilik: "Bankacilik",
  SermayePiyasasi: "Sermaye Piyasasi",
  FinansVergi: "Finans ve Vergi",
  DisTicaret: "Dis Ticaret",
  AkademikIlan: "Akademik Ilan",
  InsanKaynaklari: "Insan Kaynaklari",
  Saglik: "Saglik",
  CevreEnerji: "Cevre ve Enerji",
  IhaleIlan: "Ihale Ilani",
  YargiKarari: "Yargi Karari",
  YargiIlan: "Yargi Ilani",
  CesitliIlan: "Cesitli Ilan",
  Diger: "Diger",
};

function catLabel(value) {
  return CAT_LABELS[value] ?? value ?? "Diger";
}

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError("");

    gazetteApi
      .getDocument(id)
      .then((data) => setDoc(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <Loader2 size={28} className="text-gold-400/50 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center text-center px-4">
        <div>
          <p className="text-slate2-400/50 text-sm mb-4">{error || "Belge bulunamadi."}</p>
          <button
            onClick={() => navigate("/panel")}
            className="text-gold-400 hover:text-gold-300 text-sm flex items-center gap-1.5 mx-auto transition-colors"
          >
            <ArrowLeft size={14} /> Panele Don
          </button>
        </div>
      </div>
    );
  }

  const summary = (doc.summary || "").trim();
  const hasSummary = summary.length > 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate2-200">
      <header className="sticky top-0 z-30 bg-obsidian-950/96 backdrop-blur-xl border-b border-gold-700/8 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/panel")}
            className="flex items-center gap-1.5 text-slate2-400 hover:text-gold-400 text-sm transition-colors"
          >
            <ArrowLeft size={14} />
          </button>

          <span className="text-slate2-400/30 text-xs font-mono">|</span>

          <div className="flex items-center gap-1.5 text-xs font-mono overflow-hidden">
            <Link to="/panel" className="text-slate2-400/50 hover:text-slate2-300 transition-colors">
              Panel
            </Link>
            <span className="text-slate2-400/30">/</span>
            <span className="text-slate2-300 truncate max-w-[260px]">{doc.title}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate2-400/50">
            <Calendar size={11} />
            <span>{fmtDate(doc.publishedDate)}</span>
          </div>
          {doc.issueNumber > 0 && <span className="text-slate2-400/40">Sayi {doc.issueNumber}</span>}
          <span className="px-2 py-0.5 bg-gold-500/8 border border-gold-500/15 text-gold-400/80 rounded-full text-[10px]">
            {catLabel(doc.category)}
          </span>
        </div>

        <h1 className="font-display text-2xl md:text-3xl font-light text-slate2-100 leading-snug mb-6">
          {doc.title}
        </h1>

        <section className="mb-6 p-5 bg-obsidian-900/60 border border-gold-700/10 rounded-2xl">
          <p className="text-gold-400/70 text-[10px] font-mono tracking-wider uppercase mb-2">Belge Ozeti</p>
          {hasSummary ? (
            <p className="text-slate2-300 text-sm leading-relaxed font-light">{summary}</p>
          ) : (
            <p className="text-slate2-400/60 text-sm leading-relaxed">
              Bu belge icin panelde ozet metni yok. Tam metni resmi kaynaktan inceleyebilirsin.
            </p>
          )}
        </section>

        <section className="p-5 bg-obsidian-900/60 border border-gold-700/10 rounded-2xl">
          <p className="text-gold-400/70 text-[10px] font-mono tracking-wider uppercase mb-3">Resmi Kaynaklar</p>
          <div className="flex flex-wrap gap-3">
            {doc.pdfUrl && (
              <a
                href={doc.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500/8 hover:bg-gold-500/15 border border-gold-500/18 text-gold-400 text-xs rounded-xl transition-all"
              >
                <FileText size={13} />
                PDF Ac
                <ExternalLink size={11} className="opacity-60" />
              </a>
            )}
            {doc.htmlUrl && (
              <a
                href={doc.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/4 hover:bg-white/6 border border-white/8 text-slate2-300 text-xs rounded-xl transition-all"
              >
                <Globe size={13} />
                HTML Ac
                <ExternalLink size={11} className="opacity-60" />
              </a>
            )}
            {!doc.pdfUrl && !doc.htmlUrl && (
              <p className="text-slate2-400/55 text-sm">Bu belge icin kaynak baglantisi bulunmuyor.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

