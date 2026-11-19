import {
  MapTeam,
  MatchDeathEvent,
  PlayerVisionStats,
  VisionData,
  VisionSource,
  WardPlacement,
} from '../types/dota';
import { WARD_DURATION_SEC } from '../constants/mapGeometry';

/**
 * Helpers puros sobre `VisionData` — quem MONTA a visao é o `buildVision` de
 * `openDotaMatch.ts` (obs_log/sen_log pareados por `ehandle`), e este arquivo so agrega.
 *
 * Ate 2026-11-19 morava aqui tambem o `buildVisionData`, parser do formato da STRATZ
 * (`playbackData.wardEvents` com fallback para `players[].stats.wards`). Ele existia
 * separado do mapper exatamente para ser testavel — o bug que substituiu (quatro wards
 * hardcoded por jogador) sobreviveu porque nada verificava aquele caminho. Saiu quando a
 * STRATZ saiu do app (sobra da etapa 2 da D4, docs/PLANO-OPENDOTA.md); os testes destes
 * helpers passaram a rodar sobre a visao que o mapper real monta das fixtures reais.
 *
 * A regra que ele carregava continua valendo para quem monta visao: sem dado, `source:
 * 'NONE'` e listas vazias. Nunca inventar ward.
 */

export function emptyVisionData(isReplayParsed = false, deaths: MatchDeathEvent[] = []): VisionData {
  return {
    source: 'NONE',
    isReplayParsed,
    wards: [],
    dewards: [],
    deaths,
    unattributedWards: 0,
    droppedEvents: 0,
  };
}

/** Fatia as wards da partida por slot, para pendurar em cada MatchPlayer. */
export function wardsBySlot(vision: VisionData): Map<number, WardPlacement[]> {
  const map = new Map<number, WardPlacement[]>();
  for (const w of vision.wards) {
    if (w.placedBySlot === null) continue;
    const list = map.get(w.placedBySlot);
    if (list) list.push(w);
    else map.set(w.placedBySlot, [w]);
  }
  return map;
}

export function computePlayerVisionStats(
  vision: VisionData,
  playerSlot: number,
): PlayerVisionStats {
  const hasData = vision.source !== 'NONE';
  const own = vision.wards.filter((w) => w.placedBySlot === playerSlot);
  const observers = own.filter((w) => w.type === 'OBSERVER');
  const dewards = vision.dewards.filter((d) => d.bySlot === playerSlot).length;

  const avgObserverLifetimeSec = observers.length
    ? Math.round(observers.reduce((sum, w) => sum + w.lifetimeSeconds, 0) / observers.length)
    : 0;

  const wardsLostEarly = own.filter(
    (w) => w.wasDestroyed && w.lifetimeSeconds < WARD_DURATION_SEC[w.type] * 0.5,
  ).length;

  return {
    hasData,
    observersPlaced: observers.length,
    sentriesPlaced: own.length - observers.length,
    wardsPlaced: own.length,
    dewards,
    avgObserverLifetimeSec,
    wardsLostEarly,
    lifetimeIsEstimated: own.some((w) => w.expiryInferred),
  };
}

/**
 * Fracao da partida com pelo menos uma observer viva do time.
 * É o numero que separa "coloquei 20 wards" de "tive visao".
 */
export function observerUptimePct(
  vision: VisionData,
  team: MapTeam,
  durationSeconds: number,
): number | null {
  if (vision.source === 'NONE' || durationSeconds <= 0) return null;
  const obs = vision.wards.filter((w) => w.team === team && w.type === 'OBSERVER');
  if (obs.length === 0) return 0;

  // Uniao de intervalos, clampada a [0, duracao].
  const intervals = obs
    .map((w) => [Math.max(0, w.spawnTime), Math.min(durationSeconds, w.expireTime)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);

  let covered = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [a, b] of intervals) {
    if (curEnd < a) {
      if (curEnd > curStart) covered += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd > curStart) covered += curEnd - curStart;

  return Math.round((covered / durationSeconds) * 100);
}

export const VISION_SOURCE_IS_ESTIMATED: Record<VisionSource, boolean> = {
  PLAYBACK: false,
  PLAYER_STATS: true,
  NONE: false,
};
