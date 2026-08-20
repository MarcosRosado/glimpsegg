import React from 'react';
import { Crown, Zap } from 'lucide-react';
import { getHero } from '../../constants/heroes';
import { formatPercent, getImpColor } from '../../utils/dotaFormatters';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface MostPlayedHeroesProps {
  heroes: Array<{
    heroId: number;
    matchCount: number;
    winCount: number;
    winRate: number;
    avgKda: number;
    avgImp: number;
  }>;
  onFilterHero?: (heroId: number) => void;
}

export const MostPlayedHeroes: React.FC<MostPlayedHeroesProps> = ({ heroes, onFilterHero }) => {
  const { t } = useLanguage();

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg bg-[#0b101a]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">{t('signatureHeroes')}</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">{t('performanceMatrix')}</span>
      </div>

      <div className="space-y-2.5">
        {heroes.map((h, idx) => {
          const hero = getHero(h.heroId);
          return (
            <div
              key={h.heroId}
              onClick={() => onFilterHero && onFilterHero(h.heroId)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 transition cursor-pointer group"
            >
              {/* Hero Portrait & Name */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-500 w-3">{idx + 1}</span>
                <img
                  src={hero.avatarUrl}
                  alt={hero.displayName}
                  className="w-12 h-7 object-cover rounded-md border border-slate-700 shadow-sm"
                  onError={handleHeroImageError}
                />
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition flex items-center gap-1.5">
                    <span>{hero.displayName}</span>
                    {h.heroId === 145 && (
                      <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                        NEW
                      </span>
                    )}
                    {h.heroId === 131 && (
                      <span className="text-[9px] px-1 py-0.2 bg-purple-500/20 text-purple-300 rounded font-semibold border border-purple-500/30">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {h.matchCount} {t('matches')} ({h.winCount}{t('wins')} - {h.matchCount - h.winCount}{t('losses')})
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs font-mono">
                {/* Winrate */}
                <div className="text-right">
                  <div className={`font-bold ${h.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(h.winRate)}
                  </div>
                  <div className="text-[9px] text-slate-500">{t('winRate')}</div>
                </div>

                {/* KDA */}
                <div className="text-right hidden sm:block">
                  <div className="font-bold text-slate-300">{h.avgKda.toFixed(1)}</div>
                  <div className="text-[9px] text-slate-500">{t('kda')}</div>
                </div>

                {/* Avg IMP */}
                <div className="text-right min-w-[48px]">
                  <div className={`font-black flex items-center justify-end gap-0.5 ${getImpColor(h.avgImp)}`}>
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>{h.avgImp >= 0 ? `+${h.avgImp}` : h.avgImp}</span>
                  </div>
                  <div className="text-[9px] text-slate-500">{t('imp')}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
