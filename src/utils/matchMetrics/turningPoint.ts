import { AdvantagePoint } from '../../types/dota';

/**
 * MOMENTO DE VIRADA (§4 de docs/PROPOSTA-V2.md) — onde o vencedor esteve mais atras em ouro e
 * a partir de que minuto liderou de vez.
 *
 * FONTE: `advantageTimeline[].goldAdvantage` (o `radiant_gold_adv` da OpenDota, um ponto por
 * minuto, positivo = Radiant a frente). Visto do VENCEDOR: o sinal é invertido quando o Dire
 * venceu. `comeback`/`throw` da OpenDota medem o mesmo deficit, mas vem so quando ha deficit
 * (na fixture, dois dos quatro campos chegam `undefined`), entao servem de conferencia no
 * teste e nao de fonte.
 *
 * QUANDO HA VIRADA: o vencedor esteve atras por pelo menos `TURNING_POINT_MODEL.minDeficit` de
 * ouro em algum minuto. O piso saiu por TAXA DE DISPARO nos pares (`scripts/fit-turning-point.cjs`),
 * como todo limiar de rotulo do projeto: sem ele, 588 de ouro aos 2 minutos (fixture de rota
 * desigual) viraria "virada". Abaixo do piso a funcao devolve os numeros com `isComeback: false`
 * — a tela pode mostrar o deficit, nao pode chamar de virada.
 *
 * `null` sem serie, ou quando o vencedor nunca esteve atras.
 */

export const TURNING_POINT_MODEL = {
  fittedAt: '2026-11-19',
  /** Pares de 7.41 e 7.42 com serie de vantagem (retrato congelado). */
  matches: 1092,
  /** Fracao das partidas que o piso faz disparar (alvo do projeto para rotulo: 5% a 15%). */
  targetRate: 0.1,
  /** 11,1% em 7.41 (879) e 6,6% em 7.42 (213). */
  measuredRate: 0.103,
  /** Ouro. p50 do deficit do vencedor é 906; 207 de 1092 vencedores nunca estiveram atras. */
  minDeficit: 8600,
} as const;

export interface TurningPoint {
  /** Maior desvantagem do vencedor, em ouro (positivo). */
  maxDeficit: number;
  /** Minuto em que essa desvantagem aconteceu (o primeiro, se repetiu). */
  maxDeficitMinute: number;
  /** Primeiro minuto a partir do qual o vencedor liderou ate o fim. `null` se terminou sem liderar. */
  leadForGoodFromMinute: number | null;
  /** O deficit passou do piso medido: a tela pode chamar de virada. */
  isComeback: boolean;
}

export function turningPoint(timeline: AdvantagePoint[] | null | undefined, didRadiantWin: boolean): TurningPoint | null {
  if (!timeline || timeline.length === 0) return null;
  const points = timeline.slice().sort((a, b) => a.minute - b.minute);
  const sign = didRadiantWin ? 1 : -1;
  const lead = points.map((p) => sign * p.goldAdvantage);

  let maxDeficit = 0;
  let maxDeficitMinute = -1;
  lead.forEach((v, i) => {
    if (-v > maxDeficit) {
      maxDeficit = -v;
      maxDeficitMinute = points[i].minute;
    }
  });
  if (maxDeficitMinute < 0) return null;

  let leadForGoodFromMinute: number | null = null;
  for (let i = lead.length - 1; i >= 0 && lead[i] > 0; i--) leadForGoodFromMinute = points[i].minute;

  return {
    maxDeficit,
    maxDeficitMinute,
    leadForGoodFromMinute,
    isComeback: maxDeficit >= TURNING_POINT_MODEL.minDeficit,
  };
}
