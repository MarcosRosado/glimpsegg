import { CoachingInsight, InsightCategory, InsightImpact } from '../../types/dota';
import { InsightRule, RuleHit } from './types';

/**
 * Score e selecao dos insights.
 *
 * O campo `impact` existia no tipo desde o inicio e nunca era usado para NADA — os
 * insights saiam na ordem em que as regras apareciam no arquivo, e um `slice(0, 3)`
 * cortava o resto. Aqui ele finalmente significa algo.
 */

/** Piso: melhoria com score abaixo disto é RUIDO e nao entra. Sem filler. */
export const IMPROVEMENT_SCORE_FLOOR = 25;

/** Teto por categoria, para uma lane ruim nao ocupar todos os slots. */
export const MAX_PER_CATEGORY = 2;

export const MAX_IMPROVEMENTS = 5;
export const MAX_STRENGTHS = 4;

export function scoreFromMagnitude(magnitude: number): number {
  if (!Number.isFinite(magnitude)) return 0;
  return Math.max(0, Math.min(100, Math.round(magnitude * 100)));
}

export function scoreToImpact(score: number): InsightImpact {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Prioridade de categoria, usada apenas como DESEMPATE de score igual.
 * Mantida explicita para a ordenacao ser deterministica e testavel.
 */
const CATEGORY_PRIORITY: Record<InsightCategory, number> = {
  BUILD: 0,
  MATCHUP: 1,
  DEATHS: 2,
  LANING: 3,
  FIGHTING: 4,
  VISION: 5,
  FARMING: 6,
  DISCIPLINE: 7,
  OBJECTIVE: 8,
};

export function toInsight(rule: InsightRule, hit: RuleHit): CoachingInsight {
  const score = scoreFromMagnitude(hit.magnitude);
  return {
    ruleId: rule.id,
    type: hit.type,
    category: rule.category,
    params: hit.params,
    score,
    impact: scoreToImpact(score),
    source: hit.source,
    sampleSize: hit.sampleSize,
    timestampSec: hit.timestampSec,
    heroRefs: hit.heroRefs,
    itemRefs: hit.itemRefs,
  };
}

function rankAndCap(insights: CoachingInsight[], max: number, floor: number): CoachingInsight[] {
  const sorted = insights
    .filter((i) => i.score >= floor)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = CATEGORY_PRIORITY[a.category];
      const pb = CATEGORY_PRIORITY[b.category];
      if (pa !== pb) return pa - pb;
      return a.ruleId.localeCompare(b.ruleId);
    });

  const perCategory = new Map<InsightCategory, number>();
  const out: CoachingInsight[] = [];
  for (const insight of sorted) {
    if (out.length >= max) break;
    const used = perCategory.get(insight.category) ?? 0;
    if (used >= MAX_PER_CATEGORY) continue;
    perCategory.set(insight.category, used + 1);
    out.push(insight);
  }
  return out;
}

/**
 * Separa, ranqueia e limita.
 *
 * NAO existe minimo. Se nada passa do piso, o retorno é vazio e a UI diz isso —
 * antes, tres blocos de fallback garantiam "3 forcas e 3 melhorias" sempre,
 * inventando texto que nao derivava de dado nenhum.
 */
export function rankAndSelect(insights: CoachingInsight[]): {
  strengths: CoachingInsight[];
  improvements: CoachingInsight[];
} {
  return {
    strengths: rankAndCap(
      insights.filter((i) => i.type === 'STRENGTH'),
      MAX_STRENGTHS,
      0,
    ),
    improvements: rankAndCap(
      insights.filter((i) => i.type === 'IMPROVEMENT'),
      MAX_IMPROVEMENTS,
      IMPROVEMENT_SCORE_FLOOR,
    ),
  };
}
