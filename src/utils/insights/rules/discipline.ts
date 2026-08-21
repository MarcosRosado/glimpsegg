import { InsightRule } from '../types';

export const disciplineRules: InsightRule[] = [
  {
    id: 'disciplineLowDeaths',
    category: 'DISCIPLINE',
    requires: [],
    evaluate: (ctx) => {
      if (ctx.durationMin < 25 || ctx.player.deaths > 2) return null;
      const bench = ctx.benchmarks.deaths;
      return {
        type: 'STRENGTH',
        magnitude: ctx.player.deaths === 0 ? 0.9 : 0.7,
        params: {
          deaths: ctx.player.deaths,
          minutes: Math.round(ctx.durationMin),
          benchDeaths: bench ? Math.round(bench.value * 10) / 10 : 0,
        },
        source: bench ? bench.source : 'MATCH_ONLY',
        sampleSize: bench?.sampleSize,
      };
    },
  },
  {
    id: 'disciplineHighDeaths',
    category: 'DISCIPLINE',
    requires: [],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.deaths;
      if (!bench || bench.value <= 1) return null;
      const ratio = ctx.player.deaths / bench.value;
      if (ratio < 1.5) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (ratio - 1) / 1.2),
        params: {
          deaths: ctx.player.deaths,
          benchDeaths: Math.round(bench.value * 10) / 10,
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
];
