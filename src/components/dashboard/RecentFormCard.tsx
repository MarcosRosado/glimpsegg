import React from 'react';
import { Activity, TrendingUp, Zap, Coins, Swords } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { computeRecentFormStats } from '../../utils/recentFormStats';
import { formatGlint, getGlintColor, GLINT_THRESHOLDS } from '../../utils/glint';
import { useGlintHint } from '../ui/GlintBadge';

interface RecentFormCardProps {
  recentMatches: PlayerMatchSummary[];
  onSelectMatch: (matchId: string) => void;
}

const Tile: React.FC<{ icon: React.ReactNode; label: React.ReactNode; title?: string; children: React.ReactNode }> = ({
  icon,
  label,
  title,
  children,
}) => (
  <div className={`p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 ${title ? 'cursor-help' : ''}`} title={title}>
    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <div className="flex items-baseline">{children}</div>
  </div>
);

/** Partidas da linha de Glint. Mesma janela padrão do gráfico de evolução da Conta. */
const SPARK_WINDOW = 25;
const SPARK_H = 56;

/**
 * Glint das últimas partidas COM nota, da mais velha (esquerda) à mais nova, com a linha do
 * neutro (`GLINT_THRESHOLDS.neutral`). Substitui, no Início, o painel de largura inteira, que
 * ocupava meia tela para uma linha só — o gráfico completo, com winrate e farm, foi para a Conta.
 * Partida sem nota fica fora da linha (nunca vira 0); sem nenhuma, a linha some.
 */
const GlintSparkline: React.FC<{ matches: PlayerMatchSummary[]; onSelectMatch: (matchId: string) => void }> = ({
  matches,
  onSelectMatch,
}) => {
  const { t } = useLanguage();
  const glintHint = useGlintHint();
  const rated = matches
    .slice(0, SPARK_WINDOW)
    .filter((m): m is PlayerMatchSummary & { glint: number } => typeof m.glint === 'number' && Number.isFinite(m.glint))
    .reverse();
  if (rated.length < 2) return null;

  const W = 300;
  const x = (i: number) => (i / (rated.length - 1)) * (W - 8) + 4;
  const y = (g: number) => SPARK_H - 4 - (Math.max(0, Math.min(100, g)) / 100) * (SPARK_H - 8);
  const line = rated.map((m, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(m.glint).toFixed(1)}`).join(' ');
  const neutralY = y(GLINT_THRESHOLDS.neutral);

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 cursor-help" title={glintHint}>
        <span>
          {t('formGlintSparkTitle', { n: rated.length })}{' '}
          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{t('glintBeta')}</span>
        </span>
        <span className="text-[10px] text-slate-500">{t('formGlintSparkAxis')}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${SPARK_H}`} preserveAspectRatio="none" className="w-full" style={{ height: SPARK_H }} role="img" aria-label={t('formGlintSparkTitle', { n: rated.length })}>
        <line x1={0} x2={W} y1={neutralY} y2={neutralY} stroke="#334155" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {rated.map((m, i) => (
          <g key={m.matchId} className="cursor-pointer" onClick={() => onSelectMatch(m.matchId)}>
            <title>{`${getHero(m.heroId).displayName} · ${m.isVictory ? t('win') : t('loss')} · ${t('glint')} ${formatGlint(m.glint)}`}</title>
            {/* Alvo maior que a marca: o ponto é pequeno, o clique não precisa ser. */}
            <rect x={x(i) - W / rated.length / 2} y={0} width={W / rated.length} height={SPARK_H} fill="transparent" />
            <circle cx={x(i)} cy={y(m.glint)} r={2.5} fill={m.isVictory ? '#10b981' : '#f43f5e'} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
    </div>
  );
};

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
          tirou da moldura; o tooltip de cada um diz de quantos jogos é a média. Rótulo em cima
          e valor embaixo: na coluna lateral, lado a lado, o KDA atropelava o vizinho. */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
        {/* Glint médio das partidas com nota. Sem nenhuma, o bloco some — "0" aqui seria
            uma nota que ninguém tirou. */}
        {avgGlint !== null && (
          <Tile
            icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
            label={<>{t('avgGlint')} <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{t('glintBeta')}</span></>}
            title={`${t('glintSampled', { count: glintCount })}. ${glintHint}`}
          >
            <span className={`font-mono font-black text-base ${getGlintColor(avgGlint)}`}>{formatGlint(avgGlint)}</span>
          </Tile>
        )}
        <Tile icon={<Swords className="w-3.5 h-3.5 text-teal-300" />} label={t('kda')} title={t('railKdaTooltip', { count: stats.count })}>
          <span className="font-mono font-black text-base text-teal-300">{stats.kdaRatio.toFixed(2)}</span>
          <span className="ml-1.5 text-[10px] font-mono text-slate-500">
            {stats.avgKills.toFixed(1)}/{stats.avgDeaths.toFixed(1)}/{stats.avgAssists.toFixed(1)}
          </span>
        </Tile>
        <Tile icon={<Coins className="w-3.5 h-3.5 text-yellow-400" />} label={t('railFarm')} title={t('railFarmTooltip', { count: stats.count })}>
          <span className="font-mono font-black text-base text-yellow-300">{stats.avgGpm}</span>
          <span className="ml-1 text-[10px] font-mono text-slate-500">GPM</span>
        </Tile>
        <Tile icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />} label={t('trendLabel')}>
          <span className="font-semibold text-emerald-400">
            {winrate >= 60 ? t('trendOnFire') : winrate >= 50 ? t('trendStable') : t('trendStruggling')}
          </span>
        </Tile>
      </div>

      <GlintSparkline matches={recentMatches} onSelectMatch={onSelectMatch} />
    </div>
  );
};
