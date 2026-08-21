import { MatchDeathEvent } from '../../../types/dota';
import { InsightRule } from '../types';

/**
 * Forense de morte, tudo de `stats.deathEvents`.
 *
 * Estas regras nao existiam porque o dado nao era pedido. Cada uma diz algo que
 * nenhuma metrica agregada consegue: "3 das suas mortes foram dentro da visao inimiga"
 * é acionavel de um jeito que "voce morreu 10 vezes" nunca é.
 */

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function countFlag(deaths: MatchDeathEvent[], flag: keyof MatchDeathEvent): number {
  return deaths.filter((d) => d[flag] === true).length;
}

export const deathRules: InsightRule[] = [
  {
    id: 'deathsBurst',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      const deaths = ctx.deaths;
      if (deaths.length < 4) return null;
      const burst = countFlag(deaths, 'isBurst');
      const share = pct(burst, deaths.length);
      if (burst < 3 || share < 40) return null;
      const first = deaths.find((d) => d.isBurst);
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, share / 80),
        params: { burst, total: deaths.length, pct: Math.round(share) },
        source: 'MATCH_ONLY',
        timestampSec: first?.time,
        heroRefs: ctx.threat?.topAttacker ? [ctx.threat.topAttacker.heroId] : undefined,
      };
    },
  },
  {
    id: 'deathsWardWalk',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      const deaths = ctx.deaths;
      if (deaths.length < 6) return null;
      const walked = countFlag(deaths, 'isWardWalkThrough');
      const share = pct(walked, deaths.length) / 100;
      // CALIBRACAO MEDIDA: numa partida real parseada, 56 de 103 mortes (54%) tinham
      // `isWardWalkThrough`, distribuido por todos os 10 jogadores (22% a 100%).
      // Morrer dentro de visao inimiga é a NORMA no Dota, nao a excecao — um limiar
      // do tipo "walked >= 2" dispararia para todo mundo em toda partida, que é
      // exatamente o falso positivo que este motor existe para nao cometer.
      // Só vale insight quem esta claramente acima da linha de base.
      const BASELINE_SHARE = 0.54;
      if (walked < 4 || share < 0.7) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (share - BASELINE_SHARE) / 0.3),
        params: { walked, total: deaths.length, pct: Math.round(share * 100) },
        source: 'MATCH_ONLY',
        timestampSec: deaths.find((d) => d.isWardWalkThrough)?.time,
      };
    },
  },
  {
    id: 'deathsDieBack',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      const back = countFlag(ctx.deaths, 'isDieBack');
      if (back < 3) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, back / 6),
        params: { back, total: ctx.deaths.length, pct: Math.round(pct(back, ctx.deaths.length)) },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'deathsTpInterrupted',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      const tp = countFlag(ctx.deaths, 'isAttemptTpOut');
      if (tp < 2) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, tp / 4),
        params: { tp, total: ctx.deaths.length },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'deathsHealUnused',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      const unused = countFlag(ctx.deaths, 'hasHealAvailable');
      if (unused < 2) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, unused / 5),
        params: { unused, total: ctx.deaths.length },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'deathsTimeDead',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      if (ctx.deaths.length === 0 || ctx.match.durationSeconds <= 0) return null;
      const dead = ctx.deaths.reduce((s, d) => s + (d.timeDead ?? 0), 0);
      const share = dead / ctx.match.durationSeconds;
      if (share <= 0.18) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, (share - 0.18) / 0.2),
        params: { pct: Math.round(share * 100), deadSec: Math.round(dead) },
        source: 'MATCH_ONLY',
      };
    },
  },
  {
    id: 'deathsNemesis',
    category: 'DEATHS',
    requires: ['deathEvents'],
    evaluate: (ctx) => {
      if (ctx.deaths.length < 4) return null;
      const bySlot = new Map<number, number>();
      for (const d of ctx.deaths) {
        if (d.attackerSlot === null || d.attackerSlot === undefined) continue;
        bySlot.set(d.attackerSlot, (bySlot.get(d.attackerSlot) ?? 0) + 1);
      }
      let topSlot: number | null = null;
      let topCount = 0;
      for (const [slot, count] of bySlot) {
        if (count > topCount) {
          topCount = count;
          topSlot = slot;
        }
      }
      if (topSlot === null) return null;
      const share = pct(topCount, ctx.deaths.length);
      if (share < 40) return null;
      const enemy = ctx.match.players.find((p) => p.playerSlot === topSlot);
      if (!enemy || enemy.isRadiant === ctx.player.isRadiant) return null;
      return {
        type: 'IMPROVEMENT',
        magnitude: Math.min(1, share / 70),
        params: { count: topCount, total: ctx.deaths.length, pct: Math.round(share) },
        source: 'MATCH_ONLY',
        heroRefs: [enemy.heroId],
      };
    },
  },
];
