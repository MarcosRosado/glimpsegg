import { InsightRule, RuleHit } from '../types';
import { BuildVerdict } from '../../buildAdvisor';

/**
 * Regras de build. Traduzem os veredictos do `buildAdvisor` (que é puro e testado)
 * em insights ranqueaveis. Nenhum numero aqui é inventado: todos vem de
 * `heroStats.itemFullPurchase` para o heroi, posicao e ranque do jogador.
 */

function verdictOf(ctx: { build: { verdicts: BuildVerdict[] } | null }, kind: BuildVerdict['kind']) {
  return ctx.build?.verdicts.filter((v) => v.kind === kind) ?? [];
}

function hitFrom(v: BuildVerdict, type: 'STRENGTH' | 'IMPROVEMENT', extra: Record<string, number | string> = {}): RuleHit {
  return {
    type,
    magnitude: v.magnitude,
    params: {
      winRate: Math.round((v.bestBandWinRate ?? 0) * 1000) / 10,
      baselineWinRate: Math.round(v.heroBaselineWinRate * 1000) / 10,
      bandStart: v.bestBandMin ? v.bestBandMin[0] : 0,
      bandEnd: v.bestBandMin ? v.bestBandMin[1] : 0,
      ...extra,
    },
    source: 'HERO_STATS',
    sampleSize: v.sampleSize,
    timestampSec: v.playerTimeMin !== undefined ? v.playerTimeMin * 60 : undefined,
    itemRefs: [v.itemId],
  };
}

export const buildRules: InsightRule[] = [
  {
    id: 'buildItemLate',
    category: 'BUILD',
    requires: [],
    evaluate: (ctx) => {
      const v = verdictOf(ctx, 'LATE')[0];
      if (!v) return null;
      return hitFrom(v, 'IMPROVEMENT', {
        playerMin: v.playerTimeMin ?? 0,
        playerWinRate: Math.round((v.playerBandWinRate ?? 0) * 1000) / 10,
      });
    },
  },
  {
    id: 'buildItemMissing',
    category: 'BUILD',
    requires: [],
    evaluate: (ctx) => {
      const v = verdictOf(ctx, 'MISSING')[0];
      if (!v) return null;
      return hitFrom(v, 'IMPROVEMENT', { medianMin: v.bestBandMin ? v.bestBandMin[0] : 0 });
    },
  },
  {
    id: 'buildItemOffMeta',
    category: 'BUILD',
    requires: [],
    evaluate: (ctx) => {
      const v = verdictOf(ctx, 'OFF_META')[0];
      if (!v) return null;
      return hitFrom(v, 'IMPROVEMENT', { playerMin: v.playerTimeMin ?? 0 });
    },
  },
  {
    id: 'buildItemGood',
    category: 'BUILD',
    requires: [],
    evaluate: (ctx) => {
      const v = verdictOf(ctx, 'GOOD')[0];
      if (!v) return null;
      return hitFrom(v, 'STRENGTH', { playerMin: v.playerTimeMin ?? 0 });
    },
  },
  {
    id: 'matchupCounterItem',
    category: 'MATCHUP',
    requires: [],
    evaluate: (ctx) => {
      const v = verdictOf(ctx, 'COUNTER_PICK')[0];
      if (!v) return null;
      const t = ctx.threat;
      const hit = hitFrom(v, 'IMPROVEMENT', {
        threatPct: t
          ? Math.round(
              (v.threatArchetype === 'MAGIC_BURST' ? t.magicalPct : t.physicalPct) * 100,
            )
          : 0,
        attackerPct: t?.topAttacker ? Math.round(t.topAttacker.pct * 100) : 0,
      });
      if (v.attributedHeroId) hit.heroRefs = [v.attributedHeroId];
      return hit;
    },
  },
];

/**
 * A regra transversal — e a manchete da aba.
 *
 * Se as mortes por burst dominam E a ameaca medida é dano magico E o item de dispel
 * esta ausente ou chegou tarde, emite UM insight composto de score alto em vez de tres
 * fracos. É onde um motor de regras ganha de um LLM: a cadeia causal é auditavel,
 * cada elo aponta para um campo da API.
 */
export const compositeRules: InsightRule[] = [
  {
    id: 'compositeBurstNoDispel',
    category: 'BUILD',
    requires: ['deathEvents', 'damageReport'],
    evaluate: (ctx) => {
      const t = ctx.threat;
      if (!t) return null;
      const isMagic = t.archetypes.includes('MAGIC_BURST');
      const isLockdown = t.archetypes.includes('HARD_LOCKDOWN');
      if (!isMagic && !isLockdown) return null;

      const burstDeaths = ctx.deaths.filter((d) => d.isBurst);
      if (ctx.deaths.length < 4 || burstDeaths.length / ctx.deaths.length < 0.4) return null;

      const counter = ctx.build?.verdicts.find(
        (v) =>
          v.kind === 'COUNTER_PICK' &&
          (v.threatArchetype === 'MAGIC_BURST' || v.threatArchetype === 'HARD_LOCKDOWN'),
      );
      if (!counter) return null;

      const medianBurstMin = Math.round(
        burstDeaths.reduce((s, d) => s + d.time, 0) / burstDeaths.length / 60,
      );

      return {
        type: 'IMPROVEMENT',
        // Alta de proposito: é a conclusao mais acionavel que o motor produz.
        magnitude: Math.max(0.85, counter.magnitude),
        params: {
          burst: burstDeaths.length,
          total: ctx.deaths.length,
          threatPct: Math.round((isMagic ? t.magicalPct : t.physicalPct) * 100),
          attackerPct: t.topAttacker ? Math.round(t.topAttacker.pct * 100) : 0,
          medianBurstMin,
          bandStart: counter.bestBandMin ? counter.bestBandMin[0] : 0,
          bandEnd: counter.bestBandMin ? counter.bestBandMin[1] : 0,
          winRate: Math.round((counter.bestBandWinRate ?? 0) * 1000) / 10,
          playerMin: counter.playerTimeMin ?? -1,
        },
        source: 'HERO_STATS',
        sampleSize: counter.sampleSize,
        itemRefs: [counter.itemId],
        heroRefs: t.topAttacker ? [t.topAttacker.heroId] : undefined,
        timestampSec: medianBurstMin * 60,
      };
    },
  },
];
