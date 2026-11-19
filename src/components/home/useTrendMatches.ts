import { useCallback, useState } from 'react';
import type { PlayerMatchSummary } from '../../types/dota';
import { fetchPlayerMatchesPage } from '../../services/openDotaProfile';

/** A maior janela de tendência ("100 jogos"). */
export const TREND_WINDOW = 100;

export interface TrendMatches {
  matches: PlayerMatchSummary[];
  /** Ainda dá para trazer mais: a lista tem menos que a maior janela e a busca não terminou. */
  canLoadMore: boolean;
  /** A busca das 100 está em andamento: o botão da janela mostra que o clique pegou. */
  loading: boolean;
  /** A última busca falhou (limite de uso da OpenDota, rede). O clique seguinte tenta de novo. */
  failed: boolean;
  /** Busca as 100 mais recentes. Só no clique numa janela maior: cada página custa cota. */
  requestMore: () => void;
}

/**
 * As partidas das janelas de tendência (docs/PROPOSTA-V2.md §5: "janelas reais, sem o teto de
 * 40"). Começa com a lista do perfil; as 100 mais recentes só são buscadas quando o jogador
 * escolhe a janela maior — a página de 100 dispara tabelas de percentil por herói, e abrir o
 * Início de cada companheiro não pode gastar isso sem pedido.
 *
 * Partida nova na lista do perfil (o "atualizar") descarta o que foi trazido: a tendência
 * nunca fica atrás do cartão de última partida.
 *
 * Carga e falha são expostas: antes o clique em "100" não dava sinal nenhum enquanto buscava, e
 * a falha só fazia o botão sumir.
 */
export function useTrendMatches(steamAccountId: string, fallback: PlayerMatchSummary[]): TrendMatches {
  const [loaded, setLoaded] = useState<{ key: string; matches: PlayerMatchSummary[] } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = `${steamAccountId}:${fallback[0]?.matchId ?? ''}`;
  const hasLoaded = !!loaded && loaded.key === key;

  const requestMore = useCallback(() => {
    if (loadingKey === key || hasLoaded) return;
    setLoadingKey(key);
    setFailedKey(null);
    void fetchPlayerMatchesPage(steamAccountId, { limit: TREND_WINDOW }).then((page) => {
      // Troca de conta (ou "atualizar") no meio da busca: a resposta é de outra chave e só limpa
      // a carga se ainda for dela.
      setLoadingKey((current) => (current === key ? null : current));
      if (!page) {
        setFailedKey(key);
        return;
      }
      // Conta com menos de 100 partidas: o que veio é tudo, e a busca não se repete.
      setLoaded({ key, matches: page.matches.length >= fallback.length ? page.matches : fallback });
    });
  }, [key, loadingKey, hasLoaded, steamAccountId, fallback]);

  const matches = hasLoaded ? loaded!.matches : fallback;
  return {
    matches,
    canLoadMore: matches.length < TREND_WINDOW && !hasLoaded,
    loading: loadingKey === key,
    failed: failedKey === key,
    requestMore,
  };
}
