import { describe, expect, it } from 'vitest';

import type { HeroScore } from '../../../src/types/heroGrid';
import {
  STALE_DAYS_THRESHOLD,
  describeDaysSince,
  formatRatioPercent,
  formatScoreValue,
  isMirrorStale,
  isPersonalApplied,
  isScoreDisplayable,
  sortScoresForDisplay,
} from '../../../src/utils/heroGrid/tabFormat';

/** Nota minima valida, para os testes falarem so do campo que estao exercitando. */
function score(partial: Partial<HeroScore>): HeroScore {
  return {
    heroId: 1,
    score: 0.5,
    breakdown: { metaComponent: 0.5, personalComponent: null, personalWeight: 0 },
    criterion: 'COMBINED',
    ...partial,
  };
}

describe('describeDaysSince (FR-024a)', () => {
  it('nunca sincronizado nao é "0 dias"', () => {
    expect(describeDaysSince(null)).toEqual({ kind: 'NEVER', days: 0 });
    expect(describeDaysSince(undefined)).toEqual({ kind: 'NEVER', days: 0 });
  });

  it('fracao de dia é "hoje", nao 1 dia', () => {
    expect(describeDaysSince(0)).toEqual({ kind: 'TODAY', days: 0 });
    expect(describeDaysSince(0.0139)).toEqual({ kind: 'TODAY', days: 0 });
    expect(describeDaysSince(0.999)).toEqual({ kind: 'TODAY', days: 0 });
  });

  it('trunca para dias inteiros completos', () => {
    expect(describeDaysSince(1)).toEqual({ kind: 'ONE', days: 1 });
    expect(describeDaysSince(1.97)).toEqual({ kind: 'ONE', days: 1 });
    expect(describeDaysSince(3.2)).toEqual({ kind: 'MANY', days: 3 });
    expect(describeDaysSince(31.9)).toEqual({ kind: 'MANY', days: 31 });
  });

  it('entrada invalida cai em NEVER em vez de exibir NaN', () => {
    expect(describeDaysSince(Number.NaN).kind).toBe('NEVER');
    expect(describeDaysSince(Number.POSITIVE_INFINITY).kind).toBe('NEVER');
    expect(describeDaysSince(-4).kind).toBe('NEVER');
  });
});

describe('isMirrorStale', () => {
  it('um dia é o ciclo normal e nao é aviso', () => {
    expect(isMirrorStale(0.4)).toBe(false);
    expect(isMirrorStale(1.8)).toBe(false);
  });

  it('dois dias inteiros ou nunca sincronizado viram aviso', () => {
    expect(STALE_DAYS_THRESHOLD).toBe(2);
    expect(isMirrorStale(2)).toBe(true);
    expect(isMirrorStale(9.5)).toBe(true);
    expect(isMirrorStale(null)).toBe(true);
  });
});

describe('isScoreDisplayable (FR-030b / I-15)', () => {
  it('nota com breakdown coerente é exibivel', () => {
    expect(isScoreDisplayable(score({}))).toBe(true);
  });

  it('nota sem breakdown NAO é exibivel', () => {
    expect(isScoreDisplayable(score({ breakdown: undefined as never }))).toBe(false);
    expect(isScoreDisplayable(score({ breakdown: null as never }))).toBe(false);
  });

  it('peso pessoal nao numerico invalida a nota', () => {
    expect(
      isScoreDisplayable(
        score({ breakdown: { metaComponent: 0.5, personalComponent: null, personalWeight: Number.NaN } }),
      ),
    ).toBe(false);
  });

  it('"sem dado" nao é nota exibivel', () => {
    expect(isScoreDisplayable(score({ score: null, noDataReason: 'NO_META' }))).toBe(false);
    expect(isScoreDisplayable(null)).toBe(false);
  });
});

describe('isPersonalApplied (FR-030c)', () => {
  it('peso zero significa componente pessoal nao aplicado', () => {
    expect(isPersonalApplied(score({}))).toBe(false);
  });

  it('peso positivo com componente presente conta como aplicado', () => {
    expect(
      isPersonalApplied(
        score({ breakdown: { metaComponent: 0.5, personalComponent: 0.6, personalWeight: 0.33 } }),
      ),
    ).toBe(true);
  });

  it('peso positivo sem componente nao conta como aplicado', () => {
    expect(
      isPersonalApplied(
        score({ breakdown: { metaComponent: 0.5, personalComponent: null, personalWeight: 0.33 } }),
      ),
    ).toBe(false);
  });
});

describe('sortScoresForDisplay (I-9)', () => {
  it('nota maior primeiro e "sem dado" ao fim', () => {
    const ordered = sortScoresForDisplay([
      score({ heroId: 1, score: 0.42 }),
      score({ heroId: 2, score: null, noDataReason: 'NO_META' }),
      score({ heroId: 3, score: 0.71 }),
      score({ heroId: 4, score: 0.55 }),
    ]);
    expect(ordered.map((s) => s.heroId)).toEqual([3, 4, 1, 2]);
  });

  it('preserva a ordem da origem entre os "sem dado"', () => {
    const ordered = sortScoresForDisplay([
      score({ heroId: 10, score: null, noDataReason: 'NO_META' }),
      score({ heroId: 11, score: 0.3 }),
      score({ heroId: 12, score: null, noDataReason: 'HERO_UNKNOWN' }),
    ]);
    expect(ordered.map((s) => s.heroId)).toEqual([11, 10, 12]);
  });

  it('nao muta a entrada e tolera lista ausente', () => {
    const input = [score({ heroId: 1, score: 0.1 }), score({ heroId: 2, score: 0.9 })];
    sortScoresForDisplay(input);
    expect(input.map((s) => s.heroId)).toEqual([1, 2]);
    expect(sortScoresForDisplay(null)).toEqual([]);
  });
});

describe('formatacao de numeros', () => {
  it('percentual mantem uma decimal', () => {
    expect(formatRatioPercent(0.5236)).toBe('52.4%');
    expect(formatRatioPercent(0.5)).toBe('50.0%');
  });

  it('ausencia devolve null em vez de 0%', () => {
    expect(formatRatioPercent(null)).toBeNull();
    expect(formatRatioPercent(undefined)).toBeNull();
    expect(formatRatioPercent(Number.NaN)).toBeNull();
    expect(formatScoreValue(null)).toBeNull();
  });

  it('nota sai com tres decimais', () => {
    expect(formatScoreValue(0.4)).toBe('0.400');
    expect(formatScoreValue(0.7123)).toBe('0.712');
  });
});
