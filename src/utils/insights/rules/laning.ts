import { InsightRule } from '../types';

/**
 * Regras de lane. Agora medem a lane DE VERDADE: `cs10` vem da soma dos 10 primeiros
 * minutos de `lastHitsPerMinute`, e `laneResult` vem de `top/mid/bottomLaneOutcome`.
 * Antes, `lastHits10` era `numLastHits * 0.22` e a "eficiencia de lane" era o literal 82.
 */
export const laningRules: InsightRule[] = [
  {
    id: 'laningCsHigh',
    category: 'LANING',
    requires: ['perMinuteStats'],
    evaluate: (ctx) => {
      const { cs10 } = ctx.measured;
      const bench = ctx.benchmarks.cs10;
      if (cs10 === null || !bench || bench.value <= 5) return null;
      const ratio = cs10 / bench.value;
      if (ratio < 1.15) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 0.5),
        params: {
          cs: cs10,
          benchCs: Math.round(bench.value),
          pct: Math.round((ratio - 1) * 100),
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'laningCsLow',
    category: 'LANING',
    requires: ['perMinuteStats'],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const { cs10 } = ctx.measured;
      const bench = ctx.benchmarks.cs10;
      if (cs10 === null || !bench || bench.value <= 5) return null;
      const ratio = cs10 / bench.value;
      if (ratio > 0.8) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - ratio) / 0.5),
        params: {
          cs: cs10,
          benchCs: Math.round(bench.value),
          pct: Math.round((1 - ratio) * 100),
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'laningDeniesHigh',
    category: 'LANING',
    requires: ['perMinuteStats'],
    evaluate: (ctx) => {
      const { dn10 } = ctx.measured;
      const bench = ctx.benchmarks.dn10;
      if (dn10 === null || dn10 < 8 || !bench || bench.value <= 1) return null;
      const ratio = dn10 / bench.value;
      if (ratio < 1.3) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 0.8),
        params: { denies: dn10, benchDenies: Math.round(bench.value * 10) / 10 },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'laningLaneStomped',
    category: 'LANING',
    requires: ['laneOutcomes'],
    evaluate: (ctx) => {
      const result = ctx.player.laningStats?.laneResult;
      if (result !== 'STOMP_WON') return null;
      return {
        type: 'STRENGTH',
        magnitude: 0.75,
        params: { cs: ctx.measured.cs10 ?? 0 },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'laningLaneLost',
    category: 'LANING',
    requires: ['laneOutcomes'],
    evaluate: (ctx) => {
      const result = ctx.player.laningStats?.laneResult;
      if (result !== 'LOST' && result !== 'STOMP_LOST') return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: result === 'STOMP_LOST' ? 0.8 : 0.5,
        params: { cs: ctx.measured.cs10 ?? 0 },
        source: 'MATCH_ONLY',
      };
    },
  },
];
