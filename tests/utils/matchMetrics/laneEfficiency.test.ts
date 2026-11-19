import { describe, it, expect } from 'vitest';
import { LANE_EFFICIENCY_REFERENCE_GOLD, laneEfficiency } from '../../../src/utils/matchMetrics/laneEfficiency';
import { referenceMatch, referenceRaw, unevenLaneMatch, unevenLaneRaw } from '../../support/fixtureMatches';

describe.each([
  ['referencia', referenceMatch, referenceRaw],
  ['rota desigual', unevenLaneMatch, unevenLaneRaw],
] as const)('laneEfficiency sobre a partida real (%s)', (_n, build, buildRaw) => {
  it('o ouro que a razao implica é o `gold_t[10]` cru, nos dez jogadores', () => {
    const raw = buildRaw();
    for (const p of build().players) {
      const r = raw.players.find((x: any) => x.player_slot === p.playerSlot);
      expect(laneEfficiency(p)!.gold10, `slot ${p.playerSlot}`).toBe(r.gold_t[10]);
    }
  });
});

describe('laneEfficiency', () => {
  it('slot 0 da referencia: 4.379 de ouro aos 10 min / 4.948 = 88,5%', () => {
    const p = referenceMatch().players.find((x) => x.playerSlot === 0)!;
    expect(laneEfficiency(p)!.pct).toBeCloseTo((4379 / 4948) * 100, 6);
    expect(laneEfficiency(p)!.referenceGold).toBe(LANE_EFFICIENCY_REFERENCE_GOLD);
  });

  it('sem o campo: null, nunca 0', () => {
    expect(laneEfficiency({ ...referenceMatch().players[0], laneEfficiencyPct: null })).toBeNull();
  });
});
