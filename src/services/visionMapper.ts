import {
  MapTeam,
  MatchDeathEvent,
  MatchPlayer,
  PlayerVisionStats,
  VisionData,
  VisionSource,
  WardDeward,
  WardPlacement,
  WardType,
} from '../types/dota';
import { STRATZ_WARD_TYPE_INT, WARD_DURATION_SEC } from '../constants/mapGeometry';
import { isStratzCell } from '../utils/minimapCoords';

/**
 * Constroi os dados de visao da partida a partir da resposta crua da STRATZ.
 *
 * Funcao pura: sem React, sem fetch, sem estado. Existe separada de stratzGql.ts
 * exatamente para ser testavel — o bug que ela substitui (quatro wards hardcoded
 * por jogador) sobreviveu porque nao havia nada verificando este caminho.
 *
 * PRECEDENCIA DE FONTES
 *  A) match.playbackData.wardEvents  -> tempo de vida, autor e deward REAIS.
 *  B) players[].stats.wards         -> so colocacoes; tempo de vida ESTIMADO.
 *  C) nada                          -> source 'NONE'. Nunca inventar ward.
 */

interface RawWardEvent {
  indexId?: number;
  time?: number;
  positionX?: number;
  positionY?: number;
  fromPlayer?: number | null;
  wardType?: string;
  action?: string;
  playerDestroyed?: number | null;
}

interface OpenWard {
  indexId: number;
  type: WardType;
  x: number;
  y: number;
  spawnTime: number;
  fromPlayer: number | null;
  playerDestroyed: number | null;
}

function teamOfSlot(bySlot: Map<number, MatchPlayer>, slot: number | null | undefined): MapTeam {
  if (slot === null || slot === undefined) return 'UNKNOWN';
  const p = bySlot.get(slot);
  if (!p) return 'UNKNOWN';
  return p.isRadiant ? 'RADIANT' : 'DIRE';
}

function indexPlayers(players: MatchPlayer[]): Map<number, MatchPlayer> {
  const map = new Map<number, MatchPlayer>();
  for (const p of players) {
    if (typeof p.playerSlot === 'number') map.set(p.playerSlot, p);
  }
  return map;
}

function normalizeWardType(raw: unknown): WardType | null {
  if (raw === 'OBSERVER' || raw === 'SENTRY') return raw;
  return null;
}

