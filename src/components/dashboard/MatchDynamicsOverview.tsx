import React from 'react';
import { ScanEye, Flame, RotateCcw, ShieldCheck, Scale } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { useLanguage } from '../../context/LanguageContext';

interface MatchDynamicsOverviewProps {
  matches: PlayerMatchSummary[];
}

export const MatchDynamicsOverview: React.FC<MatchDynamicsOverviewProps> = ({ matches }) => {
  const { t } = useLanguage();
  const total = Math.max(1, matches.length);

  const stomps = matches.filter((m) => m.dynamicType === 'STOMP' || m.dynamicType === 'STOMP_LANE').length;
  const comebacks = matches.filter((m) => m.dynamicType === 'COMEBACK').length;
  const laneWins = matches.filter((m) => m.dynamicType === 'WIN_LANE' || m.dynamicType === 'STOMP_LANE' || (m.imp >= 5 && m.isVictory)).length;
  const evenMatches = matches.filter((m) => m.dynamicType === 'EVEN_MATCH' || m.dynamicType === 'DRAW_LANE').length;

  const stompPct = Math.round((stomps / total) * 100);
  const comebackPct = Math.round((comebacks / total) * 100);
  const laneWinPct = Math.round((laneWins / total) * 100);
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
          <div className="text-xl font-black text-white font-mono">{laneWinPct}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{laneWins} {t('matches')}</div>
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
