import { PlayerLaneResult } from '../types/dota';
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
