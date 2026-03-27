import { Activity, AlertCircle, Calendar, CheckCircle, Clock, FileText, Layers, RefreshCw } from "lucide-react";

const STATUS = {
  completed: { color: "text-emerald-400", bg: "bg-emerald-400/5", border: "border-emerald-400/20", icon: CheckCircle },
  running: { color: "text-gold-400", bg: "bg-gold-400/5", border: "border-gold-400/20", icon: RefreshCw },
  failed: { color: "text-red-400", bg: "bg-red-400/5", border: "border-red-400/20", icon: AlertCircle },
  error: { color: "text-red-400", bg: "bg-red-400/5", border: "border-red-400/20", icon: AlertCircle },
  pending: { color: "text-slate2-400", bg: "bg-slate2-400/5", border: "border-slate2-400/20", icon: Clock },
};

export default function JobCard({ job }) {
  const cfg = STATUS[job.status] || STATUS.pending;
  const Icon = cfg.icon;

  return (
    <div className="admin-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-slate2-300">
          <Calendar size={12} className="text-slate2-400" />
          <span>{job.date || "-"}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          <Icon size={11} className={job.status === "running" ? "animate-spin" : ""} />
          {job.status || "pending"}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-slate2-400">
        {job.issue_number && (
          <p className="flex items-center gap-1.5">
            <FileText size={11} />
            Sayi: {job.issue_number}
          </p>
        )}
        {job.document_count != null && (
          <p className="flex items-center gap-1.5">
            <Layers size={11} />
            {job.document_count} belge
          </p>
        )}
        {job.pipeline && (
          <p className="flex items-center gap-1.5">
            <Activity size={11} />
            Pipeline: {job.pipeline}
          </p>
        )}
        {job.table_pages_masked_total != null && <p>Maskelenen tablo sayfasi: {job.table_pages_masked_total}</p>}
        {job.table_regions_masked_total != null && <p>Maskelenen tablo bolgesi: {job.table_regions_masked_total}</p>}
        {job.message && <p className="italic text-slate2-400/70 pt-1 truncate">{job.message}</p>}
      </div>

      {job.sample_titles?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gold-700/10 space-y-1">
          {job.sample_titles.slice(0, 5).map((t, i) => (
            <p key={`${job.id}-t-${i}`} className="text-slate2-400/60 text-xs truncate">
              - {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
