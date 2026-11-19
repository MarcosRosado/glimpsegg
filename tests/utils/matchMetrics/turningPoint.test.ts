import { describe, it, expect } from 'vitest';
import { TURNING_POINT_MODEL, turningPoint } from '../../../src/utils/matchMetrics/turningPoint';
import { referenceMatch, unevenLaneMatch, unevenLaneRaw } from '../../support/fixtureMatches';
import type { AdvantagePoint } from '../../../src/types/dota';

const line = (golds: number[]): AdvantagePoint[] => golds.map((g, minute) => ({ minute, goldAdvantage: g, experienceAdvantage: 0 }));

describe('turningPoint sobre as partidas reais', () => {
  it('rota desigual (Radiant venceu): 588 atras no minuto 2, a frente de vez a partir do 3 — nao é virada', () => {
    // radiant_gold_adv comeca [0, -501, -588, 16, 27, 625, ...] e nunca mais fica <= 0.
    const m = unevenLaneMatch();
    const tp = turningPoint(m.advantageTimeline, m.didRadiantWin)!;
    expect(tp).toEqual({ maxDeficit: 588, maxDeficitMinute: 2, leadForGoodFromMinute: 3, isComeback: false });
    // Conferencia com a propria OpenDota: `throw` (maior vantagem de quem perdeu) é o mesmo numero.
    expect(unevenLaneRaw().throw).toBe(588);
  });

  it('referencia (Dire venceu sem nunca ficar atras): sem virada, null', () => {
    const m = referenceMatch();
    expect(turningPoint(m.advantageTimeline, m.didRadiantWin)).toBeNull();
  });
});

describe('turningPoint — bordas', () => {
  it('o piso medido decide o rotulo, e o numero sai igual abaixo dele', () => {
    const p = TURNING_POINT_MODEL.minDeficit;
    expect(turningPoint(line([0, -p, 500, 1000]), true)!.isComeback).toBe(true);
    expect(turningPoint(line([0, -(p - 1), 500, 1000]), true)).toMatchObject({ maxDeficit: p - 1, isComeback: false });
  });

  it('visto do vencedor: o sinal inverte quando o Dire vence', () => {
    // Radiant a frente por 9.000 no minuto 2, Dire vence: deficit do Dire = 9.000.
    expect(turningPoint(line([0, 3000, 9000, -2000, -4000]), false)).toMatchObject({ maxDeficit: 9000, maxDeficitMinute: 2, leadForGoodFromMinute: 3 });
  });

  it('vencedor que voltou a ficar atras: "a frente de vez" é o ultimo trecho positivo', () => {
    expect(turningPoint(line([0, 1000, -500, 2000, -100, 300, 800]), true)!.leadForGoodFromMinute).toBe(5);
  });

  it('vencedor que terminou atras em ouro (ganhou mesmo assim): leadForGoodFromMinute null', () => {
    expect(turningPoint(line([0, 2000, -3000]), true)!.leadForGoodFromMinute).toBeNull();
  });

  it('sem serie: null', () => {
    expect(turningPoint([], true)).toBeNull();
    expect(turningPoint(null, true)).toBeNull();
  });
});
