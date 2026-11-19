import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { HeroPerformance, PlayerMatchFilters, PlayerMatchSummary } from '../../types/dota';
import { fetchPlayerMatchesPage } from '../../services/openDotaProfile';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { formatDuration, timeAgoText } from '../../utils/dotaFormatters';
import { formatGlint } from '../../utils/glint';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { GlintBadge, useGlintHint } from '../ui/GlintBadge';
import { Skeleton } from '../ui/Skeleton';

/** Partidas recentes mostradas no painel. "Ver todas" leva a Partidas com o mesmo filtro. */
const RECENT = 8;

/**
 * O lado direito da seção Heróis: o herói escolhido na lista. Os números do topo são os da
 * linha (o período e o patch da tela inteira); as médias de GPM e de Glint são **só das
 * partidas listadas abaixo**, e o rótulo diz quantas — a lista completa não traz esses campos
 * para o período todo, e chamar a média de 8 partidas de "média do herói" seria mentir a base.
 *
 * Uma chamada por herói escolhido (não por herói da lista), guardada enquanto a tela vive.
 */
export const HeroDetailPanel: React.FC<{
  steamAccountId: string;
  row: HeroPerformance;
  filters: PlayerMatchFilters;
  onOpenMatch: (matchId: string) => void;
  onOpenHeroMatches: () => void;
}> = ({ steamAccountId, row, filters, onOpenMatch, onOpenHeroMatches }) => {
  const { t, language } = useLanguage();
  const glintHint = useGlintHint();
  const hero = getHero(row.heroId);
  const key = `${steamAccountId}:${row.heroId}:${filters.days ?? ''}:${filters.patch?.id ?? ''}`;
  const cache = useRef(new Map<string, PlayerMatchSummary[] | null>());
  const [state, setState] = useState<{ key: string; matches: PlayerMatchSummary[] | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const hit = cache.current.get(key);
    if (hit) {
      setState({ key, matches: hit, failed: false });
      return;
    }
    let alive = true;
    setState(null);
    void fetchPlayerMatchesPage(steamAccountId, { ...filters, heroId: row.heroId, limit: RECENT }).then((page) => {
      if (!alive) return;
      if (page) cache.current.set(key, page.matches);
      setState({ key, matches: page?.matches ?? null, failed: !page });
    });
    return () => {
      alive = false;
    };
    // `filters` entra pela chave: o objeto muda de identidade a cada render do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const recent = state?.key === key ? state.matches : null;
  const rated = (recent ?? []).filter((m) => typeof m.glint === 'number' && Number.isFinite(m.glint));
  const avgGlint = rated.length ? Math.round(rated.reduce((s, m) => s + (m.glint as number), 0) / rated.length) : null;
  const avgGpm = recent?.length ? Math.round(recent.reduce((s, m) => s + m.goldPerMinute, 0) / recent.length) : null;
  const losses = row.matchCount - row.winCount;

  return (
    <section className="glass-card rounded-2xl border border-slate-800 bg-[#0f1624] overflow-hidden" aria-labelledby="hero-detail-title">
      <div className="relative">
        <img src={hero.avatarUrl} alt="" className="w-full h-32 object-cover opacity-60" onError={handleHeroImageError} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1624] via-[#0f1624]/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 id="hero-detail-title" className="text-xl font-black text-white">{hero.displayName}</h3>
          <div className="text-xs text-slate-300">
            {row.lastPlayed ? t('heroDetailLastPlayed', { when: timeAgoText(row.lastPlayed, t) }) : null}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('heroesColMatches')}</div>
            <div className="text-lg font-black text-slate-100 tabular-nums">{row.matchCount.toLocaleString(language)}</div>
            <div className="text-[10px] font-mono">
              <span className="text-emerald-400">{row.winCount}{t('wins')}</span> <span className="text-rose-400">{losses}{t('losses')}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-2.5" title={t('heroesWinRateHint', { wins: row.winCount, matches: row.matchCount })}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('heroesColWinRate')}</div>
            <div className={cn('text-lg font-black tabular-nums', row.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400')}>
              {row.winRate.toLocaleString(language, { maximumFractionDigits: 0 })}%
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-2.5" title={t('heroesKdaHint')}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('heroesColKda')}</div>
            <div className="text-lg font-black text-teal-300 tabular-nums">{row.kda.toLocaleString(language, { maximumFractionDigits: 1 })}</div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('heroDetailRecentTitle', { n: recent?.length ?? RECENT })}
            </h4>
            {recent && recent.length > 0 && (
              <span className="text-[10px] font-mono text-slate-500">
                {avgGpm !== null && <span className="text-yellow-300/80">{avgGpm.toLocaleString(language)} GPM</span>}
                {avgGlint !== null && (
                  <span className="ml-2 cursor-help" title={`${t('glintSampled', { count: rated.length })}. ${glintHint}`}>
                    {t('glint')} <span className="text-amber-300/90">{formatGlint(avgGlint)}</span>{' '}
                    <span className="text-[8px] uppercase">{t('glintBeta')}</span>
                  </span>
                )}
              </span>
            )}
          </div>

          {state?.failed ? (
            <div role="alert" className="flex items-center gap-2 text-xs text-rose-200 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{t('heroDetailLoadError')}</span>
              <button type="button" className="font-bold underline" onClick={() => setAttempt((n) => n + 1)}>
                {t('parseRetryButton')}
              </button>
            </div>
          ) : !recent ? (
            <div className="space-y-2" role="status" aria-busy>
              <span className="sr-only">{t('matchesLoading')}</span>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {recent.map((m) => (
                <li key={m.matchId}>
                  <button
                    type="button"
                    onClick={() => onOpenMatch(m.matchId)}
                    className="w-full flex items-center gap-3 py-1.5 px-1.5 -mx-1.5 rounded-lg text-left text-xs hover:bg-slate-800/40"
                  >
                    <span className={cn('w-1 h-6 rounded-full shrink-0', m.isVictory ? 'bg-emerald-500' : 'bg-rose-500')} aria-hidden />
                    <span className={cn('w-14 font-semibold shrink-0', m.isVictory ? 'text-emerald-400' : 'text-rose-400')}>
                      {m.isVictory ? t('win') : t('loss')}
                    </span>
                    <span className="font-mono text-slate-200 w-16 tabular-nums">{m.kills}/{m.deaths}/{m.assists}</span>
                    <span className="font-mono text-yellow-300/80 w-12 tabular-nums">{m.goldPerMinute}</span>
                    <span className="w-12">
                      <GlintBadge glint={m.glint} size="sm" />
                    </span>
                    <span className="ml-auto text-right text-[10px] text-slate-500">
                      {formatDuration(m.durationSeconds)} · {timeAgoText(m.startDateTime, t)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenHeroMatches}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-200 transition"
        >
          {t('heroesOpenMatches', { hero: hero.displayName })}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </section>
  );
};
