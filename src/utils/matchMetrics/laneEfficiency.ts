import { MatchPlayer } from '../../types/dota';

/**
 * EFICIENCIA DE ROTA (§4 de docs/PROPOSTA-V2.md) — o `lane_efficiency` da OpenDota, com a base
 * declarada.
 *
 * O QUE É: ouro aos 10 minutos (`gold_t[10]`) dividido por uma REFERENCIA FIXA de 4.948 de
 * ouro — conferido nas duas fixtures, 20 de 20 jogadores com a mesma razao. Nao compara com o
 * heroi, a posicao nem o ranque, e pode passar de 100%. Por isso a tela nao pode chamar de
 * "eficiencia contra a media": é contra um numero fixo, e tem de aparecer rotulada assim (o
 * mesmo cuidado de `ROLE_BASELINE`).
 *
 * Complementa o veredito de rota (`utils/laneVerdict.ts`), que compara os dois lados da rota;
 * esta compara o jogador com a referencia, sozinho.
 */
export const LANE_EFFICIENCY_REFERENCE_GOLD = 4948;

export interface LaneEfficiency {
  /** Percentual (88,5 = 88,5%). Pode passar de 100. */
  pct: number;
  /** Ouro aos 10 min que a razao implica: pct × 4.948 / 100. */
  gold10: number;
  referenceGold: typeof LANE_EFFICIENCY_REFERENCE_GOLD;
}

export function laneEfficiency(player: MatchPlayer): LaneEfficiency | null {
  const pct = player.laneEfficiencyPct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  return {
    pct,
    gold10: Math.round((pct * LANE_EFFICIENCY_REFERENCE_GOLD) / 100),
    referenceGold: LANE_EFFICIENCY_REFERENCE_GOLD,
  };
}