/** Caminho A: pareia SPAWN/DESPAWN por indexId para obter tempo de vida real. */
function fromPlaybackData(
  rawEvents: RawWardEvent[],
  bySlot: Map<number, MatchPlayer>,
  durationSeconds: number,
): { wards: WardPlacement[]; dewards: WardDeward[]; dropped: number; unattributed: number } {
  const wards: WardPlacement[] = [];
  const dewards: WardDeward[] = [];
  let dropped = 0;
  let unattributed = 0;

  // Nao confie na ordem do payload.
  const events = rawEvents
    .filter((e) => typeof e.time === 'number' && typeof e.indexId === 'number')
    .slice()
    .sort((a, b) => (a.time! - b.time!) || (a.indexId! - b.indexId!));

  const open = new Map<number, OpenWard>();

  const close = (
    w: OpenWard,
    expireTime: number,
    destroyedBySlot: number | null,
    expiryInferred: boolean,
  ) => {
    const wasDestroyed = destroyedBySlot !== null && destroyedBySlot !== undefined;
    const team = teamOfSlot(bySlot, w.fromPlayer);
    if (team === 'UNKNOWN') unattributed += 1;

    const owner = w.fromPlayer !== null ? bySlot.get(w.fromPlayer) : undefined;
    const killer = destroyedBySlot !== null ? bySlot.get(destroyedBySlot) : undefined;
    const clampedExpire = Math.max(w.spawnTime, expireTime);
    // Slot que nao resolve para um jogador desta partida nao é atribuivel: o campo
    // tem de dizer isso, senao agrupamento por slot cria um grupo fantasma.
    const placedBySlot = owner ? w.fromPlayer : null;

    wards.push({
      key: `${w.indexId}-${w.spawnTime}`,
      indexId: w.indexId,
      type: w.type,
      x: w.x,
      y: w.y,
      team,
      placedBySlot,
      placedByHeroId: owner?.heroId,
      spawnTime: w.spawnTime,
      expireTime: clampedExpire,
      lifetimeSeconds: clampedExpire - w.spawnTime,
      expiryInferred,
      wasDestroyed,
      destroyedBySlot: destroyedBySlot,
      destroyedByHeroId: killer?.heroId,
      source: 'PLAYBACK',
    });

    if (wasDestroyed) {
      dewards.push({
        time: clampedExpire,
        bySlot: destroyedBySlot,
        byHeroId: killer?.heroId,
        team: teamOfSlot(bySlot, destroyedBySlot),
        // O deward herda a coordenada da ward morta — é exatamente o que se quer plotar.
        x: w.x,
        y: w.y,
        targetType: w.type,
      });
    }
  };

  for (const e of events) {
    const indexId = e.indexId!;
    const time = e.time!;
    const action = e.action;

    if (action === 'SPAWN') {
      const type = normalizeWardType(e.wardType);
      const x = e.positionX;
      const y = e.positionY;
      if (!type || typeof x !== 'number' || typeof y !== 'number' || !isStratzCell(x, y)) {
        dropped += 1;
        continue;
      }

      // indexId reciclado pela engine: fecha a anterior no instante deste spawn.
      const existing = open.get(indexId);
      if (existing) close(existing, time, null, true);

      open.set(indexId, {
        indexId,
        type,
        x,
        y,
        spawnTime: time,
        fromPlayer: typeof e.fromPlayer === 'number' ? e.fromPlayer : null,
        playerDestroyed: typeof e.playerDestroyed === 'number' ? e.playerDestroyed : null,
      });
      continue;
    }

    if (action === 'DESPAWN') {
      const w = open.get(indexId);
      if (!w) {
        // DESPAWN sem SPAWN aberto: a ward nasceu antes do inicio da gravacao ou o
        // indexId foi reusado. Descartar — NUNCA inventar um spawn para casar.
        dropped += 1;
        continue;
      }
      open.delete(indexId);
      const destroyedBy =
        typeof e.playerDestroyed === 'number' ? e.playerDestroyed : w.playerDestroyed;
      close(w, time, destroyedBy === undefined ? null : destroyedBy, false);
      continue;
    }

    dropped += 1;
  }

  // Sobras: wards vivas no fim do jogo.
  for (const w of open.values()) {
    const naturalExpiry = w.spawnTime + WARD_DURATION_SEC[w.type];
    close(w, Math.min(naturalExpiry, durationSeconds), null, true);
  }

  return { wards, dewards, dropped, unattributed };
}

/** Caminho B: so colocacoes por jogador. Tempo de vida estimado, deward sem coordenada. */
function fromPlayerStats(
  rawPlayers: any[],
  players: MatchPlayer[],
  durationSeconds: number,
): { wards: WardPlacement[]; dewards: WardDeward[] } {
  const wards: WardPlacement[] = [];
  const dewards: WardDeward[] = [];

  rawPlayers.forEach((raw, idx) => {
    const player = players[idx];
    if (!player) return;
    const team: MapTeam = player.isRadiant ? 'RADIANT' : 'DIRE';

    const rawWards = raw?.stats?.wards;
    if (Array.isArray(rawWards)) {
      rawWards.forEach((w: any, i: number) => {
        const x = w?.positionX;
        const y = w?.positionY;
        if (typeof x !== 'number' || typeof y !== 'number' || !isStratzCell(x, y)) return;
        const type = STRATZ_WARD_TYPE_INT[w?.type] ?? 'OBSERVER';
        const spawnTime = typeof w?.time === 'number' ? w.time : 0;
        const expireTime = Math.min(spawnTime + WARD_DURATION_SEC[type], durationSeconds);
        wards.push({
          key: `${player.playerSlot}-${i}-${spawnTime}`,
          type,
          x,
          y,
          team,
          placedBySlot: player.playerSlot,
          placedByHeroId: player.heroId,
          spawnTime,
          expireTime: Math.max(spawnTime, expireTime),
          lifetimeSeconds: Math.max(0, expireTime - spawnTime),
          // Esta fonte nao sabe quando a ward morreu. É estimativa, e tem de aparecer assim.
          expiryInferred: true,
          wasDestroyed: false,
          // undefined (desconhecido) é diferente de null (expirou naturalmente).
          destroyedBySlot: undefined,
          source: 'PLAYER_STATS',
        });
      });
    }

    const rawDestruction = raw?.stats?.wardDestruction;
    if (Array.isArray(rawDestruction)) {
      for (const d of rawDestruction) {
        if (d?.isWard === false) continue;
        dewards.push({
          time: typeof d?.time === 'number' ? d.time : 0,
          bySlot: player.playerSlot,
          byHeroId: player.heroId,
          team,
          // Sem coordenada nesta fonte: alimenta KPI e lista, nunca pino no mapa.
          gold: typeof d?.gold === 'number' ? d.gold : undefined,
          experience: typeof d?.experience === 'number' ? d.experience : undefined,
        });
      }
    }
  });

  return { wards, dewards };
}

