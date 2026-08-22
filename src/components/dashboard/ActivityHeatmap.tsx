import React from 'react';
import { Calendar } from 'lucide-react';
import { ActivityDay } from '../../types/dota';
import { useLanguage } from '../../context/LanguageContext';

interface ActivityHeatmapProps {
  activityDays?: ActivityDay[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ activityDays = [] }) => {
  const { t } = useLanguage();

  const totalMatches30d = activityDays.reduce((sum, d) => sum + d.count, 0);
  const totalWins30d = activityDays.reduce((sum, d) => sum + d.wins, 0);
  const winrate30d = totalMatches30d > 0 ? Math.round((totalWins30d / totalMatches30d) * 100) : 0;
  const maxInDay = Math.max(1, ...activityDays.map((d) => d.count));

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl bg-[#111723]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('dailyActivityTitle')}
            </h3>
            <p className="text-[10px] text-slate-400">{t('activitySubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-300 font-bold">
            {totalMatches30d} {t('matches')} (30d)
          </span>
          <span>•</span>
          <span className={winrate30d >= 50 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {winrate30d}% {t('winRate')}
          </span>
        </div>
      </div>

      {/* 30-Day Activity Bar Chart */}
      <div className="grid grid-cols-15 sm:grid-cols-30 gap-1.5 items-end h-24 pt-2 border-b border-slate-800/80 pb-2">
        {activityDays.map((day, idx) => {
          const heightPercent = day.count > 0 ? Math.max(15, Math.round((day.count / maxInDay) * 100)) : 6;
          const winPercent = day.count > 0 ? Math.round((day.wins / day.count) * 100) : 0;

          return (
            <div
              key={day.date || idx}
              className="flex flex-col items-center justify-end h-full group relative cursor-pointer"
            >
              {/* Stacked Win / Loss Column */}
              <div
                className={`w-full rounded-t transition-all ${
                  day.count === 0
                    ? 'bg-slate-800/40 hover:bg-slate-700/50'
                    : winPercent >= 50
                    ? 'bg-emerald-500/80 hover:bg-emerald-400 shadow-sm shadow-emerald-950'
                    : 'bg-rose-500/80 hover:bg-rose-400 shadow-sm shadow-rose-950'
                }`}
                style={{ height: `${heightPercent}%` }}
              />

              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30 bg-[#0f172a] border border-slate-700 text-[10px] font-mono py-1 px-2 rounded-md shadow-2xl whitespace-nowrap text-slate-200">
                <div className="font-bold text-amber-400">{day.date}</div>
                {day.count > 0 ? (
                  <>
                    <div>{day.count} {t('matches')} ({day.wins}{t('wins')} - {day.losses}{t('losses')})</div>
                    <div className="text-emerald-400 font-bold">{winPercent}% {t('winRate')}</div>
                  </>
                ) : (
                  <div className="text-slate-400">{t('noActivity')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline Footnote */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2">
        <span>{t('thirtyDaysAgo')}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500" /> &gt;50% {t('winRate')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500" /> &lt;50% {t('winRate')}
          </span>
        </div>
        <span>{t('today')}</span>
      </div>
    </div>
  );
};
