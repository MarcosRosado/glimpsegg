import React from 'react';
import { FileSearch, ArrowRight, Clock } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { formatDuration, timeAgoText } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import { GlintBadge } from '../ui/GlintBadge';

interface LastMatchCardProps {
  match: PlayerMatchSummary;
  onOpen: (matchId: string) => void;
  /** Abre a partida e já pede a análise do replay. Só no clique: cada pedido gasta cota. */
  onOpenAndRequestParse: (matchId: string) => void;
}

/**
 * O topo do Início (docs/PROPOSTA-V2.md §3.2, opção A dos wireframes): o app é de pós-jogo, e
 * "como foi minha última partida?" é o motivo mais comum de abri-lo.
 *
 * O estado do replay aparece aqui porque é o caso comum: sem análise, a partida abre só com
 * o placar. `isParsed` ausente = não se sabe, e então o card não afirma nada sobre o replay.
 */
export const LastMatchCard: React.FC<LastMatchCardProps> = ({ match, onOpen, onOpenAndRequestParse }) => {
  const { t } = useLanguage();
  const hero = getHero(match.heroId);
  const notParsed = match.isParsed === false;

  return (
    <section
      aria-labelledby="last-match-title"
      className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-lg flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-cyan-400" aria-hidden />
        <h2 id="last-match-title" className="text-sm font-bold uppercase tracking-wider text-slate-200">
          {t('lastMatchTitle')}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <img
          src={hero.avatarUrl}
          alt={hero.displayName}
          className={`w-24 aspect-[16/9] object-cover rounded-lg border ${
            match.isVictory ? 'border-emerald-500/50' : 'border-rose-500/50'
          }`}
          onError={handleHeroImageError}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-white truncate">{hero.displayName}</span>
            <span className={`text-xs font-bold ${match.isVictory ? 'text-emerald-400' : 'text-rose-400'}`}>
              {match.isVictory ? t('win') : t('loss')}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
            <span>{formatDuration(match.durationSeconds)}</span>
            <span className="text-slate-600">·</span>
            <span>{timeAgoText(match.startDateTime, t)}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-200">
              {match.kills} / {match.deaths} / {match.assists}
            </span>
            <GlintBadge glint={match.glint} size="sm" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpen(match.matchId)}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-200 transition shrink-0"
        >
          {t('openMatch')}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      {notParsed && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <FileSearch className="w-5 h-5 text-amber-300 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-200">{t('parsePendingTitle')}</div>
            <div className="text-xs text-amber-100/80 mt-0.5">{t('lastMatchUnlocks')}</div>
          </div>
          <button
            type="button"
            onClick={() => onOpenAndRequestParse(match.matchId)}
            title={t('parseQuotaNote')}
            className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-400/25"
          >
            {t('parseRequestButton')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpen(match.matchId)}
        className="sm:hidden inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200"
      >
        {t('openMatch')}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </button>
    </section>
  );
};
