import { afterEach, describe, expect, it } from 'vitest';
import fixture from '../../../src/services/__fixtures__/opendota-herostats.json';
import { RankBracketBasic } from '../../../src/utils/rankBracket';
import { fetchOpenDotaMetaWinrates, mapHeroStatsToWinrates } from '../../../src/services/heroGrid/openDotaWinrates';

/**
 * A soma de buckets é logica pura e é onde I-11, I-12 e I-14 se decidem — por isso o teste
 * ataca `mapHeroStatsToWinrates` direto, sem mock de rede.
 *
 * As linhas sinteticas usam valores DISTINTOS por bucket (potencias de 10 mais um digito
 * de identidade) para que trocar um indice na tabela bucket -> bracket mude a soma e
 * quebre o teste. Soma igual em buckets diferentes esconderia exatamente esse erro.
 */

const PATCH = '7.42';

/** `N_pick = N * 100`, `N_win = N * 40` — cada bucket tem soma unica e winrate 0,4. */
function syntheticRow(id: number, overrides: Record<string, number> = {}): any {
  const row: any = { id, localized_name: `Hero ${id}` };
  for (let b = 1; b <= 8; b += 1) {
    row[`${b}_pick`] = b * 100;
    row[`${b}_win`] = b * 40;
  }
  return { ...row, ...overrides };
}

const fixtureRows = (fixture as any).heroStats as any[];

describe('mapHeroStatsToWinrates — tabela bucket -> bracket', () => {
  const cases: { bracket: RankBracketBasic; picks: number; wins: number }[] = [
    // HERALD_GUARDIAN = 1 + 2 => (100 + 200) picks
    { bracket: 'HERALD_GUARDIAN', picks: 300, wins: 120 },
    // CRUSADER_ARCHON = 3 + 4 => (300 + 400)
    { bracket: 'CRUSADER_ARCHON', picks: 700, wins: 280 },
    // LEGEND_ANCIENT = 5 + 6 => (500 + 600)
    { bracket: 'LEGEND_ANCIENT', picks: 1100, wins: 440 },
    // DIVINE_IMMORTAL = 7 + 8 => (700 + 800)
    { bracket: 'DIVINE_IMMORTAL', picks: 1500, wins: 600 },
    // ALL = 1..8 => 100 * (1+..+8) = 3600
    { bracket: 'ALL', picks: 3600, wins: 1440 },
  ];

  for (const c of cases) {
    it(`soma os buckets certos para ${c.bracket}`, () => {
      const out = mapHeroStatsToWinrates([syntheticRow(1)], c.bracket, PATCH);
      expect(out).toHaveLength(1);
      expect(out[0].matchCount).toBe(c.picks);
      expect(out[0].wins).toBe(c.wins);
      expect(out[0].bracket).toBe(c.bracket);
    });
  }

  it('ALL soma 1..8 e é igual a soma das quatro faixas', () => {
    const rows = [syntheticRow(1)];
    const all = mapHeroStatsToWinrates(rows, 'ALL', PATCH)[0];
    const faixas: RankBracketBasic[] = [
      'HERALD_GUARDIAN',
      'CRUSADER_ARCHON',
      'LEGEND_ANCIENT',
      'DIVINE_IMMORTAL',
    ];
    const somaPicks = faixas.reduce(
      (acc, b) => acc + mapHeroStatsToWinrates(rows, b, PATCH)[0].matchCount,
      0,
    );
    const somaWins = faixas.reduce(
      (acc, b) => acc + mapHeroStatsToWinrates(rows, b, PATCH)[0].wins,
      0,
    );
    expect(all.matchCount).toBe(somaPicks);
    expect(all.wins).toBe(somaWins);
  });
});

