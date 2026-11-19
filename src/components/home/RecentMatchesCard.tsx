import React from 'react';
import { ListOrdered, ArrowRight } from 'lucide-react';
import type { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { handleHeroImageError, handleItemImageError } from '../../utils/imageFallback';
import { formatDuration, timeAgoText } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { GlintBadge } from '../ui/GlintBadge';

/** Quantas linhas o Início mostra. O resto, com filtros, está em Partidas. */
const ROWS = 15;

/**
 * As partidas mais recentes no Início, numa linha cada: a coluna principal da 1.0 era a lista
 * de partidas, e o dono quis a disposição de volta. Aqui só o que se lê de relance (herói,
 * resultado, KDA, GPM, Glint, itens, quando); tags, filtros e "carregar mais" ficam em Partidas.
 *
 * A primeira partida da lista já está no cartão de cima, então a lista começa da segunda.
 */
export const RecentMatchesCard: React.FC<{
  matches: PlayerMatchSummary[];
  onOpenMatch: (matchId: string) => void;
  onSeeAll: () => void;
}> = ({ matches, onOpenMatch, onSeeAll }) => {
  const { t, language } = useLanguage();
  const rows = matches.slice(1, ROWS + 1);
  if (rows.length === 0) return null;

  return (
    <section className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg bg-[#0b101a]" aria-labelledby="recent-matches-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="recent-matches-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
          <ListOrdered className="w-4 h-4 text-cyan-400" aria-hidden />
          {t('homeRecentMatchesTitle')}
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200"
        >
          {t('homeSeeAllMatches')}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <ul className="divide-y divide-slate-800/70">
        {rows.map((m) => {
          const hero = getHero(m.heroId);
          const items = (m.items ?? []).filter((id) => id > 0).slice(0, 6);
          return (
            <li key={m.matchId}>
              <button
                type="button"
                onClick={() => onOpenMatch(m.matchId)}
                className="w-full flex items-center gap-3 py-2 px-1.5 -mx-1.5 rounded-lg text-left hover:bg-slate-800/40 transition"
              >
                <span className={cn('w-1 self-stretch rounded-full shrink-0', m.isVictory ? 'bg-emerald-500' : 'bg-rose-500')} aria-hidden />
                <img src={hero.avatarUrl} alt="" className="w-14 aspect-[16/9] rounded object-cover shrink-0" onError={handleHeroImageError} />
                <span className="min-w-[7rem] flex-1">
                  <span className="block text-sm font-bold text-slate-100 truncate">{hero.displayName}</span>
                  <span className={cn('block text-[11px] font-semibold', m.isVictory ? 'text-emerald-400' : 'text-rose-400')}>
                    {m.isVictory ? t('win') : t('loss')}
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-200 w-16 shrink-0 tabular-nums">
                  {m.kills}/{m.deaths}/{m.assists}
                </span>
                <span className="font-mono text-xs text-yellow-300/90 w-16 shrink-0 tabular-nums hidden md:inline" title="GPM">
                  {m.goldPerMinute.toLocaleString(language)} <span className="text-[9px] text-slate-500">GPM</span>
                </span>
                <span className="w-12 shrink-0">
                  <GlintBadge glint={m.glint} size="sm" />
                </span>
                {/* Largura fixa de 6 slots: com largura variável, as colunas da esquerda dançavam linha a linha. */}
                <span className="hidden xl:flex items-center gap-0.5 shrink-0 w-[154px]">
                  {items.map((id, i) => {
                    const item = getItem(id);
                    return (
                      <img
                        key={`${id}-${i}`}
                        src={item.imageUrl}
                        alt={item.displayName}
                        title={item.displayName}
                        className="w-6 h-[18px] rounded-sm object-cover border border-slate-800"
                        onError={handleItemImageError}
                      />
                    );
                  })}
                </span>
                <span className="w-14 text-right text-[11px] text-slate-400 shrink-0">
                  <span className="block font-mono">{formatDuration(m.durationSeconds)}</span>
                  <span className="block text-slate-500">{timeAgoText(m.startDateTime, t)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
