import { LaningStats, PlayerLaneResult } from '../types/dota';
import { TranslationKey } from '../i18n/translations';

/**
 * Rotulo do veredito de rota, em UM lugar so.
 *
 * Vivia dentro de `PlayerPerformanceTab` enquanto a dashboard mantinha um segundo
 * sistema de rota — que rotulava "Venceu/Perdeu a Rota" a partir de IMP, KDA, mortes e
 * vitoria da PARTIDA INTEIRA, sem nunca olhar a fase de rota. Foi assim que uma safelane
 * atropelada virou "Rota Dificil" so porque o jogo foi perdido depois.
 *
 * `Record<PlayerLaneResult, TranslationKey>` e literais explicitos sao obrigatorios: e
 * dessa forma que o teste de chave orfa enxerga as chaves, e chave montada em runtime
 * (`t(`lane${x}`)`) escapa dele.
 */
export const LANE_RESULT_KEY: Record<PlayerLaneResult, TranslationKey> = {
  STOMP_WON: 'laneResultStompWon',
  WON: 'laneResultWon',
  TIE: 'laneResultTie',
  LOST: 'laneResultLost',
  STOMP_LOST: 'laneResultStompLost',
  UNKNOWN: 'laneResultUnknown',
};

/**
 * O veredito e exibivel? `UNKNOWN` e ausencia significam "partida nao parseada" — a
 * saida legitima e OMITIR a secao, nunca estimar por IMP.
 */
export function hasLaneVerdict(
  result: PlayerLaneResult | undefined | null,
): result is Exclude<PlayerLaneResult, 'UNKNOWN'> {
  return !!result && result !== 'UNKNOWN';
}

/** Ganhou a rota (com ou sem atropelo). So faz sentido quando `hasLaneVerdict`. */
export function isLaneWin(result: PlayerLaneResult): boolean {
  return result === 'WON' || result === 'STOMP_WON';
}

/** Perdeu a rota (com ou sem atropelo). */
export function isLaneLoss(result: PlayerLaneResult): boolean {
  return result === 'LOST' || result === 'STOMP_LOST';
}

/**
 * O que a tela mostra para a rota de um jogador, ou `null` para OMITIR a secao.
 *
 *  - Rota pareada com veredito: o rotulo do veredito e a diferenca de patrimonio DA ROTA aos
 *    10 min ao lado ("Rota vencida · +1,2k") — o veredito mostra a propria base (Fase 3).
 *  - Rota desigual: nunca "Rota vencida". Sai "Vantagem/Desvantagem aos 10 min" com a
 *    diferenca POR HEROI, que é o que a regra compara (`utils/laneVerdict.ts`).
 *  - Sem medida (partida nao parseada, serie curta, lado vazio): `null`. Nada de "Rota
 *    indefinida" ocupando o lugar do badge.
 */
export interface LaneVerdictView {
  kind: 'VERDICT' | 'ADVANTAGE';
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  hintKey: TranslationKey;
  /** Do lado do jogador, em ouro. */
  networthDiff: number;
  allies: number;
  enemies: number;
  tone: 'positive' | 'negative' | 'neutral';
}

export function laneVerdictView(stats: LaningStats | null | undefined): LaneVerdictView | null {
  const adv = stats?.laneAdvantage;
  if (!stats || !adv) return null;
  const base = { networthDiff: adv.networthDiff, allies: adv.allies, enemies: adv.enemies };
  if (adv.kind === 'VERDICT') {
    if (!hasLaneVerdict(stats.laneResult)) return null;
    return {
      ...base,
      kind: 'VERDICT',
      labelKey: LANE_RESULT_KEY[stats.laneResult],
      detailKey: 'laneVerdictDetail',
      hintKey: 'laneVerdictHint',
      tone: isLaneWin(stats.laneResult) ? 'positive' : isLaneLoss(stats.laneResult) ? 'negative' : 'neutral',
    };
  }
  const tone = adv.networthDiff > 0 ? 'positive' : adv.networthDiff < 0 ? 'negative' : 'neutral';
  return {
    ...base,
    kind: 'ADVANTAGE',
    labelKey: tone === 'positive' ? 'laneAdvantageAhead' : tone === 'negative' ? 'laneAdvantageBehind' : 'laneAdvantageEven',
    detailKey: 'laneAdvantageDetail',
    hintKey: 'laneAdvantageHint',
    tone,
  };
}