describe('mapHeroStatsToWinrates — I-14: pick zero é ausencia, nao 0%', () => {
  it('heroi com pick 0 no bracket pedido nao aparece no resultado', () => {
    const semDado = syntheticRow(50, { '5_pick': 0, '5_win': 0, '6_pick': 0, '6_win': 0 });
    const comDado = syntheticRow(51);

    const out = mapHeroStatsToWinrates([semDado, comDado], 'LEGEND_ANCIENT', PATCH);

    expect(out.map((w) => w.heroId)).toEqual([51]);
    // E nao aparece disfarcado de derrota total: nenhuma entrada com winRate 0 e amostra 0.
    expect(out.find((w) => w.heroId === 50)).toBeUndefined();
  });

  it('o mesmo heroi volta a aparecer num bracket onde tem pick', () => {
    const semLegend = syntheticRow(50, { '5_pick': 0, '5_win': 0, '6_pick': 0, '6_win': 0 });
    expect(mapHeroStatsToWinrates([semLegend], 'LEGEND_ANCIENT', PATCH)).toHaveLength(0);
    expect(mapHeroStatsToWinrates([semLegend], 'HERALD_GUARDIAN', PATCH)).toHaveLength(1);
  });

  it('todos os buckets zerados nao produzem nenhuma linha em nenhum bracket', () => {
    const vazio: any = { id: 99 };
    for (let b = 1; b <= 8; b += 1) {
      vazio[`${b}_pick`] = 0;
      vazio[`${b}_win`] = 0;
    }
    const brackets: RankBracketBasic[] = [
      'HERALD_GUARDIAN',
      'CRUSADER_ARCHON',
      'LEGEND_ANCIENT',
      'DIVINE_IMMORTAL',
      'ALL',
    ];
    for (const b of brackets) {
      expect(mapHeroStatsToWinrates([vazio], b, PATCH)).toHaveLength(0);
    }
  });
});

describe('mapHeroStatsToWinrates — I-11 e I-12: amostra e procedencia sempre presentes', () => {
  it('I-11: todo item tem matchCount e wins definidos, com matchCount > 0', () => {
    const out = mapHeroStatsToWinrates(fixtureRows, 'ALL', PATCH);
    expect(out.length).toBeGreaterThan(0);
    for (const w of out) {
      expect(typeof w.matchCount).toBe('number');
      expect(typeof w.wins).toBe('number');
      expect(typeof w.winRate).toBe('number');
      expect(w.matchCount).toBeGreaterThan(0);
      expect(Number.isFinite(w.wins)).toBe(true);
    }
  });

  it('I-12: todo item tem source e patch', () => {
    const out = mapHeroStatsToWinrates(fixtureRows, 'CRUSADER_ARCHON', PATCH);
    expect(out.length).toBeGreaterThan(0);
    for (const w of out) {
      expect(w.source).toBe('OPENDOTA_BRACKET');
      expect(w.patch).toBe(PATCH);
    }
  });
});

describe('mapHeroStatsToWinrates — I-13: bracketIsPlayerSpecific', () => {
  it('é false quando o bracket é ALL', () => {
    const out = mapHeroStatsToWinrates([syntheticRow(1)], 'ALL', PATCH);
    expect(out[0].bracketIsPlayerSpecific).toBe(false);
  });

  it('é true nas quatro faixas de medalha', () => {
    const faixas: RankBracketBasic[] = [
      'HERALD_GUARDIAN',
      'CRUSADER_ARCHON',
      'LEGEND_ANCIENT',
      'DIVINE_IMMORTAL',
    ];
    for (const b of faixas) {
      const out = mapHeroStatsToWinrates([syntheticRow(1)], b, PATCH);
      expect(out[0].bracketIsPlayerSpecific).toBe(true);
    }
  });

  it('UNCALIBRATED cai em media geral e nao é player-specific', () => {
    // `/api/heroStats` nao publica bucket de nao calibrado, entao o bracket cai em 1..8 —
    // e a UI nao pode chamar isso de "no seu ranque".
    const out = mapHeroStatsToWinrates([syntheticRow(1)], 'UNCALIBRATED', PATCH);
    expect(out[0].bracketIsPlayerSpecific).toBe(false);
    expect(out[0].matchCount).toBe(3600);
  });
});

