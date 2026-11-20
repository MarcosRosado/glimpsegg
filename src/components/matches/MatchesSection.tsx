import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PatchWindow, PlayerMatchSummary } from '../../types/dota';
import { fetchPlayerMatchesPage, RECENT_MATCHES_LIMIT } from '../../services/openDotaProfile';
import { useLanguage } from '../../context/LanguageContext';
import { MatchList } from '../dashboard/MatchList';
import { Skeleton, SkeletonCard, SkeletonRows } from '../ui/Skeleton';
import { LoadErrorCard, LoadErrorNotice } from '../ui/LoadError';
import { PeriodPatchFilter, toMatchFilters, usePatchWindows, type PeriodDays } from '../filters/PeriodPatchFilter';

/**
 * Seção Partidas (docs/PROPOSTA-V2.md §3.3): a lista paginada além das 40, com período, patch
 * e herói filtrados no servidor. O resto dos filtros (resultado, fila, modo, busca por nome)
 * continua no `MatchList`, sobre o que já foi carregado.
 *
 * Sem filtro, a primeira página é a do perfil (já baixada): não se paga a mesma chamada duas
 * vezes — a menos que ela tenha falhado no perfil (`initialMatchesFailed`): aí a seção busca a
 * página sozinha, em vez de mostrar a lista vazia como "nenhuma partida". Falha de rede (`null`)
 * mostra o erro com "tentar de novo" — nunca vira "fim da lista"; sem nada na tela, o erro fica
 * no lugar do cartão da lista.
 */
export const MatchesSection: React.FC<{
  steamAccountId: string;
  initialMatches: PlayerMatchSummary[];
  /** A lista do perfil falhou: `initialMatches` vazio não quer dizer conta sem partidas. */
  initialMatchesFailed?: boolean;
  onSelectMatch: (matchId: string) => void;
  heroFilterId: number | null;
  onClearHeroFilter: () => void;
  /** Período e patch de partida — o clique num herói da seção Heróis traz os filtros de lá. */
  initialDays?: PeriodDays;
  initialPatch?: PatchWindow | null;
}> = ({
  steamAccountId,
  initialMatches,
  initialMatchesFailed = false,
  onSelectMatch,
  heroFilterId,
  onClearHeroFilter,
  initialDays = null,
  initialPatch = null,
}) => {
  const { t } = useLanguage();
  const windows = usePatchWindows();
  const [days, setDays] = useState<PeriodDays>(initialDays);
  const [patch, setPatch] = useState<PatchWindow | null>(initialPatch);
  const [matches, setMatches] = useState<PlayerMatchSummary[]>(initialMatches);
  const [hasMore, setHasMore] = useState(initialMatches.length >= RECENT_MATCHES_LIMIT);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Resposta de um filtro antigo que chega depois da troca não pode sobrescrever a lista nova.
  const runRef = useRef(0);

  // Herói também vai ao servidor (`hero_id`): filtrar só as 40 carregadas deixava a lista vazia
  // para herói jogado há mais tempo, e o "carregar mais" não paginava dentro dele.
  const unfiltered = !days && !patch && heroFilterId === null && !initialMatchesFailed;
  // Páginas já trazidas do servidor. O offset é o da lista CRUA: com patch, o corte local pode
  // encurtar uma página, então contar itens exibidos daria o offset errado.
  const pagesLoaded = useRef(1);
  const lastRequest = useRef<{ page: number; replace: boolean }>({ page: 0, replace: true });

  const loadPage = async (page: number, replace: boolean) => {
    lastRequest.current = { page, replace };
    const offset = page * RECENT_MATCHES_LIMIT;
    const run = ++runRef.current;
    setLoading(true);
    setFailed(false);
    const result = await fetchPlayerMatchesPage(steamAccountId, {
      ...toMatchFilters(days, patch),
      ...(heroFilterId !== null ? { heroId: heroFilterId } : {}),
      offset,
    });
    if (runRef.current !== run) return;
    setLoading(false);
    if (!result) {
      setFailed(true);
      return;
    }
    setMatches((prev) => (replace ? result.matches : [...prev, ...result.matches]));
    setHasMore(result.hasMore);
    pagesLoaded.current = page + 1;
  };

  useEffect(() => {
    pagesLoaded.current = 1;
    if (unfiltered) {
      runRef.current += 1;
      setMatches(initialMatches);
      setHasMore(initialMatches.length >= RECENT_MATCHES_LIMIT);
      setFailed(false);
      setLoading(false);
      return;
    }
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamAccountId, days, patch, heroFilterId, initialMatches, initialMatchesFailed]);

  const loadMore = () => void loadPage(pagesLoaded.current, false);
  const retry = () => void loadPage(lastRequest.current.page, lastRequest.current.replace);

  return (
    <div className="space-y-4">
      <PeriodPatchFilter days={days} onDaysChange={setDays} patch={patch} onPatchChange={setPatch} windows={windows} />

      {/* Com lista na tela (o "carregar mais" ou a troca de filtro que falhou), o aviso vai em
          cima dela; sem nada, o erro ocupa o lugar do cartão. */}
      {failed && matches.length > 0 && <LoadErrorNotice message={t('matchesLoadError')} onRetry={retry} />}

      {loading && matches.length === 0 ? (
        <SkeletonCard>
          <Skeleton className="h-5 w-56 mb-5" />
          <SkeletonRows rows={8} />
        </SkeletonCard>
      ) : failed && matches.length === 0 ? (
        <LoadErrorCard title={t('navMatches')} message={t('matchesLoadError')} onRetry={retry} />
      ) : (
        <MatchList
          matches={matches}
          selectedMatchId={null}
          heroFilterId={heroFilterId}
          onClearHeroFilter={onClearHeroFilter}
          onSelectMatch={onSelectMatch}
        />
      )}

      {hasMore && !failed && matches.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:border-cyan-500/50 hover:text-cyan-200 px-4 py-2 text-xs font-bold text-slate-300 transition disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
            {t('matchesLoadMore')}
          </button>
        </div>
      )}
    </div>
  );
};
