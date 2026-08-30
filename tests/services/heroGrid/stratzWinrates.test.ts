import { describe, it, expect, vi } from 'vitest';
import fixture from '../../../src/services/__fixtures__/hero-winrates.json';
import { RateLimitedError } from '../../../src/services/stratzHeroStats';
import {
  BRACKET_TO_MEDAL_IDS,
  GET_HERO_META_WINRATES_QUERY,
  StratzTransport,
  StratzTransportResult,
  fetchStratzWinrates,
  mapWinWeekRows,
  stratzSourceFailed,
} from '../../../src/services/heroGrid/stratzWinrates';

/**
 * Teste contra a resposta 200 REAL e anonimizada da STRATZ
 * (`__fixtures__/hero-winrates.json`). Sem rede e sem token: o transporte é injetado.
 * O token que aparece aqui é literal de teste — o real nao é revogavel e nao entra em
 * teste, fixture nem log (S-2).
 */
const TOKEN_FALSO = 'fake-token-para-teste';

const divineImmortalRows = (fixture as any).divineImmortal.data.heroStats.winWeek;
const emptyRows = (fixture as any).emptyBracket.data.heroStats.winWeek;

/** Transporte falso que conta chamadas — a contagem é o que prova "sem retry". */
function fakeTransport(result: StratzTransportResult | (() => never)) {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const transport: StratzTransport = async (query, variables) => {
    calls.push({ query, variables });
    if (typeof result === 'function') return result();
    return result;
  };
  return { transport, calls };
}

