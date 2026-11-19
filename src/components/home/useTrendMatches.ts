import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerMatchSummary } from '../../types/dota';
import { fetchPlayerMatchesPage } from '../../services/openDotaProfile';

/** A maior janela de tendência do Início ("100 jogos"). */
const TREND_WINDOW = 100;

export interface TrendMatches {
  matches: PlayerMatchSummary[];
  /** Ainda dá para trazer mais (a lista tem menos que a maior janela e a busca não falhou). */
  canLoadMore: boolean;
  /** Busca as 100 mais recentes. Só no clique numa janela maior: cada página custa cota. */
  requestMore: () => void;
}

/**
 * As partidas da tendência do Início (docs/PROPOSTA-V2.md §5: "janelas reais, sem o teto de
 * 40"). Começa com a lista do perfil; as 100 mais recentes só são buscadas quando o jogador
 * escolhe a janela de 50 ou 100 — a página de 100 dispara tabelas de percentil por herói, e
 * abrir o Início de cada companheiro não pode gastar isso sem pedido.
 *
 * Partida nova na lista do perfil (o "atualizar") descarta o que foi trazido: a tendência
 * nunca fica atrás do cartão de última partida.
 */
export function useTrendMatches(steamAccountId: string, fallback: PlayerMatchSummary[]): TrendMatches {
  const [loaded, setLoaded] = useState<{ key: string; matches: PlayerMatchSummary[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = `${steamAccountId}:${fallback[0]?.matchId ?? ''}`;
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    inFlight.current = null;
  }, [key]);

  const requestMore = useCallback(() => {
    if (inFlight.current === key || (loaded && loaded.key === key)) return;
    inFlight.current = key;
    void fetchPlayerMatchesPage(steamAccountId, { limit: TREND_WINDOW }).then((page) => {
      if (inFlight.current !== key) return;
      inFlight.current = null;
      if (page && page.matches.length > fallback.length) setLoaded({ key, matches: page.matches });
      else if (!page) setFailedKey(key);
    });
  }, [key, loaded, steamAccountId, fallback.length]);

  const matches = loaded && loaded.key === key ? loaded.matches : fallback;
  return {
    matches,
    canLoadMore: matches.length < TREND_WINDOW && failedKey !== key && !(loaded && loaded.key === key),
    requestMore,
  };
}
