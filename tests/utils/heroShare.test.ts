import { describe, it, expect } from 'vitest';
import { summarizeHeroShare, winRateTilt, HERO_SHARE_MIN_SAMPLE } from '../../src/utils/heroShare';
import { PlayerMatchSummary } from '../../src/types/dota';

/** Só os campos que `summarizeHeroShare` lê; o resto do resumo não participa. */
function match(heroId: number, over: Partial<PlayerMatchSummary> = {}): PlayerMatchSummary {
  return { heroId, isVictory: true, kills: 4, deaths: 2, assists: 6, glint: null, ...over } as PlayerMatchSummary;
}

describe('summarizeHeroShare', () => {
  it('lista vazia: nenhuma fatia', () => {
    expect(summarizeHeroShare([])).toEqual({ total: 0, wins: 0, slices: [] });
  });

  it('ordena por contagem e desempata pelo herói jogado mais recentemente', () => {
    // A lista vem da mais nova para a mais velha: 2 aparece antes de 3.
    const s = summarizeHeroShare([match(1), match(2), match(3), match(1)]);
    expect(s.slices.map((x) => x.heroId)).toEqual([1, 2, 3]);
    expect(s.slices[0]).toMatchObject({ count: 2, wins: 2, kills: 8, heroCount: 1 });
  });

  it('acima do teto, junta o resto em "outros" na última vaga', () => {
    const ms = [1, 1, 1, 2, 2, 3, 4, 5].map((h) => match(h, { isVictory: h !== 4 }));
    const s = summarizeHeroShare(ms, 3);
    expect(s.slices.map((x) => x.heroId)).toEqual([1, 2, null]);
    const other = s.slices[2];
    expect(other).toMatchObject({ heroCount: 3, count: 3, wins: 2 });
    expect(s.slices.reduce((n, x) => n + x.count, 0)).toBe(s.total);
  });

  it('no teto exato não cria "outros"', () => {
    const s = summarizeHeroShare([match(1), match(2), match(3)], 3);
    expect(s.slices.every((x) => x.heroId !== null)).toBe(true);
  });

  it('Glint ausente não entra na média como 0', () => {
    const s = summarizeHeroShare([match(1, { glint: 60 }), match(1, { glint: null }), match(1, { glint: 0 })]);
    expect(s.slices[0]).toMatchObject({ glintSum: 60, glintCount: 2 });
  });
});

describe('winRateTilt', () => {
  it('abaixo da amostra mínima fica neutro (null), mesmo com 100%', () => {
    expect(winRateTilt({ count: HERO_SHARE_MIN_SAMPLE - 1, wins: HERO_SHARE_MIN_SAMPLE - 1 })).toBeNull();
  });

  it('50% é o centro; satura a 25 pontos de distância', () => {
    expect(winRateTilt({ count: 4, wins: 2 })).toBe(0);
    expect(winRateTilt({ count: 4, wins: 4 })).toBe(1);
    expect(winRateTilt({ count: 4, wins: 0 })).toBe(-1);
    expect(winRateTilt({ count: 10, wins: 6 })).toBeCloseTo(0.4);
  });
});
