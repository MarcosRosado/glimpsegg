import { InsightRule } from '../types';
import { observerUptimePct } from '../../../services/visionMapper';
import { OBSERVER_DURATION_SEC } from '../../../constants/mapGeometry';

/**
 * Regras de visao.
 *
 * Antes, todo jogador tinha exatamente 4 wards falsas, entao o ramo ">= 18" era codigo
 * morto e o ramo "< 8" disparava sempre que o jogo passava de 25 minutos — um falso
 * positivo garantido em toda partida longa.
 *
 * Dois consertos: `requires: ['wards']` (sem dado, nenhum insight de visao) e limiares
 * por 10 MINUTOS em vez de absolutos — um jogo de 60 minutos naturalmente tem mais
 * ward que um de 25, e na amostra real pos5=28 e pos4=19 fariam qualquer limiar
 * absoluto disparar quase sempre.
 */
const SUPPORT_POSITIONS = ['POSITION_4', 'POSITION_5'] as const;

export const visionRules: InsightRule[] = [
  {
    id: 'visionCoverageHigh',
    category: 'VISION',
    requires: ['wards'],
    positions: [...SUPPORT_POSITIONS],
    evaluate: (ctx) => {
      const stats = ctx.player.visionStats;
      if (!stats?.hasData || ctx.durationMin < 12) return null;
      const per10 = (stats.wardsPlaced / ctx.durationMin) * 10;
      const bench = 5.5; // wards por 10 min esperadas de um suporte
      if (per10 < bench * 1.25) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, (per10 / bench - 1) / 0.8),
        params: {
          wards: stats.wardsPlaced,
          observers: stats.observersPlaced,
          sentries: stats.sentriesPlaced,
          per10: Math.round(per10 * 10) / 10,
        },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'visionCoverageLow',
    category: 'VISION',
    requires: ['wards'],
    positions: [...SUPPORT_POSITIONS],
    evaluate: (ctx) => {
      const stats = ctx.player.visionStats;
      if (!stats?.hasData || ctx.durationMin < 20) return null;
      const per10 = (stats.wardsPlaced / ctx.durationMin) * 10;
      const bench = 5.5;
      if (per10 > bench * 0.6) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (1 - per10 / bench) / 0.6),
        params: {
          wards: stats.wardsPlaced,
          per10: Math.round(per10 * 10) / 10,
          benchPer10: bench,
        },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'visionUptimeLow',
    category: 'VISION',
    requires: ['wards'],
    positions: [...SUPPORT_POSITIONS],
    evaluate: (ctx) => {
      // Uptime é o numero que separa "coloquei 20 wards" de "tive visao".
      const team = ctx.player.isRadiant ? 'RADIANT' : 'DIRE';
      const uptime = observerUptimePct(ctx.match.vision, team, ctx.match.durationSeconds);
      if (uptime === null || ctx.durationMin < 20) return null;
      if (uptime > 60) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (60 - uptime) / 45),
        params: { uptime },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'visionWardsLostEarly',
    category: 'VISION',
    requires: ['wards'],
    positions: [...SUPPORT_POSITIONS],
    evaluate: (ctx) => {
      const stats = ctx.player.visionStats;
      if (!stats?.hasData || stats.observersPlaced < 5) return null;
      // Estimativa nao serve para acusar: se o tempo de vida é inferido, nao acusa.
      if (stats.lifetimeIsEstimated) return null;
      const lostPct = (stats.wardsLostEarly / stats.wardsPlaced) * 100;
      if (lostPct < 35) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, lostPct / 70),
        params: {
          lost: stats.wardsLostEarly,
          total: stats.wardsPlaced,
          pct: Math.round(lostPct),
          avgLifetime: stats.avgObserverLifetimeSec,
          fullLifetime: OBSERVER_DURATION_SEC,
        },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'visionDewardsHigh',
    category: 'VISION',
    requires: ['wards'],
    evaluate: (ctx) => {
      const stats = ctx.player.visionStats;
      if (!stats?.hasData || stats.dewards < 4) return null;
      return {
        type: 'STRENGTH',
        magnitude: Math.min(1, stats.dewards / 10),
        params: { dewards: stats.dewards },
        source: 'MATCH_ONLY',
      };
    },
  },
];