describe('mapWinWeekRows — mapeamento contra a fixture real', () => {
  const mapped = mapWinWeekRows(divineImmortalRows, 'DIVINE_IMMORTAL', '7.39c');

  it('mapeia os 127 herois de divineImmortal', () => {
    expect(divineImmortalRows).toHaveLength(127);
    expect(mapped).toHaveLength(127);
  });

  it('nao devolve heroId duplicado', () => {
    const ids = mapped.map((m) => m.heroId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserva heroId, winCount e matchCount da linha crua', () => {
    const raw = divineImmortalRows[0];
    const item = mapped.find((m) => m.heroId === raw.heroId);
    expect(item).toBeDefined();
    expect(item!.wins).toBe(raw.winCount);
    expect(item!.matchCount).toBe(raw.matchCount);
    expect(item!.winRate).toBeCloseTo(raw.winCount / raw.matchCount, 10);
  });

  it('mantem winRate sempre em 0..1', () => {
    for (const item of mapped) {
      expect(item.winRate).toBeGreaterThanOrEqual(0);
      expect(item.winRate).toBeLessThanOrEqual(1);
    }
  });

  it('I-11: todo item tem matchCount > 0 e wins definido', () => {
    for (const item of mapped) {
      expect(item.matchCount).toBeGreaterThan(0);
      expect(typeof item.wins).toBe('number');
      expect(Number.isFinite(item.wins)).toBe(true);
    }
  });

  it('I-12: todo item carrega source STRATZ_BRACKET e patch', () => {
    for (const item of mapped) {
      expect(item.source).toBe('STRATZ_BRACKET');
      expect(item.patch).toBe('7.39c');
    }
  });

  it('I-13: bracketIsPlayerSpecific é false somente quando o bracket é ALL', () => {
    expect(mapped.every((m) => m.bracketIsPlayerSpecific === true)).toBe(true);
    const emAll = mapWinWeekRows(divineImmortalRows, 'ALL', '7.39c');
    expect(emAll.every((m) => m.bracketIsPlayerSpecific === false)).toBe(true);
  });
});

describe('mapWinWeekRows — I-14: ausencia nao é 0%', () => {
  it('descarta linha com matchCount 0 em vez de produzir winRate 0', () => {
    const rows = [
      { heroId: 1, winCount: 10, matchCount: 20 },
      { heroId: 2, winCount: 0, matchCount: 0 },
    ];
    const mapped = mapWinWeekRows(rows, 'DIVINE_IMMORTAL', '7.39c');
    expect(mapped.map((m) => m.heroId)).toEqual([1]);
    expect(mapped.find((m) => m.heroId === 2)).toBeUndefined();
    expect(mapped.some((m) => m.winRate === 0)).toBe(false);
  });

  it('nenhum item da fixture com matchCount 0 sobrevive ao mapper', () => {
    const comZerado = [...divineImmortalRows, { heroId: 9999, winCount: 0, matchCount: 0 }];
    const mapped = mapWinWeekRows(comZerado, 'DIVINE_IMMORTAL', '7.39c');
    expect(mapped).toHaveLength(127);
    expect(mapped.every((m) => m.matchCount > 0)).toBe(true);
  });
});

describe('mapWinWeekRows — linha malformada nao quebra o mapper', () => {
  it('descarta linha sem heroId, com campos null ou com winCount > matchCount', () => {
    const rows: any[] = [
      { heroId: 1, winCount: 5, matchCount: 10 },
      { winCount: 5, matchCount: 10 },
      { heroId: null, winCount: 5, matchCount: 10 },
      { heroId: 2, winCount: null, matchCount: 10 },
      { heroId: 3, winCount: 5, matchCount: null },
      { heroId: 4, winCount: 30, matchCount: 10 },
      { heroId: 5, winCount: 'muitos', matchCount: 10 },
      null,
      undefined,
      42,
      { heroId: 1, winCount: 9, matchCount: 10 },
    ];
    const mapped = mapWinWeekRows(rows, 'ALL', '7.39c');
    expect(mapped).toHaveLength(1);
    expect(mapped[0].heroId).toBe(1);
    // A primeira linha do heroId 1 vence; a duplicata nao entra.
    expect(mapped[0].wins).toBe(5);
  });

  it('entrada que nao é array devolve vazio', () => {
    expect(mapWinWeekRows(null, 'ALL', '7.39c')).toEqual([]);
    expect(mapWinWeekRows(undefined, 'ALL', '7.39c')).toEqual([]);
    expect(mapWinWeekRows({} as any, 'ALL', '7.39c')).toEqual([]);
  });
});

describe('BRACKET_TO_MEDAL_IDS — expansao para o enum por medalha', () => {
  it('expande cada RankBracketBasic na lista de medalhas medida', () => {
    expect(BRACKET_TO_MEDAL_IDS.UNCALIBRATED).toEqual(['UNCALIBRATED']);
    expect(BRACKET_TO_MEDAL_IDS.HERALD_GUARDIAN).toEqual(['HERALD', 'GUARDIAN']);
    expect(BRACKET_TO_MEDAL_IDS.CRUSADER_ARCHON).toEqual(['CRUSADER', 'ARCHON']);
    expect(BRACKET_TO_MEDAL_IDS.LEGEND_ANCIENT).toEqual(['LEGEND', 'ANCIENT']);
    expect(BRACKET_TO_MEDAL_IDS.DIVINE_IMMORTAL).toEqual(['DIVINE', 'IMMORTAL']);
  });

  it('ALL nao filtra: a expansao é null, nao a lista das nove medalhas', () => {
    expect(BRACKET_TO_MEDAL_IDS.ALL).toBeNull();
  });

  it('concorda com o _bracketMap documentado na fixture', () => {
    expect(BRACKET_TO_MEDAL_IDS).toEqual((fixture as any)._bracketMap);
  });

  it('a query nao pede groupBy, positionIds nem durationMinute', () => {
    expect(GET_HERO_META_WINRATES_QUERY).toContain('bracketIds: $brackets');
    expect(GET_HERO_META_WINRATES_QUERY).toContain('$brackets: [RankBracket]');
    expect(GET_HERO_META_WINRATES_QUERY).not.toContain('groupBy');
    expect(GET_HERO_META_WINRATES_QUERY).not.toContain('positionIds');
    expect(GET_HERO_META_WINRATES_QUERY).not.toContain('durationMinute');
    expect(GET_HERO_META_WINRATES_QUERY).not.toContain('bracketBasicIds');
  });
});

describe('fetchStratzWinrates — variaveis enviadas', () => {
  it('envia a lista de medalhas expandida para o bracket pedido', async () => {
    const { transport, calls } = fakeTransport((fixture as any).divineImmortal);
    const out = await fetchStratzWinrates('DIVINE_IMMORTAL', TOKEN_FALSO, {
      transport,
      useCache: false,
    });
    expect(out.status).toBe('OK');
    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({ brackets: ['DIVINE', 'IMMORTAL'] });
    expect(calls[0].query).toBe(GET_HERO_META_WINRATES_QUERY);
  });

  it('para ALL manda brackets null, sem filtro', async () => {
    const { transport, calls } = fakeTransport((fixture as any).all);
    const out = await fetchStratzWinrates('ALL', TOKEN_FALSO, { transport, useCache: false });
    expect(out.status).toBe('OK');
    expect(out.rows).toHaveLength(12);
    expect(calls[0].variables).toEqual({ brackets: null });
    expect(out.rows.every((r) => r.bracketIsPlayerSpecific === false)).toBe(true);
  });
});

describe('fetchStratzWinrates — respondeu sem dados', () => {
  it('emptyBracket da fixture devolve EMPTY, nao erro', async () => {
    expect(emptyRows).toEqual([]);
    const { transport, calls } = fakeTransport((fixture as any).emptyBracket);
    const out = await fetchStratzWinrates('UNCALIBRATED', TOKEN_FALSO, {
      transport,
      useCache: false,
    });
    expect(out.status).toBe('EMPTY');
    expect(out.rows).toEqual([]);
    expect(stratzSourceFailed(out)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('resposta sem heroStats.winWeek é ERROR, distinta de EMPTY', async () => {
    const { transport } = fakeTransport({ status: 200, data: {} });
    const out = await fetchStratzWinrates('ALL', TOKEN_FALSO, { transport, useCache: false });
    expect(out.status).toBe('ERROR');
    expect(stratzSourceFailed(out)).toBe(true);
  });

  it('falha de rede é ERROR com mensagem, sem lancar', async () => {
    const { transport, calls } = fakeTransport(() => {
      throw new Error('socket hang up');
    });
    const out = await fetchStratzWinrates('ALL', TOKEN_FALSO, { transport, useCache: false });
    expect(out.status).toBe('ERROR');
    expect(out.reason).toBeTruthy();
    expect(out.reason).not.toContain(TOKEN_FALSO);
    expect(calls).toHaveLength(1);
  });
});

describe('fetchStratzWinrates — 429 sem retry', () => {
  it('lanca RateLimitedError e nao faz uma segunda chamada ao transporte', async () => {
    const { transport, calls } = fakeTransport((fixture as any).rateLimited);
    await expect(
      fetchStratzWinrates('DIVINE_IMMORTAL', TOKEN_FALSO, { transport, useCache: false }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(1);
  });

  it('RateLimitedError levantado pelo transporte sobe intacto, sem repetir', async () => {
    const { transport, calls } = fakeTransport(() => {
      throw new RateLimitedError();
    });
    await expect(
      fetchStratzWinrates('ALL', TOKEN_FALSO, { transport, useCache: false }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(1);
  });
});

describe('fetchStratzWinrates — I-21: sem token é fonte indisponivel, nao erro', () => {
  it('token ausente devolve NO_TOKEN e nao dispara requisicao', async () => {
    const { transport, calls } = fakeTransport((fixture as any).divineImmortal);
    const out = await fetchStratzWinrates('DIVINE_IMMORTAL', undefined, {
      transport,
      useCache: false,
    });
    expect(out.status).toBe('NO_TOKEN');
    expect(out.rows).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('token vazio ou so espaco tambem é NO_TOKEN, sem requisicao', async () => {
    for (const token of ['', '   ']) {
      const { transport, calls } = fakeTransport((fixture as any).divineImmortal);
      const out = await fetchStratzWinrates('ALL', token, { transport, useCache: false });
      expect(out.status).toBe('NO_TOKEN');
      expect(calls).toHaveLength(0);
    }
  });

  it('NO_TOKEN é distinguivel de ERROR: nao conta como fonte que falhou', async () => {
    const semToken = await fetchStratzWinrates('ALL', undefined, {
      transport: fakeTransport((fixture as any).all).transport,
      useCache: false,
    });
    const comFalha = await fetchStratzWinrates('ALL', TOKEN_FALSO, {
      transport: fakeTransport({ status: 500 }).transport,
      useCache: false,
    });
    expect(semToken.status).not.toBe(comFalha.status);
    expect(stratzSourceFailed(semToken)).toBe(false);
    expect(stratzSourceFailed(comFalha)).toBe(true);
  });

  it('nem NO_TOKEN nem ERROR vazam token na mensagem (S-2)', async () => {
    const outs = [
      await fetchStratzWinrates('ALL', undefined, {
        transport: fakeTransport({ status: 200, data: {} }).transport,
        useCache: false,
      }),
      await fetchStratzWinrates('ALL', TOKEN_FALSO, {
        transport: fakeTransport({ status: 503 }).transport,
        useCache: false,
      }),
    ];
    for (const out of outs) {
      expect(out.reason || '').not.toContain(TOKEN_FALSO);
    }
  });
});

describe('fetchStratzWinrates — caminho Electron via window.api', () => {
  it('usa window.api.stratzQuery quando ele existe', async () => {
    const stratzQuery = vi.fn(
      async (_query: string, _variables?: Record<string, unknown>, _apiKey?: string) => ({
        success: true,
        data: (fixture as any).heraldGuardianSample.data,
      }),
    );
    vi.stubGlobal('window', { api: { stratzQuery } });
    try {
      const out = await fetchStratzWinrates('HERALD_GUARDIAN', TOKEN_FALSO, { useCache: false });
      expect(out.status).toBe('OK');
      expect(out.rows).toHaveLength(12);
      expect(stratzQuery).toHaveBeenCalledTimes(1);
      expect(stratzQuery.mock.calls[0][1]).toEqual({ brackets: ['HERALD', 'GUARDIAN'] });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
