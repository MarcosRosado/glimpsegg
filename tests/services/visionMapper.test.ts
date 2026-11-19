import { describe, it, expect } from 'vitest';
import {
  computePlayerVisionStats,
  emptyVisionData,
  observerUptimePct,
  wardsBySlot,
} from '../../src/services/visionMapper';
import { MapTeam, MatchDetails, VisionData, WardPlacement } from '../../src/types/dota';
import { OBSERVER_DURATION_SEC } from '../../src/constants/mapGeometry';
import { referenceMatch, referenceRaw, unevenLaneMatch, unevenLaneRaw } from '../support/fixtureMatches';

/**
 * Os helpers de visao rodam sobre a visao que o `mapOpenDotaMatch` REAL monta das duas
 * fixtures reais. O parsing (pareamento por `ehandle`, autor do deward, fim estimado) é
 * testado em `openDotaMatch.test.ts`; aqui o que se confere é a agregacao.
 *
 * Os esperados saem de um ORACULO INDEPENDENTE — os `obs_log`/`obs_left_log` crus da
 * resposta e uma contagem segundo a segundo —, nunca do proprio helper.
 *
 * O que o mapper da OpenDota nunca produz (ward sem dono, time sem observer) entra por
 * `syntheticVision`, literal minimo de `VisionData` com o nome dizendo o que é.
 */

const FIXTURES: Array<[string, () => MatchDetails, () => any]> = [
  ['referencia', referenceMatch, referenceRaw],
  ['rota desigual', unevenLaneMatch, unevenLaneRaw],
];

/**
 * Intervalos de observer do time direto da resposta crua: saida pelo `obs_left_log` de
 * mesmo `ehandle`; sem saida, a duracao natural cortada no fim da partida.
 */
function rawObserverIntervals(raw: any, team: MapTeam): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of raw.players) {
    if ((p.player_slot < 128 ? 'RADIANT' : 'DIRE') !== team) continue;
    const left = new Map<number, number>((p.obs_left_log ?? []).map((l: any) => [l.ehandle, l.time]));
    for (const w of p.obs_log ?? []) {
      const end = left.get(w.ehandle) ?? Math.min(w.time + OBSERVER_DURATION_SEC, raw.duration);
      out.push([w.time, end]);
    }
  }
  return out;
}

/** Segundos de [0, duracao) cobertos por ao menos um intervalo — forca bruta. */
function bruteForceCoveredSeconds(intervals: Array<[number, number]>, duration: number): number {
  let covered = 0;
  for (let s = 0; s < duration; s++) {
    if (intervals.some(([a, b]) => a <= s && s < b)) covered += 1;
  }
  return covered;
}

describe.each(FIXTURES)('helpers de visao sobre a partida real (%s)', (_name, build, buildRaw) => {
  const match = build();
  const raw = buildRaw();
  const vision = match.vision;
  const duration = match.durationSeconds;

  it('uptime de observer é a UNIAO dos intervalos, conferida segundo a segundo contra o cru', () => {
    for (const team of ['RADIANT', 'DIRE'] as const) {
      const intervals = rawObserverIntervals(raw, team);
      const expected = Math.round((bruteForceCoveredSeconds(intervals, duration) / duration) * 100);
      expect(observerUptimePct(vision, team, duration), team).toBe(expected);
    }
  });

  it('o teste de uniao discrimina: a soma ingenua dos intervalos passaria de 100%', () => {
    for (const team of ['RADIANT', 'DIRE'] as const) {
      const naive = rawObserverIntervals(raw, team).reduce(
        (s, [a, b]) => s + Math.max(0, Math.min(duration, b) - Math.max(0, a)),
        0,
      );
      expect(naive / duration, team).toBeGreaterThan(1);
      expect(observerUptimePct(vision, team, duration)!, team).toBeLessThanOrEqual(100);
    }
  });

  it('observers e sentries por jogador batem com obs_log/sen_log crus', () => {
    for (const p of raw.players) {
      const s = computePlayerVisionStats(vision, p.player_slot);
      expect(s.observersPlaced, `slot ${p.player_slot}`).toBe(p.obs_log.length);
      expect(s.sentriesPlaced, `slot ${p.player_slot}`).toBe(p.sen_log.length);
      expect(s.wardsPlaced).toBe(p.obs_log.length + p.sen_log.length);
    }
  });

  it('jogador sem ward em partida parseada devolve zeros com dado, nao "sem dado"', () => {
    const semWard = raw.players.filter((p: any) => p.obs_log.length + p.sen_log.length === 0);
    expect(semWard.length).toBeGreaterThan(0);
    for (const p of semWard) {
      const s = computePlayerVisionStats(vision, p.player_slot);
      expect(s.hasData).toBe(true);
      expect(s.wardsPlaced).toBe(0);
      expect(s.avgObserverLifetimeSec).toBe(0);
    }
  });

  it('deward é creditado a quem destruiu: a soma por jogador fecha com o total da partida', () => {
    const total = match.players.reduce(
      (s, p) => s + computePlayerVisionStats(vision, p.playerSlot).dewards,
      0,
    );
    expect(vision.dewards.length).toBeGreaterThan(0);
    expect(total).toBe(vision.dewards.length);
  });

  it('alguem perdeu ward cedo, e so conta ward destruida antes da metade da vida', () => {
    const perdas = match.players.map((p) => computePlayerVisionStats(vision, p.playerSlot).wardsLostEarly);
    expect(perdas.some((n) => n > 0)).toBe(true);
    for (const p of match.players) {
      const s = computePlayerVisionStats(vision, p.playerSlot);
      const destruidas = vision.wards.filter((w) => w.placedBySlot === p.playerSlot && w.wasDestroyed).length;
      expect(s.wardsLostEarly).toBeLessThanOrEqual(destruidas);
    }
  });

  it('wardsBySlot reparte todas as wards entre os dez jogadores', () => {
    const map = wardsBySlot(vision);
    const soma = [...map.values()].reduce((s, l) => s + l.length, 0);
    expect(soma).toBe(vision.wards.length);
    for (const slot of map.keys()) expect(match.players.some((p) => p.playerSlot === slot)).toBe(true);
  });
});

