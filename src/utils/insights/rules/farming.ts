import { InsightRule } from '../types';
import { heroAverageAt, sumAll } from '../timeSeries';

export const farmingRules: InsightRule[] = [
  /**
   * Economia. As duas regras mediam `player.goldPerMinute` (ouro GANHO) contra um
   * benchmark de `heroAverage.networth / min` (ouro ACUMULADO em itens e reserva).
   * Unidades diferentes, vies sempre no mesmo sentido: na fixture real, 4 dos 10
   * jogadores estouravam o gatilho de 1.15 so pelo erro, incluindo um pos 5 — e o
   * lado `Low` (< 0.82) praticamente nunca disparava. Agora as duas pontas sao
   * patrimonio por minuto, medidas no mesmo minuto.
   */
  {
    id: 'farmingNetworthHigh',
    category: 'FARMING',
    requires: ['networthSeries'],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.networthPerMin;
      const measured = ctx.measured.networthPerMin;
      if (measured === null || !bench || bench.value <= 50) return null;
      const ratio = measured / bench.value;
      if (ratio < 1.15) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (ratio - 1) / 0.5),
        params: {
          nwpm: Math.round(measured),
          benchNwpm: Math.round(bench.value),
          networth: ctx.player.networth,
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'farmingNetworthLow',
    category: 'FARMING',
    requires: ['networthSeries'],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.networthPerMin;
      const measured = ctx.measured.networthPerMin;
      if (measured === null || !bench || bench.value <= 50) return null;
      const ratio = measured / bench.value;
      if (ratio > 0.82) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - ratio) / 0.45),
        params: { nwpm: Math.round(measured), benchNwpm: Math.round(bench.value) },
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
