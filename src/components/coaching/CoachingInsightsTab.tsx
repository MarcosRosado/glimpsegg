import React from 'react';
import { Sparkles, CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { MatchDetails, MatchPlayer } from '../../types/dota';
import { generateMatchInsights } from '../../utils/insightsEngine';
import { getHero } from '../../constants/heroes';
import { useLanguage } from '../../context/LanguageContext';

interface CoachingInsightsTabProps {
  player: MatchPlayer;
  match: MatchDetails;
}

export const CoachingInsightsTab: React.FC<CoachingInsightsTabProps> = ({ player, match }) => {
  const { t } = useLanguage();
  const hero = getHero(player.heroId);
  const insights = generateMatchInsights(player, match);

  return (
    <div className="space-y-6">
      {/* Coaching Header */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0c121e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-wide">
              {t('coachingTitle')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('coachingSubtitle')} • {hero.displayName} ({player.role.replace('POSITION_', 'Pos ')})
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Strengths (Green) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {t('strengthsTitle')}
            </h4>
          </div>

          <div className="space-y-3">
            {insights.strengths.map((s, idx) => (
              <div
                key={s.id || idx}
                className="glass-card rounded-xl p-4 border border-emerald-500/30 bg-[#0d161a] hover:border-emerald-500/50 transition relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />

                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-400 font-mono">#{idx + 1}</span>
                    <h5 className="font-bold text-sm text-slate-100">{s.title}</h5>
                  </div>

                  {s.statValue && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                      {s.statValue}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{s.description}</p>

                {s.benchmarkValue && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
                    <span>Benchmark: {s.benchmarkValue}</span>
                    <span className="text-emerald-400 font-bold">✓ Exceeded</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top Improvement Opportunities (Orange / Red) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {t('weaknessesTitle')}
            </h4>
          </div>

          <div className="space-y-3">
            {insights.improvements.length === 0 ? (
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
                {t('noMajorWeaknesses')}
              </div>
            ) : (
              insights.improvements.map((imp, idx) => (
                <div
                  key={imp.id || idx}
                  className="glass-card rounded-xl p-4 border border-amber-500/30 bg-[#161413] hover:border-amber-500/50 transition relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />

                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-400 font-mono">#{idx + 1}</span>
                      <h5 className="font-bold text-sm text-slate-100">{imp.title}</h5>
                    </div>

                    {imp.statValue && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        {imp.statValue}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{imp.description}</p>

                  {imp.benchmarkValue && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
                      <span>Target: {imp.benchmarkValue}</span>
                      <span className="text-amber-400 font-bold">Actionable Focus</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