/** Literal minimo de `VisionData` para o que o mapper real nunca produz. SINTETICO. */
function syntheticVision(wards: Array<Partial<WardPlacement>>, dewardsBy: number[] = []): VisionData {
  return {
    source: 'PLAYBACK',
    isReplayParsed: true,
    wards: wards.map((w, i) => ({
      key: `syn-${i}`,
      type: 'OBSERVER',
      x: 120,
      y: 120,
      team: 'RADIANT',
      placedBySlot: 0,
      spawnTime: 0,
      expireTime: OBSERVER_DURATION_SEC,
      lifetimeSeconds: OBSERVER_DURATION_SEC,
      expiryInferred: false,
      wasDestroyed: false,
      destroyedBySlot: null,
      source: 'PLAYBACK',
      ...w,
    })),
    dewards: dewardsBy.map((slot) => ({ time: 100, bySlot: slot, team: 'DIRE' })),
    deaths: [],
    unattributedWards: 0,
    droppedEvents: 0,
  };
}

describe('helpers de visao — bordas que a partida real nao alcanca (sintetico)', () => {
  it('uptime nao dupla-conta intervalos sobrepostos', () => {
    const v = syntheticVision([
      { spawnTime: 0, expireTime: 300 },
      { spawnTime: 100, expireTime: 400, placedBySlot: 1 },
    ]);
    // Uniao = 0..400 = 400s de 800 = 50% (a soma ingenua daria 600 => 75%)
    expect(observerUptimePct(v, 'RADIANT', 800)).toBe(50);
  });

  it('time com dado de visao e nenhuma observer tem uptime 0, nao null', () => {
    const v = syntheticVision([{ type: 'SENTRY' }]);
    expect(observerUptimePct(v, 'DIRE', 1200)).toBe(0);
  });

  it('uptime é null quando nao ha dado de visao', () => {
    expect(observerUptimePct(emptyVisionData(true), 'RADIANT', 1200)).toBeNull();
    expect(computePlayerVisionStats(emptyVisionData(false), 0).hasData).toBe(false);
  });

  it('ward perdida cedo: destruida com menos da metade da vida', () => {
    const v = syntheticVision([
      { wasDestroyed: true, lifetimeSeconds: OBSERVER_DURATION_SEC / 2 - 1 },
      { wasDestroyed: true, lifetimeSeconds: OBSERVER_DURATION_SEC / 2 },
      { wasDestroyed: false, lifetimeSeconds: 10 },
    ]);
    expect(computePlayerVisionStats(v, 0).wardsLostEarly).toBe(1);
  });

  it('deward conta para quem destruiu, nunca para quem colocou', () => {
    const v = syntheticVision([{ wasDestroyed: true, destroyedBySlot: 128 }], [128]);
    expect(computePlayerVisionStats(v, 128).dewards).toBe(1);
    expect(computePlayerVisionStats(v, 0).dewards).toBe(0);
  });

  it('wardsBySlot ignora ward sem dono atribuivel', () => {
    const v = syntheticVision([{ placedBySlot: 0 }, { placedBySlot: null, team: 'UNKNOWN' }]);
    const map = wardsBySlot(v);
    expect(map.get(0)).toHaveLength(1);
    expect(map.size).toBe(1);
  });
});
