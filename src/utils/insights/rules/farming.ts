import { InsightRule } from '../types';
import { heroAverageAt, sumAll } from '../timeSeries';

export const farmingRules: InsightRule[] = [
  {
    id: 'farmingGpmHigh',
    category: 'FARMING',
    requires: [],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.gpm;
      if (!bench || bench.value <= 50) return null;
      const ratio = ctx.player.goldPerMinute / bench.value;
      if (ratio < 1.15) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 0.5),
        params: {
          gpm: ctx.player.goldPerMinute,
          benchGpm: Math.round(bench.value),
          networth: ctx.player.networth,
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'farmingGpmLow',
    category: 'FARMING',
    requires: [],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.gpm;
      if (!bench || bench.value <= 50) return null;
      const ratio = ctx.player.goldPerMinute / bench.value;
      if (ratio > 0.82) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - ratio) / 0.45),
        params: { gpm: ctx.player.goldPerMinute, benchGpm: Math.round(bench.value) },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'farmingStacksHigh',
    category: 'FARMING',
    requires: ['perMinuteStats'],
    positions: ['POSITION_4', 'POSITION_5'],
    evaluate: (ctx) => {
      const stacks = sumAll(ctx.player.series?.campStack);
      const bench = ctx.benchmarks.campsStacked;
      if (stacks === null || stacks < 3) return null;
      if (!bench || bench.value <= 0.5) {
        return {
          type: 'STRENGTH',
          magnitude: Math.min(1, stacks / 10),
          params: { stacks },
          source: 'MATCH_ONLY',
        };
      }
      const ratio = stacks / bench.value;
      if (ratio < 1.2) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 0.8),
        params: { stacks, benchStacks: Math.round(bench.value * 10) / 10 },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'farmingCurveBehind',
    category: 'FARMING',
    requires: ['networthSeries', 'heroAverage'],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      // Compara a curva de patrimonio contra a media do heroi no minuto 20 —
      // e so no minuto 20, para nao acusar quem morreu uma vez no minuto 5.
      const nw = ctx.player.series?.networthPerMinute;
      if (!nw || nw.length <= 20) return null;
      const bench = heroAverageAt(ctx.heroAverage, 20, ctx.position);
      if (!bench || bench.networth <= 500) return null;
      const ratio = nw[20] / bench.networth;
      if (ratio > 0.85) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - ratio) / 0.4),
        params: {
          networth20: nw[20],
          benchNetworth20: Math.round(bench.networth),
          pct: Math.round((1 - ratio) * 100),
        },
        source: 'HERO_AVERAGE',
        sampleSize: bench.matchCount,
        timestampSec: 20 * 60,
      };
    },
  },
];
