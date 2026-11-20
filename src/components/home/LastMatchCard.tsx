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
 * O topo da coluna principal do Início: o app é de pós-jogo, e "como foi minha última
 * partida?" é o motivo mais comum de abri-lo. Numa faixa só, com a lista das recentes logo
 * abaixo (a disposição da 1.0, que o dono pediu de volta em 2026-11-19).
 *
 * O estado do replay aparece aqui porque é o caso comum: sem análise, a partida abre só com
 * o placar. `isParsed` ausente = não se sabe, e então o card não afirma nada sobre o replay.
 */
export const LastMatchCard: React.FC<LastMatchCardProps> = ({ match, onOpen, onOpenAndRequestParse }) => {
  const { t, language } = useLanguage();
  const hero = getHero(match.heroId);
  const notParsed = match.isParsed === false;

  return (
    <section
      aria-labelledby="last-match-title"
      className={`glass-card rounded-2xl border bg-[#0b101a] shadow-lg overflow-hidden ${
        match.isVictory ? 'border-emerald-500/30' : 'border-rose-500/30'
      }`}
    >
      {/* Faixa única: na 2.0 o card ocupava meia tela e sobrava vazio embaixo. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <img
          src={hero.avatarUrl}
          alt={hero.displayName}
          className="w-28 aspect-[16/9] object-cover rounded-lg shrink-0"
          onError={handleHeroImageError}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="last-match-title" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Clock className="w-3 h-3" aria-hidden />
            {t('lastMatchTitle')} · {timeAgoText(match.startDateTime, t)}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-black text-white truncate">{hero.displayName}</span>
            <span className={`text-xs font-bold ${match.isVictory ? 'text-emerald-400' : 'text-rose-400'}`}>
              {match.isVictory ? t('win') : t('loss')}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
            <span className="text-slate-100 font-bold">
              {match.kills} / {match.deaths} / {match.assists}
            </span>
            <span className="text-slate-600">·</span>
            <span>{match.goldPerMinute.toLocaleString(language)} GPM</span>
            <span className="text-slate-600">·</span>
            <span>{formatDuration(match.durationSeconds)}</span>
            <GlintBadge glint={match.glint} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {notParsed && (
            <button
              type="button"
              onClick={() => onOpenAndRequestParse(match.matchId)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20"
            >
              <FileSearch className="w-4 h-4 text-amber-300" aria-hidden />
              {t('parseRequestButton')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(match.matchId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-200 transition"
          >
            {t('openMatch')}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {notParsed && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-100/80">
          <span className="font-bold text-amber-200">{t('parsePendingTitle')}.</span> {t('lastMatchUnlocks')}
        </div>
      )}
    </section>
  );
};
