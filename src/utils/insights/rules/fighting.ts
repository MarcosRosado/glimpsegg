import { InsightRule } from '../types';

export const fightingRules: InsightRule[] = [
  {
    id: 'fightKpHigh',
    category: 'FIGHTING',
    requires: [],
    evaluate: (ctx) => {
      const kp = ctx.measured.killParticipationPct;
      const bench = ctx.benchmarks.killParticipationPct;
      if (kp === null || !bench || bench.value <= 5) return null;
      const delta = kp - bench.value;
      if (delta < 10) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, delta / 30),
        params: {
          kp: Math.round(kp),
          benchKp: Math.round(bench.value),
          kills: ctx.player.kills,
          assists: ctx.player.assists,
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'fightKpLow',
    category: 'FIGHTING',
    requires: [],
    evaluate: (ctx) => {
      const kp = ctx.measured.killParticipationPct;
      const bench = ctx.benchmarks.killParticipationPct;
      if (kp === null || !bench || bench.value <= 5) return null;
      // Exige um numero minimo de kills do time, senao "KP baixo" nao quer dizer nada.
      const teamKills = ctx.match.players
        .filter((p) => p.isRadiant === ctx.player.isRadiant)
        .reduce((s, p) => s + p.kills, 0);
      if (teamKills < 15) return null;
      const delta = bench.value - kp;
      if (delta < 15) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, delta / 30),
        params: { kp: Math.round(kp), benchKp: Math.round(bench.value) },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
  {
    id: 'fightDamageShareHigh',
    category: 'FIGHTING',
    requires: [],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const share = ctx.measured.damageSharePct;
      if (share === null || share < 30) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (share - 25) / 25),
        params: {
          share: Math.round(share),
          damage: ctx.player.heroDamage,
          perMin: Math.round(ctx.measured.heroDamagePerMin),
        },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'fightDamageLow',
    category: 'FIGHTING',
    requires: ['heroAverage'],
    positions: ['POSITION_1', 'POSITION_2', 'POSITION_3'],
    evaluate: (ctx) => {
      const bench = ctx.benchmarks.heroDamage;
      if (!bench || bench.value <= 1000) return null;
      const ratio = ctx.player.heroDamage / bench.value;
      if (ratio > 0.7) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - ratio) / 0.5),
        params: {
          damage: ctx.player.heroDamage,
          benchDamage: Math.round(bench.value),
          pct: Math.round((1 - ratio) * 100),
        },
        source: bench.source,
        sampleSize: bench.sampleSize,
      };
    },
  },
];
