import React from 'react';
import { ScanEye, Flame, RotateCcw, ShieldCheck, Scale } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { useLanguage } from '../../context/LanguageContext';
import { hasLaneVerdict, isLaneWin } from '../../utils/laneResult';

interface MatchDynamicsOverviewProps {
  matches: PlayerMatchSummary[];
}

export const MatchDynamicsOverview: React.FC<MatchDynamicsOverviewProps> = ({ matches }) => {
  const { t } = useLanguage();
  const total = Math.max(1, matches.length);

  const stomps = matches.filter((m) => m.dynamicType === 'STOMP').length;
  const comebacks = matches.filter((m) => m.dynamicType === 'COMEBACK').length;
  const evenMatches = matches.filter((m) => m.dynamicType === 'EVEN_MATCH').length;

  // Taxa de vitoria nas ROTAS, das partidas que tem veredito real. A formula anterior
  // (`imp >= 5 && isVictory`) era uma taxa de vitoria de partidas com IMP alto usando o
  // rotulo de rota, e dividia pelo total incluindo partidas nao parseadas.
  const laneMeasured = matches.filter((m) => hasLaneVerdict(m.laneResult));
  const laneWins = laneMeasured.filter((m) => isLaneWin(m.laneResult!)).length;

  const stompPct = Math.round((stomps / total) * 100);
  const comebackPct = Math.round((comebacks / total) * 100);
  const laneWinPct = laneMeasured.length > 0 ? Math.round((laneWins / laneMeasured.length) * 100) : null;
  const evenPct = Math.round((evenMatches / total) * 100);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl bg-[#0b101a]">
      <div className="flex items-center gap-2 mb-4">
        <ScanEye className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          {t('matchDynamicsTitle')}
        </h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Stomp Rate */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-orange-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-1 text-orange-400">
            <span className="font-bold">{t('stompRate')}</span>
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black text-white font-mono">{stompPct}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stomps} {t('matches')}</div>
        </div>

        {/* Comeback Rate */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-purple-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-1 text-purple-400">
            <span className="font-bold">{t('comebackRate')}</span>
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black text-white font-mono">{comebackPct}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{comebacks} {t('matches')}</div>
        </div>

        {/* Lane Win Rate */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-1 text-emerald-400">
            <span className="font-bold">{t('laneWinRate')}</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {laneWinPct !== null ? `${laneWinPct}%` : t('noData')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {laneWinPct !== null
              ? t('laneSampleOf', { measured: laneMeasured.length, total: matches.length })
              : t('laneNoParsedMatches')}
          </div>
        </div>

        {/* Even / Close Matches */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-cyan-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-1 text-cyan-400">
            <span className="font-bold">{t('evenMatches')}</span>
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black text-white font-mono">{evenPct}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{evenMatches} {t('matches')}</div>
        </div>
      </div>
    </div>
  );
};