describe('mapHeroStatsToWinrates — linha malformada', () => {
  it('linha sem id é pulada sem quebrar o mapper', () => {
    const out = mapHeroStatsToWinrates(
      [{ '1_pick': 10, '1_win': 5 }, syntheticRow(7)],
      'HERALD_GUARDIAN',
      PATCH,
    );
    expect(out.map((w) => w.heroId)).toEqual([7]);
  });

  it('buckets ausentes contam como zero e nao geram NaN', () => {
    const out = mapHeroStatsToWinrates(
      [{ id: 8, '1_pick': 100, '1_win': 40 }],
      'HERALD_GUARDIAN',
      PATCH,
    );
    expect(out).toHaveLength(1);
    expect(out[0].matchCount).toBe(100);
    expect(out[0].winRate).toBeCloseTo(0.4, 10);
  });

  it('_win maior que _pick nao produz winRate fora de 0..1', () => {
    const out = mapHeroStatsToWinrates(
      [syntheticRow(9, { '1_win': 9999, '2_win': 9999 })],
      'HERALD_GUARDIAN',
      PATCH,
    );
    expect(out).toHaveLength(1);
    expect(out[0].winRate).toBeLessThanOrEqual(1);
    expect(out[0].winRate).toBeGreaterThanOrEqual(0);
    expect(out[0].wins).toBeLessThanOrEqual(out[0].matchCount);
  });

  it('valores negativos ou nao numericos nao vazam para o resultado', () => {
    const out = mapHeroStatsToWinrates(
      [syntheticRow(10, { '1_pick': -50, '2_pick': Number.NaN, '2_win': 'abc' as any })],
      'HERALD_GUARDIAN',
      PATCH,
    );
    // 1_pick negativo e 2_pick NaN viram 0; sobra so o 1_win = 40, preso em [0, 0] => linha
    // sem amostra, que por I-14 nao entra.
    expect(out).toHaveLength(0);
  });

  it('entrada que nao é array devolve array vazio', () => {
    expect(mapHeroStatsToWinrates(null, 'ALL', PATCH)).toEqual([]);
    expect(mapHeroStatsToWinrates({ foo: 1 } as any, 'ALL', PATCH)).toEqual([]);
    expect(mapHeroStatsToWinrates([null, undefined, 42], 'ALL', PATCH)).toEqual([]);
  });
});

describe('mapHeroStatsToWinrates — fixture real reduzida (ponta a ponta)', () => {
  it('mapeia a resposta crua da OpenDota preservando a forma do contrato', () => {
    const out = mapHeroStatsToWinrates(fixtureRows, 'DIVINE_IMMORTAL', PATCH);

    expect(fixtureRows).toHaveLength(10);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(fixtureRows.length);

    const antiMage = out.find((w) => w.heroId === 1);
    expect(antiMage).toBeDefined();
    // Valores medidos na captura: 7_pick 19445 + 8_pick 0, 7_win 9701 + 8_win 0.
    expect(antiMage!.matchCount).toBe(19445);
    expect(antiMage!.wins).toBe(9701);
    expect(antiMage!.winRate).toBeCloseTo(9701 / 19445, 10);
    expect(antiMage!.source).toBe('OPENDOTA_BRACKET');
    expect(antiMage!.bracketIsPlayerSpecific).toBe(true);

    for (const w of out) {
      expect(w.winRate).toBeGreaterThanOrEqual(0);
      expect(w.winRate).toBeLessThanOrEqual(1);
      expect(w.matchCount).toBeGreaterThan(0);
    }
  });

  it('a fixture documenta que foi reduzida e de onde veio', () => {
    const f = fixture as any;
    expect(typeof f._note).toBe('string');
    expect(f._note.length).toBeGreaterThan(40);
    expect(f._originalHeroCount).toBe(127);
    // Os 60 campos por heroi foram preservados: o mapper le a resposta crua de verdade.
    expect(Object.keys(fixtureRows[0]).length).toBe(60);
  });
});

describe('fetchOpenDotaMetaWinrates — fonte indisponivel vs fonte sem dado', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('devolve null quando a fonte nao responde (indisponivel => FAILURE possivel)', async () => {
    (globalThis as any).window = {
      api: { openDotaFetch: async () => ({ success: false, error: 'offline' }) },
    };
    const out = await fetchOpenDotaMetaWinrates('HERALD_GUARDIAN');
    expect(out).toBeNull();
  });

  it('devolve [] quando a fonte responde mas nenhum heroi tem pick no bracket', async () => {
    const zerado = fixtureRows.map((r) => {
      const copy = { ...r };
      for (let b = 1; b <= 8; b += 1) {
        copy[`${b}_pick`] = 0;
        copy[`${b}_win`] = 0;
      }
      return copy;
    });
    (globalThis as any).window = {
      api: { openDotaFetch: async () => ({ success: true, data: zerado }) },
    };
    const out = await fetchOpenDotaMetaWinrates('CRUSADER_ARCHON');
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual([]);
  });

  it('devolve os winrates mapeados quando a fonte responde com dado', async () => {
    (globalThis as any).window = {
      api: { openDotaFetch: async () => ({ success: true, data: fixtureRows }) },
    };
    const out = await fetchOpenDotaMetaWinrates('LEGEND_ANCIENT');
    expect(out).not.toBeNull();
    expect(out!.length).toBeGreaterThan(0);
    for (const w of out!) {
      expect(w.source).toBe('OPENDOTA_BRACKET');
      expect(typeof w.patch).toBe('string');
      expect(w.patch.length).toBeGreaterThan(0);
      expect(w.bracket).toBe('LEGEND_ANCIENT');
    }
  });
});
