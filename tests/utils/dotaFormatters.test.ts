import { describe, it, expect } from 'vitest';
import {
  IMP_EXTREME,
  formatImp,
  formatImpMarked,
  getImpBadgeStyle,
  getImpColor,
  getImpIconKind,
  getImpSymbol,
  isExtremeImp,
} from '../../src/utils/dotaFormatters';

/**
 * O IMP da STRATZ NAO e limitado em +-50. Medido em 400 jogadores reais (60 partidas,
 * bracket 6): apareceram -52 e -51, e o maior positivo foi +42. Um teste de igualdade
 * (`imp === -50`) deixaria justamente os dois casos mais extremos de fora.
 */
describe('extremo de IMP', () => {
  it('e faixa aberta, nao igualdade: -51 e -52 contam', () => {
    for (const imp of [-50, -51, -52, -80]) {
      expect(isExtremeImp(imp), `${imp} deveria ser extremo`).toBe(true);
      expect(getImpSymbol(imp)).toBe('☠');
    }
    for (const imp of [50, 51, 99]) {
      expect(isExtremeImp(imp), `${imp} deveria ser extremo`).toBe(true);
      expect(getImpSymbol(imp)).toBe('★');
    }
  });

  it('nao dispara logo abaixo do limite', () => {
    for (const imp of [49, 42, 0, -42, -49]) {
      expect(isExtremeImp(imp), `${imp} nao deveria ser extremo`).toBe(false);
      expect(getImpSymbol(imp)).toBe('');
    }
  });

  it('o limite e simetrico', () => {
    expect(isExtremeImp(IMP_EXTREME)).toBe(true);
    expect(isExtremeImp(-IMP_EXTREME)).toBe(true);
    expect(isExtremeImp(IMP_EXTREME - 1)).toBe(false);
    expect(isExtremeImp(-IMP_EXTREME + 1)).toBe(false);
  });
});

describe('formatacao de IMP', () => {
  it('formatImp so poe o sinal — o chip usa este, porque o icone ja e o simbolo', () => {
    expect(formatImp(24)).toBe('+24');
    expect(formatImp(0)).toBe('+0');
    expect(formatImp(-52)).toBe('-52');
    expect(formatImp(50)).toBe('+50');
  });

  it('formatImpMarked poe o simbolo — para texto puro, sem icone ao lado', () => {
    expect(formatImpMarked(24)).toBe('+24');
    expect(formatImpMarked(50)).toBe('★ +50');
    expect(formatImpMarked(-52)).toBe('☠ -52');
    expect(formatImpMarked(-49)).toBe('-49');
  });
});

describe('destaque do extremo: cor, icone e simbolo juntos', () => {
  it('estrela no topo, caveira no fundo, raio no resto', () => {
    for (const imp of [50, 51, 99]) expect(getImpIconKind(imp)).toBe('STAR');
    for (const imp of [-50, -51, -52]) expect(getImpIconKind(imp)).toBe('SKULL');
    for (const imp of [49, 25, 0, -25, -49]) expect(getImpIconKind(imp)).toBe('ZAP');
  });

  it('sai da escala verde/vermelha nos dois extremos', () => {
    // Verde e vermelho ja significam bom/ruim na escala normal; um verde mais forte para
    // +50 se perderia entre os +25. Magenta nao e usado por mais nada.
    for (const imp of [50, -50, -52]) {
      expect(getImpColor(imp)).toContain('fuchsia');
      expect(getImpBadgeStyle(imp).border).toContain('fuchsia');
    }
  });

  it('o chip extremo continua TRANSLUCIDO, como o resto da escala', () => {
    // Uma versao com fundo solido foi tentada e rejeitada: pesava demais e quebrava a
    // consistencia com os outros chips.
    for (const imp of [50, -50, -52]) {
      expect(getImpBadgeStyle(imp).bg, `${imp} deveria ser translucido`).toContain('/');
    }
  });

  it('a escala normal continua intacta', () => {
    expect(getImpColor(30)).toContain('emerald');
    expect(getImpColor(10)).toContain('emerald');
    expect(getImpColor(0)).toContain('zinc');
    expect(getImpColor(-10)).toContain('amber');
    expect(getImpColor(-30)).toContain('rose');
    for (const imp of [30, 10, 0, -10, -30]) {
      expect(getImpColor(imp)).not.toContain('fuchsia');
      expect(getImpBadgeStyle(imp).bg).not.toContain('fuchsia');
    }
  });
});
