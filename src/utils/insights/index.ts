import { CoachingInsight, MatchDetails, MatchPlayer } from '../../types/dota';
import { BuildAdvice } from '../buildAdvisor';
import { buildInsightContext } from './context';
import { rankAndSelect, toInsight } from './rank';
import { ThreatProfile } from './threatProfile';
import { InsightContext, InsightRule } from './types';
import { laningRules } from './rules/laning';
import { farmingRules } from './rules/farming';
import { fightingRules } from './rules/fighting';
import { disciplineRules } from './rules/discipline';
import { objectiveRules } from './rules/objectives';
import { visionRules } from './rules/vision';
import { deathRules } from './rules/deaths';
import { matchupRules } from './rules/matchup';
import { buildRules, compositeRules } from './rules/build';

export const ALL_RULES: InsightRule[] = [
  ...compositeRules, // primeiro: o composto suprime os fracos que o compoem
  ...buildRules,
  ...matchupRules,
  ...deathRules,
  ...laningRules,
  ...fightingRules,
  ...visionRules,
  ...farmingRules,
  ...disciplineRules,
  ...objectiveRules,
];

/**
 * Regras que o insight composto TORNA REDUNDANTES. Se o composto disparou, ele ja
 * conta a mesma historia com a cadeia causal inteira — repetir os pedacos seria
 * encher a lista com tres versoes fracas do mesmo diagnostico.
 */
const SUPPRESSED_BY_COMPOSITE = new Set([
  'deathsBurst',
  'matchupThreatMagical',
  'matchupThreatLockdown',
  'matchupCounterItem',
]);

function requirementsMet(rule: InsightRule, ctx: InsightContext): boolean {
  for (const flag of rule.requires) {
    if (!ctx.availability?.[flag]) return false;
  }
  if (rule.positions && rule.positions.length > 0) {
    if (!rule.positions.includes(ctx.position)) return false;
  }
  return true;
}

export function evaluateRules(ctx: InsightContext): CoachingInsight[] {
  const out: CoachingInsight[] = [];
  let compositeFired = false;

  for (const rule of ALL_RULES) {
    if (compositeFired && SUPPRESSED_BY_COMPOSITE.has(rule.id)) continue;
    if (!requirementsMet(rule, ctx)) continue;
    let hit = null;
    try {
      hit = rule.evaluate(ctx);
    } catch (err) {
      // Uma regra com defeito nao pode derrubar a aba inteira.
      console.warn(`[insights] regra ${rule.id} falhou:`, err);
      continue;
    }
    if (!hit) continue;
    if (rule.id === 'compositeBurstNoDispel') compositeFired = true;
    out.push(toInsight(rule, hit));
  }
  return out;
}

/**
 * Ponto de entrada da aba de coaching.
 *
 * Diferencas em relacao a versao anterior:
 *  - Nao produz texto. Produz `ruleId` + `params` crus; a traducao acontece na UI.
 *  - Nao tem piso artificial de "3 forcas e 3 melhorias". Se nao ha o que dizer, o
 *    retorno é vazio — antes, tres blocos de fallback inventavam conselho generico.
 *  - Ordena por severidade real (`score`), nao pela ordem das regras no arquivo.
 */
export function generateMatchInsights(
  player: MatchPlayer,
  match: MatchDetails,
  extras?: { threat?: ThreatProfile | null; build?: BuildAdvice | null },
): { strengths: CoachingInsight[]; improvements: CoachingInsight[] } {
  if (!player || !match) return { strengths: [], improvements: [] };
  const ctx = buildInsightContext(player, match, {
    threat: extras?.threat ?? null,
    build: extras?.build ?? null,
  });
  return rankAndSelect(evaluateRules(ctx));
}

export { buildInsightContext } from './context';
export * from './types';
