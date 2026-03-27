import { FileText, Layers, RefreshCw } from "lucide-react";
import Reveal from "../Reveal";

export default function IssuesTab({ issues, onRefresh }) {
  return (
    <div>
      <Reveal delay={0}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-label mb-2">Son Sayilar</p>
            <p className="text-slate2-400/50 text-sm">{issues.length > 0 ? `Kayitli ${issues.length} sayi` : "Henuz kayitli sayi yok."}</p>
          </div>
          <button onClick={onRefresh} className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-xs px-3 py-2 rounded-lg">
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
            <p className="text-slate2-400/50 text-sm">Henuz kayitli sayi yok</p>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, idx) => (
            <Reveal key={issue.id} delay={idx < 8 ? idx + 1 : 8}>
              <div className="admin-card p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/8 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-gold-400/70" />
                  </div>
                  <div>
                    <p className="text-slate2-200 font-medium text-sm">Sayi {issue.issueNumber}</p>
                    <p className="text-slate2-400/50 text-xs mt-0.5 font-mono">{issue.publishedDate?.split("T")[0]}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-gold-400/5 border border-gold-400/10 text-gold-400 text-xs px-3 py-1.5 rounded-full">
                  <Layers size={11} />
                  {issue.documentCount ?? "-"} belge
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
