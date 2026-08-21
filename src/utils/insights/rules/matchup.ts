import { InsightRule } from '../types';
import { MATCHUP_MIN_SAMPLE } from '../threatProfile';

/**
 * Consciencia de matchup.
 *
 * Antes, o motor filtrava so aliados (`p.isRadiant === player.isRadiant`) e nunca
 * olhava os cinco inimigos, apesar de eles estarem em memoria. O filler
 * "Review defensive counter-items (BKB, Manta, Lotus Orb or Linken's)" era emitido
 * independentemente do draft.
 */
export const matchupRules: InsightRule[] = [
  {
    id: 'matchupHardCounter',
    category: 'MATCHUP',
    requires: [],
    evaluate: (ctx) => {
      const hardest = ctx.threat?.hardestMatchups?.[0];
      if (!hardest || hardest.matchCount < MATCHUP_MIN_SAMPLE) return null;
      // Só vale como conselho se o confronto é de fato desfavoravel com folga.
      if (hardest.ourWinRateLower >= 0.47) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (0.5 - hardest.ourWinRateLower) / 0.12),
        params: {
          winRate: Math.round(hardest.ourWinRate * 1000) / 10,
          matches: hardest.matchCount,
        },
        source: 'HERO_STATS',
        sampleSize: hardest.matchCount,
        heroRefs: [hardest.heroId],
      };
    },
  },
  {
    id: 'matchupThreatMagical',
    category: 'MATCHUP',
    requires: ['damageReport'],
    evaluate: (ctx) => {
      const t = ctx.threat;
      if (!t || !t.archetypes.includes('MAGIC_BURST') || t.totalReceived < 5000) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (t.magicalPct - 0.5) / 0.35),
        params: {
          pct: Math.round(t.magicalPct * 100),
          attackerPct: t.topAttacker ? Math.round(t.topAttacker.pct * 100) : 0,
        },
        source: 'MATCH_ONLY',
        heroRefs: t.topAttacker ? [t.topAttacker.heroId] : undefined,
      };
    },
  },
  {
    id: 'matchupThreatPhysical',
    category: 'MATCHUP',
    requires: ['damageReport'],
    evaluate: (ctx) => {
      const t = ctx.threat;
      if (!t || !t.archetypes.includes('PHYSICAL_RIGHT_CLICK') || t.totalReceived < 5000) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (t.physicalPct - 0.55) / 0.35),
        params: {
          pct: Math.round(t.physicalPct * 100),
          attackerPct: t.topAttacker ? Math.round(t.topAttacker.pct * 100) : 0,
        },
        source: 'MATCH_ONLY',
        heroRefs: t.topAttacker ? [t.topAttacker.heroId] : undefined,
      };
    },
  },
  {
    id: 'matchupThreatLockdown',
    category: 'MATCHUP',
    requires: ['damageReport', 'heroAverage'],
    evaluate: (ctx) => {
      const t = ctx.threat;
      if (!t || t.controlRatio === null || !t.archetypes.includes('HARD_LOCKDOWN')) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (t.controlRatio - 1.2) / 1.3),
        // RAZAO, nunca segundos: as unidades de disableDuration da API sao ambiguas.
        params: { ratio: Math.round(t.controlRatio * 10) / 10 },
        source: 'HERO_AVERAGE',
      };
    },
  },
];
