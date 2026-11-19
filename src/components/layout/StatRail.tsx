import React from 'react';
import { Flame, Zap, Coins, LucideIcon } from 'lucide-react';
import { PlayerProfileSummary } from '../../types/dota';
import { computeRecentFormStats } from '../../utils/recentFormStats';
import { formatPercent } from '../../utils/dotaFormatters';
import { formatGlint, getGlintColor } from '../../utils/glint';
import { useGamePatch } from '../../hooks/useGamePatch';
import { useLanguage } from '../../context/LanguageContext';
import { PatchTransitionNotice } from '../ui/PatchTransitionNotice';
import { useGlintHint } from '../ui/GlintBadge';

interface StatRailProps {
  profile: PlayerProfileSummary;
}

interface RailStatProps {
  /** Só três das métricas têm ícone: cinco matizes em fila é o que polui. */
  icon?: LucideIcon;
  iconClassName?: string;
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

const RailStat: React.FC<RailStatProps> = ({
  icon: Icon,
  iconClassName,
  label,
  tooltip,
  children,
}) => (
  <div
    className="flex items-center gap-1.5 shrink-0 border-l border-slate-800 pl-3 first:border-l-0 first:pl-0"
    title={tooltip}
  >
    {Icon ? <Icon className={`w-3 h-3 ${iconClassName || ''}`} /> : null}
    <span className="text-slate-500">{label}</span>
    {children}
  </div>
);

/**
 * Segunda faixa do topbar: contexto de dados, hierarquicamente abaixo do chrome.
 *
 * Ao contrário do bloco central que substitui, aparece em toda largura — antes
 * estava atrás de `hidden xl:flex` e simplesmente não existia abaixo de 1280px.
 * Em telas estreitas rola horizontalmente, e é por isso que cada item precisa de
 * `shrink-0`: sem ele o `overflow-x: hidden` do body corta em vez de rolar.
 */
export const StatRail: React.FC<StatRailProps> = ({ profile }) => {
  const { t } = useLanguage();
  const { patch } = useGamePatch();
  const glintHint = useGlintHint();
  const stats = computeRecentFormStats(profile.recentMatches);

  if (stats.count === 0) return null;

  const sampleTooltip = (key: 'railFormTooltip' | 'railKdaTooltip' | 'railFarmTooltip') =>
    t(key, { count: stats.count });

  return (
    <div className="border-t border-slate-800/60 bg-[#0a0f1a]/60">
      <div className="w-full max-w-[1850px] mx-auto px-4 sm:px-6 h-7 flex items-center gap-3 overflow-x-auto no-scrollbar text-[11px] font-mono text-slate-400">
        <RailStat label={t('gamePatch')} tooltip={`${t('gamePatchTooltip')} (${patch})`}>
          <span className="text-slate-300 font-semibold tabular-nums">{patch}</span>
          <PatchTransitionNotice variant="chip" />
        </RailStat>

        <RailStat
          icon={Flame}
          iconClassName="text-orange-400/80"
          label={t('railForm')}
          tooltip={sampleTooltip('railFormTooltip')}
        >
          <span className="text-emerald-400 font-semibold tabular-nums">
            {stats.wins}
            {t('wins')}
          </span>
          <span className="text-slate-700">/</span>
          <span className="text-rose-400 font-semibold tabular-nums">
            {stats.losses}
            {t('losses')}
          </span>
          <span className="text-slate-500 tabular-nums">({stats.winRate}%)</span>
        </RailStat>

        {/* Glint médio só das partidas COM nota. Sem nenhuma, o item some da faixa —
            zero aqui seria lido como nota. O tooltip diz de quantas partidas é a média
            e carrega a procedência da nota experimental. */}
        {stats.avgGlint !== null && (
          <RailStat
            icon={Zap}
            iconClassName="text-amber-400/80"
            label={t('glint')}
            tooltip={`${t('railGlintTooltip', { count: stats.glintCount, total: stats.count })} ${glintHint}`}
          >
            <span className={`font-semibold tabular-nums ${getGlintColor(stats.avgGlint)}`}>
              {formatGlint(stats.avgGlint)}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{t('glintBeta')}</span>
          </RailStat>
        )}

        <RailStat label={t('kda')} tooltip={sampleTooltip('railKdaTooltip')}>
          <span className="text-teal-300 font-semibold tabular-nums">
            {stats.kdaRatio.toFixed(2)}
          </span>
          <span className="text-slate-600 tabular-nums">
            ({stats.avgKills.toFixed(1)}/{stats.avgDeaths.toFixed(1)}/{stats.avgAssists.toFixed(1)})
          </span>
        </RailStat>

        <RailStat
          icon={Coins}
          iconClassName="text-yellow-400/80"
          label={t('railFarm')}
          tooltip={sampleTooltip('railFarmTooltip')}
        >
          <span className="text-yellow-300 font-semibold tabular-nums">{stats.avgGpm} GPM</span>
        </RailStat>

        <RailStat
          label={t('railCareer')}
          tooltip={t('railCareerTooltip', { total: profile.totalMatches.toLocaleString() })}
        >
          <span className="text-emerald-400 font-semibold tabular-nums">
            {formatPercent(profile.winRate)}
          </span>
        </RailStat>
      </div>
    </div>
  );
};
