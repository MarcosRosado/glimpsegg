import React from 'react';
import { Activity, TrendingUp, Zap, Award } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface RecentFormCardProps {
  recentMatches: PlayerMatchSummary[];
  onSelectMatch: (matchId: string) => void;
}

export const RecentFormCard: React.FC<RecentFormCardProps> = ({ recentMatches, onSelectMatch }) => {
  const { t } = useLanguage();
  const matches10 = recentMatches.slice(0, 10);
  const wins = matches10.filter((m) => m.isVictory).length;
  const losses = matches10.length - wins;
  const winrate = matches10.length > 0 ? Math.round((wins / matches10.length) * 100) : 0;
  
  // Calculate average IMP in recent games
  const avgImp = matches10.length > 0
    ? Math.round(matches10.reduce((sum, m) => sum + (m.imp || 0), 0) / matches10.length)
    : 0;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg bg-[#0b101a]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">{t('recentForm')}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-400 font-bold">{wins}{t('wins')}</span>
          <span className="text-slate-600">-</span>
          <span className="text-rose-400 font-bold">{losses}{t('losses')}</span>
          <span className="text-slate-400 font-mono">({winrate}%)</span>
        </div>
      </div>

      {/* Form Sequence Dots / Hero Avatars */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4">
        {matches10.map((match, idx) => {
          const hero = getHero(match.heroId);
          return (
            <div
              key={match.matchId || idx}
              onClick={() => onSelectMatch(match.matchId)}
              className={`cursor-pointer group relative rounded-xl p-1 border transition-all duration-200 ${
                match.isVictory
                  ? 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400 hover:scale-105'
                  : 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400 hover:scale-105'
              }`}
              title={`${hero.displayName} - ${match.isVictory ? t('win') : t('loss')} (${match.kills}/${match.deaths}/${match.assists})`}
            >
              <img
                src={hero.avatarUrl}
                alt={hero.displayName}
                className="w-full aspect-[16/9] object-cover rounded-lg"
                onError={handleHeroImageError}
              />
              <div
                className={`text-[10px] font-black text-center mt-1 py-0.5 rounded ${
                  match.isVictory ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {match.isVictory ? t('wins') : t('losses')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary KPI Footer */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('avgImp')}</span>
          </div>
          <span className={`font-mono font-black ${avgImp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {avgImp >= 0 ? `+${avgImp}` : avgImp}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Trend</span>
          </div>
          <span className="font-semibold text-emerald-400">
            {winrate >= 60 ? '🔥 On Fire' : winrate >= 50 ? '⚡ Stable' : '❄️ Struggling'}
          </span>
        </div>
      </div>
    </div>
  );
};
