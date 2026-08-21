import { useEffect, useState } from 'react';
import { MatchDetails, MatchPlayer } from '../types/dota';
import { computeBuildAdvice, BuildAdvice } from '../utils/buildAdvisor';
import { buildThreatProfile, ThreatProfile } from '../utils/insights/threatProfile';
import { effectivePosition, resolveBracket } from '../utils/rankBracket';
import { fetchHeroBuildContext, RateLimitedError } from '../services/stratzHeroStats';

export type BuildAdviceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface UseBuildAdviceResult {
  status: BuildAdviceStatus;
  advice: BuildAdvice | null;
  threat: ThreatProfile | null;
  bracketIsPlayerSpecific: boolean;
}

/**
 * Carrega os agregados de heroi e calcula a orientacao de build.
 *
 * Chamado SO pelo CoachingInsightsTab — nunca no `handleSelectMatch` do App —, entao as
 * abas de visao geral, desempenho e visao nao pagam nada por isto. Os insights de
 * partida renderizam na hora; os cards de build entram depois, com skeleton.
 */
export function useBuildAdvice(
  player: MatchPlayer | null,
  match: MatchDetails | null,
  apiKey?: string,
): UseBuildAdviceResult {
  const [status, setStatus] = useState<BuildAdviceStatus>('idle');
  const [advice, setAdvice] = useState<BuildAdvice | null>(null);
  const [threat, setThreat] = useState<ThreatProfile | null>(null);

  const heroId = player?.heroId ?? 0;
  const matchId = match?.id ?? '';
  const isMock = !!match?.isMockData;

  const bracketInfo = player && match ? resolveBracket(match, player) : null;

  useEffect(() => {
    let cancelled = false;

    if (!player || !match || !heroId) {
      setStatus('idle');
      setAdvice(null);
      setThreat(null);
      return;
    }

    // O perfil de ameaca sai so da propria partida: nao depende de rede e pode ser
    // calculado de imediato, inclusive no modo demo.
    const localThreat = buildThreatProfile(player, match, null);
    setThreat(localThreat);

    // Modo demo / sem chave: nao existe agregado do patch. Melhor dizer isso do que
    // fabricar uma build.
    if (isMock) {
      setStatus('unavailable');
      setAdvice(null);
      return;
    }

    setStatus('loading');
    const position = effectivePosition(player);
    const { bracket, isPlayerSpecific } = resolveBracket(match, player);

    fetchHeroBuildContext(heroId, position, bracket, apiKey)
      .then((ctx) => {
        if (cancelled) return;
        if (!ctx) {
          setStatus('unavailable');
          setAdvice(null);
          return;
        }
        const threatWithMatchups = buildThreatProfile(player, match, ctx.matchups);
        setThreat(threatWithMatchups);
        const computed = computeBuildAdvice({
          purchases: player.itemTimings,
          fullPurchase: ctx.itemFullPurchase,
          threat: threatWithMatchups,
          durationMin: match.durationSeconds / 60,
          bracketIsPlayerSpecific: isPlayerSpecific,
        });
        setAdvice(computed);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof RateLimitedError) {
          // Degrada em silencio: os insights de partida seguem valendo.
          setStatus('unavailable');
        } else {
          console.warn('[coaching] falha ao carregar contexto de build:', err);
          setStatus('error');
        }
        setAdvice(null);
      });

    return () => {
      cancelled = true;
    };
    // Dependencias por VALOR PRIMITIVO de proposito (heroId, matchId, slot), nao pelas
    // referencias de `player`/`match`. Essas referencias sao recriadas em cada render
    // do App, e usa-las aqui dispararia um request a cada render — o oposto do
    // orcamento de "1 request a frio, 0 morno" que o cache existe para garantir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroId, matchId, player?.playerSlot, apiKey, isMock]);

  return {
    status,
    advice,
    threat,
    bracketIsPlayerSpecific: bracketInfo ? bracketInfo.isPlayerSpecific : false,
  };
}
