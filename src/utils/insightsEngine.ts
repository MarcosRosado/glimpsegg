/**
 * Shim de compatibilidade.
 *
 * O motor de insights virou o diretorio `utils/insights/`, com regras declarativas,
 * texto em i18n e ranqueamento por severidade real. Este arquivo existe so para nao
 * quebrar imports antigos e deve ser removido quando nao houver mais nenhum.
 */
export { generateMatchInsights, evaluateRules, ALL_RULES } from './insights';
export type { InsightRule, RuleId, RuleHit, InsightContext } from './insights/types';
