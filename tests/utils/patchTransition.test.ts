import { describe, expect, it } from 'vitest';
import { getPatchTransition } from '../../src/utils/patchTransition';
import { PATCH_TRANSITION } from '../../src/constants/gameVersion';

const CONFIG = { patch: '7.42', releasedAt: '2026-11-18T08:00:00Z', days: 14 };
const at = (iso: string) => new Date(iso);

describe('getPatchTransition', () => {
  it('avisa no dia do patch e ate o ultimo instante do prazo', () => {
    expect(getPatchTransition('7.42', at('2026-11-18T08:00:00Z'), CONFIG)).toBe('7.42');
    expect(getPatchTransition('7.42', at('2026-12-02T07:59:59Z'), CONFIG)).toBe('7.42');
  });

  it('para de avisar quando o prazo vence', () => {
    expect(getPatchTransition('7.42', at('2026-12-02T08:00:00Z'), CONFIG)).toBeNull();
  });

  it('sub-patch com letra continua dentro da mesma transicao', () => {
    expect(getPatchTransition('7.42b', at('2026-11-20T00:00:00Z'), CONFIG)).toBe('7.42');
  });

  it('nao avisa quando o patch resolvido é outro', () => {
    // Offline com cache antigo: os agregados em cache tambem sao do 7.41.
    expect(getPatchTransition('7.41f', at('2026-11-20T00:00:00Z'), CONFIG)).toBeNull();
    // Patch seguinte saiu e ninguem atualizou a constante: o aviso do 7.42 nao vale.
    expect(getPatchTransition('7.43', at('2026-11-20T00:00:00Z'), CONFIG)).toBeNull();
  });

  it('nao avisa antes da publicacao, sem configuracao ou com data invalida', () => {
    expect(getPatchTransition('7.42', at('2026-11-18T07:59:59Z'), CONFIG)).toBeNull();
    expect(getPatchTransition('7.42', at('2026-11-20T00:00:00Z'), null)).toBeNull();
    expect(
      getPatchTransition('7.42', at('2026-11-20T00:00:00Z'), { ...CONFIG, releasedAt: 'ontem' }),
    ).toBeNull();
  });

  it('a constante commitada, se preenchida, tem data valida e prazo positivo', () => {
    if (!PATCH_TRANSITION) return;
    expect(Number.isNaN(Date.parse(PATCH_TRANSITION.releasedAt))).toBe(false);
    expect(PATCH_TRANSITION.days).toBeGreaterThan(0);
    expect(PATCH_TRANSITION.patch).toMatch(/^\d+\.\d+$/);
  });
});
