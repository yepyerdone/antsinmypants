import { Clock, Trophy } from 'lucide-react';

interface StatsProps {
  score: number;
  total: number;
  time: number;
}

export default function Stats({ score, total, time }: StatsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex justify-center gap-8 mb-8">
      <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[160px]">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Trophy className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-slate-400">States</div>
          <div className="text-2xl font-bold text-slate-700">{score} / {total}</div>
        </div>
      </div>

      <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[160px]">
        <div className="p-3 bg-amber-50 rounded-xl">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-slate-400">Time</div>
          <div className="text-2xl font-bold text-slate-700 tracking-tight">{formatTime(time)}</div>
        </div>
      </div>
    </div>
  );
}
