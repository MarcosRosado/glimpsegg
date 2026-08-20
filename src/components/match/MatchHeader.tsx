import React, { useState } from 'react';
import { ArrowLeft, Clock, Copy, Check, Trophy } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { formatDuration, formatTimeAgo } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';

interface MatchHeaderProps {
  match: MatchDetails;
  onBack: () => void;
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({ match, onBack }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copyMatchId = () => {
    navigator.clipboard.writeText(match.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 shadow-2xl relative overflow-hidden bg-[#0e1420]">
      {/* Dynamic Background Glow based on winner */}
      <div
        className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none ${
          match.didRadiantWin ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        {/* Left: Back button & Match Meta */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition group"
            title={t('backToDashboard')}
          >
            <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition" />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm border ${
                  match.didRadiantWin
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 glow-radiant'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30 glow-dire'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                {match.didRadiantWin ? t('radiantVictory') : t('direVictory')}
              </span>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                <span>{t('matchId')} {match.id}</span>
                <button
                  onClick={copyMatchId}
                  className="hover:text-cyan-400 transition"
                  title={copied ? t('copied') : 'Copy Match ID'}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
              <span className="text-slate-300 font-semibold">{match.gameMode}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDuration(match.durationSeconds)}</span>
              </span>
              <span>•</span>
              <span>{formatTimeAgo(match.startDateTime)}</span>
            </div>
          </div>
        </div>

        {/* Center / Right: Big Scoreboard Banner */}
        <div className="flex items-center gap-6 bg-slate-950/60 px-6 py-3 rounded-xl border border-slate-800/80">
          {/* Radiant Score */}
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t('radiant')}</div>
            <div className="text-3xl font-black text-emerald-400 font-mono">{match.radiantScore}</div>
          </div>

          <div className="text-slate-600 font-black text-lg">VS</div>

          {/* Dire Score */}
          <div className="text-left">
            <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">{t('dire')}</div>
            <div className="text-3xl font-black text-rose-400 font-mono">{match.direScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
