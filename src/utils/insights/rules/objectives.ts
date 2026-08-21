import { InsightRule } from '../types';

export const objectiveRules: InsightRule[] = [
  {
    id: 'objectiveTowerHigh',
    category: 'OBJECTIVE',
    requires: [],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.towerDamage;
      if (!bench || bench.value <= 300 || ctx.player.towerDamage < 3000) return null;
      const ratio = ctx.player.towerDamage / bench.value;
      if (ratio < 1.4) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 1),
        params: { towerDamage: ctx.player.towerDamage, benchTower: Math.round(bench.value) },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'objectiveTowerLow',
    category: 'OBJECTIVE',
    requires: [],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.towerDamage;
      if (!bench || bench.value <= 300 || ctx.durationMin < 30) return null;
      const ratio = ctx.player.towerDamage / bench.value;
      if (ratio > 0.4) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, 1 - ratio),
        params: { towerDamage: ctx.player.towerDamage, benchTower: Math.round(bench.value) },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
];
