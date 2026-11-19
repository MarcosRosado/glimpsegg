import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search, Swords } from 'lucide-react';
import type { HeroPerformance, PatchWindow, PlayerMatchFilters } from '../../types/dota';
import { fetchHeroPerformance } from '../../services/openDotaProfile';
import { getHero, NEW_HERO_IDS } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { timeAgoText } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { Skeleton, SkeletonCard, SkeletonRows } from '../ui/Skeleton';
import { HeroDetailPanel } from './HeroDetailPanel';
import { PeriodPatchFilter, toMatchFilters, usePatchWindows, type PeriodDays } from '../filters/PeriodPatchFilter';

/**
 * Abaixo disto o winrate do herói sai marcado como "amostra pequena". É o valor que o
 * wireframe da seção propôs (docs/PROPOSTA-V2.md §3.5) e o dono deixou à recomendação: com
 * menos de 5 partidas, um resultado mexe o winrate em 20 pontos ou mais.
 */
const HERO_SMALL_SAMPLE = 5;

type SortKey = 'matchCount' | 'winRate' | 'kda' | 'lastPlayed';

const SORTS: { key: SortKey; label: 'heroesColMatches' | 'heroesColWinRate' | 'heroesColKda' | 'heroesColLastPlayed' }[] = [
  { key: 'matchCount', label: 'heroesColMatches' },
  { key: 'winRate', label: 'heroesColWinRate' },
  { key: 'kda', label: 'heroesColKda' },
  { key: 'lastPlayed', label: 'heroesColLastPlayed' },
];

/**
 * Seção Heróis (docs/PROPOSTA-V2.md §3.5): desempenho por herói no período e patch escolhidos.
 *
 * Só os números que a lista completa de partidas sustenta: partidas, winrate, KDA agregado e
 * a última vez. **Sem Glint médio**: a lista completa não traz os insumos do Glint, e média de
 * uma parte das partidas sob o rótulo do herói inteiro seria número sem procedência. Também
 * sem posição: a lista não traz posição.
 *
 * Lista à esquerda e o herói escolhido à direita (`HeroDetailPanel`: as últimas partidas com ele
 * e o atalho para Partidas filtrada). Na primeira versão a seção era só a tabela, e com o
 * período padrão de 3 meses quem joga pouco via uma linha e nada mais (dono, 2026-11-19).
 */
