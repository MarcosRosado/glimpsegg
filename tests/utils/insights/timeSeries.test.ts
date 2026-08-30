import { describe, it, expect } from 'vitest';
import {
  sumDeltas,
  sumAll,
  cumulativeAt,
  cumulativeLast,
  heroAverageAt,
  heroAverageMaxMinute,
  HERO_AVERAGE_MIN_SAMPLE,
} from '../../../src/utils/insights/timeSeries';
import { HeroAverageEntry } from '../../../src/types/dota';

/**
 * Recortes REAIS de uma resposta 200 da STRATZ (partida parseada, pos 2 mid).
 * As invariantes abaixo sao o motivo de existir este arquivo.
 */
const REAL = {
  // stats.lastHitsPerMinute — DELTA por minuto. Soma === numLastHits.
  lastHitsPerMinute: [2, 1, 3, 2, 4, 2, 5, 4, 3, 6, 1, 4],
  // stats.networthPerMinute — CUMULATIVO.
  networthPerMinute: [600, 899, 1026, 1239, 1380, 1543],
};

describe('sumDeltas — arrays de DELTA por minuto', () => {
  it('CS@10 é a soma dos 10 primeiros minutos', () => {
    expect(sumDeltas(REAL.lastHitsPerMinute, 0, 10)).toBe(32);
  });

  it('soma um intervalo no meio', () => {
    expect(sumDeltas(REAL.lastHitsPerMinute, 5, 8)).toBe(11);
  });

  it('trunca no fim do array em vez de extrapolar', () => {
    expect(sumDeltas([1, 2, 3], 0, 100)).toBe(6);
  });

  it('devolve null para array ausente, vazio ou intervalo vazio', () => {
    expect(sumDeltas(null, 0, 10)).toBeNull();
    expect(sumDeltas([], 0, 10)).toBeNull();
    expect(sumDeltas([1, 2, 3], 5, 5)).toBeNull();
    expect(sumDeltas([1, 2, 3], 10, 20)).toBeNull();
  });

  it('ignora buracos nao numericos', () => {
    expect(sumDeltas([1, null as any, 3, undefined as any], 0, 4)).toBe(4);
  });
});

describe('INVARIANTE: delta versus cumulativo', () => {
  // Este é o teste que justifica o setup de testes inteiro. Confundir os dois
  // produz erro de ~4,5x e coaching confiantemente errado.
  it('a soma do array de delta reproduz o total da partida', () => {
    const numLastHits = 37; // === soma do recorte real acima
    expect(sumAll(REAL.lastHitsPerMinute)).toBe(numLastHits);
  });

  it('o ULTIMO valor do array cumulativo é o total, nao a soma', () => {
    const networth = 1543;
    expect(cumulativeLast(REAL.networthPerMinute)).toBe(networth);
    // A soma seria absurda — exatamente o bug que este teste impede.
    expect(REAL.networthPerMinute.reduce((a, b) => a + b, 0)).toBeGreaterThan(networth * 4);
  });

  it('cumulativeAt le a posicao, nao acumula', () => {
    expect(cumulativeAt(REAL.networthPerMinute, 3)).toBe(1239);
  });

  it('cumulativeAt devolve null fora do alcance, sem extrapolar', () => {
    expect(cumulativeAt(REAL.networthPerMinute, 99)).toBeNull();
    expect(cumulativeAt(REAL.networthPerMinute, -1)).toBeNull();
    expect(cumulativeAt(null, 3)).toBeNull();
  });
});

/** Curva heroAverage real (pos 2 mid), valores conferidos na API. */
function curve(matchCount = 7821): HeroAverageEntry[] {
  const at = (timeMin: number, cs: number, dn: number, networth: number): HeroAverageEntry =>
    ({ timeMin, position: 'POSITION_2', matchCount, winCount: Math.round(matchCount * 0.51), cs, dn, networth,
       xp: 0, kills: 0, deaths: 0, assists: 0, heroDamage: 0, towerDamage: 0, campsStacked: 0, level: 0,
       killContributionAverage: 0, kDAAverage: 0,
       stunCount: 0, stunDuration: 0, disableCount: 0, disableDuration: 0 });
  return [at(0, 0, 0, 219.18), at(10, 38.61, 7.97, 3573.95), at(20, 107.96, 9.24, 9749.56)];
}

describe('heroAverageAt', () => {
  it('indexa pelo campo timeMin, nao pela posicao no array', () => {
    const e = heroAverageAt(curve(), 20, 'POSITION_2')!;
    expect(e.timeMin).toBe(20);
    expect(e.cs).toBe(107.96);
  });

  it('ALINHAMENTO: CS@10 somado bate contra o heroAverage cumulativo do minuto 10', () => {
    // Os dois lados sao cumulativos no minuto 10 — é o que torna a comparacao valida.
    const playerCs10 = sumDeltas(REAL.lastHitsPerMinute, 0, 10)!;
    const bench = heroAverageAt(curve(), 10, 'POSITION_2')!;
    expect(playerCs10).toBe(32);
    expect(bench.cs).toBe(38.61);
    // O jogador ficou um pouco atras — plausivel. Se o codigo comparasse a soma
    // contra um valor por-minuto, a razao seria absurda.
    const ratio = playerCs10 / bench.cs;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });

  it('devolve null passado o fim da curva, sem clampar', () => {
    expect(heroAverageAt(curve(), 45, 'POSITION_2')).toBeNull();
  });

  it('devolve null quando a amostra é fina (degrada para ROLE_BASELINE)', () => {
    expect(heroAverageAt(curve(HERO_AVERAGE_MIN_SAMPLE - 1), 10, 'POSITION_2')).toBeNull();
    expect(heroAverageAt(curve(HERO_AVERAGE_MIN_SAMPLE), 10, 'POSITION_2')).not.toBeNull();
  });

  it('cai para a posicao mais representada quando a pedida nao existe', () => {
    const e = heroAverageAt(curve(), 10, 'POSITION_5');
    expect(e).not.toBeNull();
    expect(e!.position).toBe('POSITION_2');
  });

  it('devolve null para curva ausente ou vazia', () => {
    expect(heroAverageAt(null, 10)).toBeNull();
    expect(heroAverageAt([], 10)).toBeNull();
  });

  it('heroAverageMaxMinute acha o alcance da curva', () => {
    expect(heroAverageMaxMinute(curve())).toBe(20);
    expect(heroAverageMaxMinute(null)).toBeNull();
  });
});
