import { useEffect, useState } from 'react';
import type { PlayerMatchSummary } from '../../types/dota';
import { fetchPlayerMatchesPage } from '../../services/openDotaProfile';

/** A maior janela de tendência do Início ("100 jogos"). */
const TREND_WINDOW = 100;

/**
 * As partidas da tendência do Início: as 100 mais recentes, para as janelas de 50 e 100 serem
 * reais (docs/PROPOSTA-V2.md §5: "janelas reais, sem o teto de 40").
 *
 * Enquanto a página de 100 não chega, ou se ela falhar, devolve a lista do perfil (40) — e os
 * gráficos só oferecem as janelas que ela preenche. Uma chamada por conta aberta no Início.
 */
export function useTrendMatches(steamAccountId: string, fallback: PlayerMatchSummary[]): PlayerMatchSummary[] {
  const [loaded, setLoaded] = useState<{ id: string; matches: PlayerMatchSummary[] } | null>(null);

  useEffect(() => {
    let alive = true;
    if (fallback.length >= TREND_WINDOW) return;
    void fetchPlayerMatchesPage(steamAccountId, { limit: TREND_WINDOW }).then((page) => {
      if (alive && page && page.matches.length > fallback.length) {
        setLoaded({ id: steamAccountId, matches: page.matches });
      }
    });
    return () => {
      alive = false;
    };
    // A conta e a partida mais recente: "atualizar" sem partida nova não refaz a chamada de
    // 100 (a lista do perfil muda de identidade a cada atualização); partida nova refaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamAccountId, fallback[0]?.matchId]);

  return loaded && loaded.id === steamAccountId ? loaded.matches : fallback;
}
