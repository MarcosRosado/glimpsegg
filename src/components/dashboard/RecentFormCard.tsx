import React from 'react';
import { Activity, TrendingUp, Zap, Coins, Swords } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { computeRecentFormStats } from '../../utils/recentFormStats';
import { formatGlint, getGlintColor } from '../../utils/glint';
import { useGlintHint } from '../ui/GlintBadge';

interface RecentFormCardProps {
  recentMatches: PlayerMatchSummary[];
  onSelectMatch: (matchId: string) => void;
}

export const RecentFormCard: React.FC<RecentFormCardProps> = ({ recentMatches, onSelectMatch }) => {
  const { t } = useLanguage();
  const matches10 = recentMatches.slice(0, 10);
  // Mesmos agregados que a stat rail do topbar consome.
  const glintHint = useGlintHint();
  const stats = computeRecentFormStats(recentMatches);
  const { wins, losses, winRate: winrate, avgGlint, glintCount } = stats;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg bg-[#0b101a]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">{t('recentForm')}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs cursor-help" title={t('railFormTooltip', { count: stats.count })}>
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

      {/* Rodapé de KPIs. KDA e GPM vieram da antiga faixa do topo (`StatRail`), que a 2.0
          tirou da moldura; o tooltip de cada um diz de quantos jogos é a média. */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
        {/* Glint médio das partidas com nota. Sem nenhuma, o bloco some — "0" aqui seria
            uma nota que ninguém tirou. */}
        {avgGlint !== null && (
          <div
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-help"
            title={`${t('glintSampled', { count: glintCount })}. ${glintHint}`}
          >
            <div className="flex items-center gap-2 text-slate-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('avgGlint')}</span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{t('glintBeta')}</span>
            </div>
            <span className={`font-mono font-black ${getGlintColor(avgGlint)}`}>{formatGlint(avgGlint)}</span>
          </div>
        )}

        <div
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-help"
          title={t('railKdaTooltip', { count: stats.count })}
        >
          <div className="flex items-center gap-2 text-slate-400">
            <Swords className="w-3.5 h-3.5 text-teal-300" />
            <span>{t('kda')}</span>
          </div>
          <span className="font-mono font-black text-teal-300">
            {stats.kdaRatio.toFixed(2)}{' '}
            <span className="text-[10px] font-normal text-slate-500">
              ({stats.avgKills.toFixed(1)}/{stats.avgDeaths.toFixed(1)}/{stats.avgAssists.toFixed(1)})
            </span>
          </span>
        </div>

        <div
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-help"
          title={t('railFarmTooltip', { count: stats.count })}
        >
          <div className="flex items-center gap-2 text-slate-400">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span>{t('railFarm')}</span>
          </div>
          <span className="font-mono font-black text-yellow-300">{stats.avgGpm} GPM</span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('trendLabel')}</span>
          </div>
          <span className="font-semibold text-emerald-400">
            {winrate >= 60 ? t('trendOnFire') : winrate >= 50 ? t('trendStable') : t('trendStruggling')}
          </span>
        </div>
      </div>
    </div>
  );
};
