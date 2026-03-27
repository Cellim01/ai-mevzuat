import { BarChart3, CheckCircle, ChevronRight, Cpu, FileText, Server } from "lucide-react";
import Reveal from "../Reveal";
import JobCard from "../JobCard";

function StatusDot({ ok }) {
  const color = ok ? "bg-emerald-400" : ok === null ? "bg-slate2-400" : "bg-red-400";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${ok ? "status-pulse" : ""}`} />;
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="admin-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center">
          <Icon size={16} className="text-gold-400/70" />
        </div>
        <p className="text-slate2-400 text-xs tracking-wider uppercase font-mono">{label}</p>
      </div>
      <span className="admin-stat-value font-display text-4xl lg:text-5xl font-light leading-none">{value}</span>
    </div>
  );
}

export default function DashboardTab({
  health,
  jobs,
  issues,
  jobList,
  onGoJobs,
}) {
  return (
    <div className="space-y-8">
      <Reveal delay={0}>
        <p className="section-label mb-5">Servis Durumlari</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: "Backend API", ok: health.backend, icon: Server, desc: "REST API" },
            { label: "AI Service", ok: health.ai, icon: Cpu, desc: "OCR Pipeline" },
          ].map(({ label, ok, icon: Icon, desc }) => (
            <div key={label} className="admin-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-gold-400" />
                  </div>
                  <div>
                    <p className="text-slate2-200 font-medium text-sm">{label}</p>
                    <p className="text-slate2-400/60 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusDot ok={ok} />
                  <span className={`text-xs font-medium ${ok ? "text-emerald-400" : ok === null ? "text-slate2-400" : "text-red-400"}`}>
                    {ok === null ? "Kontrol..." : ok ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={1}>
        <p className="section-label mb-5">Genel Bakis</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Stat label="Toplam Is" value={Object.keys(jobs).length} icon={BarChart3} />
          <Stat label="Tamamlanan" value={Object.values(jobs).filter((j) => j.status === "completed").length} icon={CheckCircle} />
          <Stat label="Kayitli Sayi" value={issues.length} icon={FileText} />
        </div>
      </Reveal>

      {jobList.length > 0 && (
        <Reveal delay={2}>
          <div className="flex items-center justify-between mb-5">
            <p className="section-label">Son Isler</p>
            <button
              onClick={onGoJobs}
              className="text-gold-400/60 hover:text-gold-400 text-xs flex items-center gap-1 transition-colors"
            >
              Tumunu Gor <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobList.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
