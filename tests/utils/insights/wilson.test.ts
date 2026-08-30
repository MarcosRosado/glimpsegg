import { describe, it, expect } from 'vitest';
import { wilsonLowerBound, wilsonUpperBound } from '../../../src/utils/insights/wilson';

describe('limites de Wilson', () => {
  it('o limite inferior fica abaixo da proporcao observada', () => {
    expect(wilsonLowerBound(73, 100)).toBeLessThan(0.73);
    expect(wilsonLowerBound(73, 100)).toBeGreaterThan(0.6);
  });

  it('o limite superior fica acima da proporcao observada', () => {
    expect(wilsonUpperBound(73, 100)).toBeGreaterThan(0.73);
    expect(wilsonUpperBound(73, 100)).toBeLessThan(0.85);
  });

  it('amostra maior aperta o intervalo', () => {
    const larguraPequena = wilsonUpperBound(10, 20) - wilsonLowerBound(10, 20);
    const larguraGrande = wilsonUpperBound(1000, 2000) - wilsonLowerBound(1000, 2000);
    expect(larguraGrande).toBeLessThan(larguraPequena);
  });

  it('O PONTO PRINCIPAL: 3 jogos com 100% nao supera 2553 jogos com 73%', () => {
    const ruido = wilsonLowerBound(3, 3);
    const solido = wilsonLowerBound(1870, 2553);
    expect(ruido).toBeLessThan(solido);
  });

  it('trata n zero e entrada invalida sem explodir', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonUpperBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(5, NaN)).toBe(0);
  });

  it('limita wins a n', () => {
    expect(wilsonLowerBound(200, 100)).toBeLessThanOrEqual(1);
  });

  it('fica dentro de [0, 1]', () => {
    for (const [w, n] of [[0, 10], [10, 10], [1, 1000], [999, 1000]]) {
      expect(wilsonLowerBound(w, n)).toBeGreaterThanOrEqual(0);
      expect(wilsonUpperBound(w, n)).toBeLessThanOrEqual(1);
    }
  });
});
