import { ChevronRight, Clock, RefreshCw } from "lucide-react";
import Reveal from "../Reveal";
import JobCard from "../JobCard";

export default function JobsTab({ jobList, jobs, onRefresh, onGoScrape }) {
  return (
    <div>
      <Reveal delay={0}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-label mb-2">Joblar</p>
            <p className="text-slate2-400/50 text-sm">
              {jobList.length > 0
                ? `Toplam ${jobList.length} is - ${Object.values(jobs).filter((j) => j.status === "running").length} calisiyor`
                : "Henuz herhangi bir is yok."}
            </p>
          </div>
          <button onClick={onRefresh} className="flex items-center gap-2 text-slate2-400 hover:text-gold-400 text-xs px-3 py-2 rounded-lg">
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
            <p className="text-slate2-400/50 text-sm">Henuz job yok</p>
            <button onClick={onGoScrape} className="mt-5 text-gold-400/60 hover:text-gold-400 text-xs flex items-center gap-1 mx-auto">
              Scrape'e git <ChevronRight size={12} />
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
  );
}