export const HeroesSection: React.FC<{
  steamAccountId: string;
  /** Abre Partidas filtrada pelo herói, levando o período e o patch desta tela. */
  onOpenHeroMatches: (heroId: number, filters: PlayerMatchFilters) => void;
  onOpenMatch: (matchId: string) => void;
}> = ({ steamAccountId, onOpenHeroMatches, onOpenMatch }) => {
  const { t, language } = useLanguage();
  const windows = usePatchWindows();
  // "Tudo" por padrão: em 3 meses, quem joga pouco abria a seção com uma linha só.
  const [days, setDays] = useState<PeriodDays>(null);
  const [selectedHero, setSelectedHero] = useState<number | null>(null);
  const [patch, setPatch] = useState<PatchWindow | null>(null);
  const [rows, setRows] = useState<HeroPerformance[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('matchCount');
  const runRef = useRef(0);

  const load = async () => {
    const run = ++runRef.current;
    setLoading(true);
    setFailed(false);
    const res = await fetchHeroPerformance(steamAccountId, toMatchFilters(days, patch));
    if (runRef.current !== run) return;
    setLoading(false);
    if (!res) {
      setFailed(true);
      return;
    }
    setRows(res);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamAccountId, days, patch]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !q || getHero(r.heroId).displayName.toLowerCase().includes(q));
    return [...list].sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [rows, query, sort]);

  const totalMatches = (rows ?? []).reduce((s, r) => s + r.matchCount, 0);
  // Herói escolhido; se ele saiu da lista (outro período, busca), o primeiro da ordem atual.
  const selectedRow = visible.find((r) => r.heroId === selectedHero) ?? visible[0] ?? null;

  return (
    <section className="space-y-4" aria-labelledby="heroes-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="heroes-title" className="text-lg font-black text-slate-100 flex items-center gap-2">
            <Swords className="w-5 h-5 text-cyan-400" aria-hidden />
            {t('navHeroes')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t('heroesSubtitle')}</p>
        </div>
        <label className="relative">
          <span className="sr-only">{t('heroesSearch')}</span>
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('heroesSearch')}
            className="w-56 rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </label>
      </div>

      <PeriodPatchFilter days={days} onDaysChange={setDays} patch={patch} onPatchChange={setPatch} windows={windows} />

      {failed && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          <span className="flex-1">{t('heroesLoadError')}</span>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-rose-400/40 px-3 py-1.5 font-bold hover:bg-rose-500/20">
            {t('parseRetryButton')}
          </button>
        </div>
      )}

      {loading && !rows ? (
        <SkeletonCard className="p-4">
          <Skeleton className="h-3 w-40 mb-5" />
          <SkeletonRows rows={8} />
        </SkeletonCard>
      ) : rows && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={cn('lg:col-span-7 glass-card rounded-2xl border border-slate-800 bg-[#0f1624] p-4 min-w-0', loading && 'opacity-60')}>
          <div className="text-xs text-slate-400 mb-3 cursor-help" title={t('heroesSourceHint')}>
            {t('heroesSummary', { matches: totalMatches.toLocaleString(language), heroes: rows.length })}
          </div>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">{t('heroesEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                    <th className="py-2 pr-3 font-semibold">{t('heroesColHero')}</th>
                    {SORTS.map((c) => (
                      <th key={c.key} className="py-2 pr-3 font-semibold text-right" aria-sort={sort === c.key ? 'descending' : 'none'}>
                        <button
                          type="button"
                          onClick={() => setSort(c.key)}
                          className={cn('uppercase tracking-wider hover:text-slate-200', sort === c.key && 'text-cyan-300')}
                        >
                          {t(c.label)}
                          {sort === c.key && ' ▾'}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const hero = getHero(r.heroId);
                    const small = r.matchCount < HERO_SMALL_SAMPLE;
                    return (
                      <tr
                        key={r.heroId}
                        className={cn('border-t border-slate-800/80', selectedRow?.heroId === r.heroId && 'bg-cyan-500/10')}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => setSelectedHero(r.heroId)}
                            aria-pressed={selectedRow?.heroId === r.heroId}
                            className="flex items-center gap-2.5 text-left hover:text-cyan-200"
                          >
                            <img
                              src={hero.avatarUrl}
                              alt=""
                              className="w-10 h-6 rounded object-cover border border-slate-700"
                              onError={handleHeroImageError}
                            />
                            <span className="font-bold text-slate-200">{hero.displayName}</span>
                            {/* Herói do patch novo (`NEW_HERO_IDS`, trocado a cada herói lançado). */}
                            {NEW_HERO_IDS.has(r.heroId) && (
                              <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                                {t('heroNewBadge')}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-200">{r.matchCount}</td>
                        <td className="py-2 pr-3 text-right font-mono">
                          <span
                            className={cn(small ? 'text-slate-400' : r.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400')}
                            title={t('heroesWinRateHint', { wins: r.winCount, matches: r.matchCount })}
                          >
                            {r.winRate.toLocaleString(language, { maximumFractionDigits: 0 })}%
                          </span>
                          {small && (
                            <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-300/80" title={t('heroesSmallSampleHint', { n: HERO_SMALL_SAMPLE })}>
                              {t('heroesSmallSample')}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-teal-300" title={t('heroesKdaHint')}>
                          {r.kda.toLocaleString(language, { maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2 text-right text-slate-400">
                          {r.lastPlayed ? timeAgoText(r.lastPlayed, t) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {selectedRow && (
          <div className="lg:col-span-5 lg:sticky lg:top-16 min-w-0">
            <HeroDetailPanel
              steamAccountId={steamAccountId}
              row={selectedRow}
              filters={toMatchFilters(days, patch)}
              onOpenMatch={onOpenMatch}
              onOpenHeroMatches={() => onOpenHeroMatches(selectedRow.heroId, toMatchFilters(days, patch))}
            />
          </div>
        )}
        </div>
      )}
    </section>
  );
};