function extractDeaths(rawPlayers: any[], players: MatchPlayer[]): MatchDeathEvent[] {
  const deaths: MatchDeathEvent[] = [];
  rawPlayers.forEach((raw, idx) => {
    const player = players[idx];
    if (!player) return;
    const events = raw?.stats?.deathEvents;
    if (!Array.isArray(events)) return;
    for (const e of events) {
      const x = e?.positionX;
      const y = e?.positionY;
      if (typeof x !== 'number' || typeof y !== 'number' || !isStratzCell(x, y)) continue;
      deaths.push({
        time: typeof e?.time === 'number' ? e.time : 0,
        x,
        y,
        team: player.isRadiant ? 'RADIANT' : 'DIRE',
        slot: player.playerSlot,
        heroId: player.heroId,
        attackerSlot: typeof e?.attacker === 'number' ? e.attacker : null,
        byAbilityId: typeof e?.byAbility === 'number' ? e.byAbility : null,
        byItemId: typeof e?.byItem === 'number' ? e.byItem : null,
        timeDead: e?.timeDead ?? undefined,
        goldLost: e?.goldLost ?? undefined,
        goldFed: e?.goldFed ?? undefined,
        xpFed: e?.xpFed ?? undefined,
        isBurst: e?.isBurst ?? undefined,
        isEngagedOnDeath: e?.isEngagedOnDeath ?? undefined,
        isWardWalkThrough: e?.isWardWalkThrough ?? undefined,
        isAttemptTpOut: e?.isAttemptTpOut ?? undefined,
        isDieBack: e?.isDieBack ?? undefined,
        hasHealAvailable: e?.hasHealAvailable ?? undefined,
      });
    }
  });
  return deaths;
}

export function buildVisionData(
  rawMatch: any,
  players: MatchPlayer[],
  durationSeconds: number,
): VisionData {
  const bySlot = indexPlayers(players);
  const rawPlayers: any[] = Array.isArray(rawMatch?.players) ? rawMatch.players : [];
  const isReplayParsed = !!rawMatch?.parsedDateTime;
  const deaths = extractDeaths(rawPlayers, players);

  let droppedEvents = 0;

  const rawWardEvents = rawMatch?.playbackData?.wardEvents;
  if (Array.isArray(rawWardEvents) && rawWardEvents.length > 0) {
    const playback = fromPlaybackData(rawWardEvents, bySlot, durationSeconds);
    // Preserve o diagnostico mesmo se o caminho nao render ward alguma — é essa
    // contagem que revela pareamento quebrado em vez de "nao tinha dado".
    droppedEvents = playback.dropped;
    if (playback.wards.length > 0) {
      return {
        source: 'PLAYBACK',
        isReplayParsed,
        wards: playback.wards,
        dewards: playback.dewards,
        deaths,
        unattributedWards: playback.unattributed,
        droppedEvents,
      };
    }
  }

  const { wards, dewards } = fromPlayerStats(rawPlayers, players, durationSeconds);
  if (wards.length > 0 || dewards.length > 0) {
    return {
      source: 'PLAYER_STATS',
      isReplayParsed,
      wards,
      dewards,
      deaths,
      unattributedWards: 0,
      droppedEvents,
    };
  }

  return { ...emptyVisionData(isReplayParsed, deaths), droppedEvents };
}

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
