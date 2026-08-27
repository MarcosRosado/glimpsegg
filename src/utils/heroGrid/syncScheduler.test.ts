import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SyncRecord, SyncState } from '../../types/heroGrid';
import { MAX_SYNC_HISTORY } from './preferences';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  backoffMs,
  buildSyncRecord,
  daysSinceLastSuccess,
  nextDueAt,
  recordSyncOutcome,
  shouldSyncNow,
  SYNC_INTERVAL_MS,
  syncFreshness,
  syncPhase,
} from './syncScheduler';

/**
 * Testes do agendador (T041, T042, T048 de `specs/001-meta-hero-grid/tasks.md`).
 *
 * NENHUM `vi.useFakeTimers()` aqui, de proposito: o agendador recebe `now` por parametro,
 * então todo caso de relogio (24h01, 3 dias fechado, relogio recuado, teto do backoff) é
 * uma chamada de funcao pura em vez de uma espera. Era exatamente esse o motivo de o
 * modulo existir separado do hook — `quickstart.md § Nivel 6`: "Nao espere 24h".
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Instante de referencia arbitrario e fixo. `Date.UTC` vive no TESTE, nunca no modulo. */
const T0 = Date.UTC(2026, 7, 20, 12, 0, 0);

function state(partial: Partial<SyncState> = {}): SyncState {
  return {
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    consecutiveFailures: 0,
    history: [],
    ...partial,
  };
}

/** Estado "sincronizou com sucesso em T0", o ponto de partida da maioria dos casos. */
function syncedAt(at: number, partial: Partial<SyncState> = {}): SyncState {
  return state({ lastSuccessfulSyncAt: at, lastAttemptAt: at, ...partial });
}

describe('syncScheduler: pureza', () => {
  it('nao chama Date.now() em nenhum ponto do modulo', () => {
    // A propriedade que torna todo o resto deste arquivo possivel. Se alguem introduzir
    // uma leitura de relogio interna, os casos de relogio acima passam a depender do
    // instante em que a suite roda — e falham de forma intermitente, na madrugada.
    const source = readFileSync(new URL('./syncScheduler.ts', import.meta.url), 'utf-8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('Date.now');
    expect(code).not.toContain('new Date(');
  });
});

/* ------------------------------------------------------------------ *
 * T041 — fronteira das 24h, FR-022 / FR-023 / FR-029, backoff
 * ------------------------------------------------------------------ */

describe('syncScheduler: fronteira do intervalo diario (FR-022)', () => {
  it('23h59 depois do ultimo sucesso ainda NAO é devido', () => {
    const s = syncedAt(T0);
    const now = T0 + 23 * HOUR + 59 * MINUTE;
    expect(shouldSyncNow(s, now, true)).toBe(false);
    expect(syncPhase(s, now, true)).toBe('IDLE');
  });

  it('exatamente 24h00 JÁ é devido — a comparacao é `>=`, como em data-model.md § 6', () => {
    // Escolha documentada: o data-model escreve `now - last >= 24h` literalmente, e o
    // lado inclusivo é o unico que nao cria um buraco. Com `>` estrito, um tique que
    // caisse exatamente na fronteira adiaria a sincronizacao para a verificacao seguinte.
    const s = syncedAt(T0);
    const now = T0 + SYNC_INTERVAL_MS;
    expect(shouldSyncNow(s, now, true)).toBe(true);
    expect(syncPhase(s, now, true)).toBe('DUE');
  });

  it('24h01 é devido', () => {
    const s = syncedAt(T0);
    const now = T0 + 24 * HOUR + 1 * MINUTE;
    expect(shouldSyncNow(s, now, true)).toBe(true);
    expect(syncPhase(s, now, true)).toBe('DUE');
  });

  it('`nextDueAt` é o ultimo sucesso + 24h quando nao há falha pendente', () => {
    expect(nextDueAt(syncedAt(T0), true)).toBe(T0 + SYNC_INTERVAL_MS);
  });
});

describe('syncScheduler: app reaberto depois de 3 dias fechado (FR-023)', () => {
  const closedFor3Days = syncedAt(T0);
  const now = T0 + 3 * DAY + 2 * HOUR;

  it('é devido na primeira abertura seguinte', () => {
    expect(syncPhase(closedFor3Days, now, true)).toBe('DUE');
    expect(shouldSyncNow(closedFor3Days, now, true)).toBe(true);
  });

  it('UMA sincronizacao resolve a pendencia — nao uma por dia perdido', () => {
    // O bug que FR-023 proibe: tratar 3 dias fechados como 3 execucoes acumuladas. Aqui
    // se prova pelo estado: depois de UM desfecho de sucesso o agendador volta a IDLE,
    // e nao continua DUE pedindo as outras duas.
    const after = recordSyncOutcome(closedFor3Days, 'SUCCESS', now, { heroesOrdered: 124 });
    expect(syncPhase(after, now, true)).toBe('IDLE');
    expect(shouldSyncNow(after, now, true)).toBe(false);
    expect(after.history).toHaveLength(1);
  });

  it('depois dessa unica sincronizacao, a proxima é 24h adiante e nao imediata', () => {
    const after = recordSyncOutcome(closedFor3Days, 'SUCCESS', now, { heroesOrdered: 124 });
    expect(nextDueAt(after, true)).toBe(now + SYNC_INTERVAL_MS);
    expect(shouldSyncNow(after, now + 23 * HOUR, true)).toBe(false);
    expect(shouldSyncNow(after, now + SYNC_INTERVAL_MS, true)).toBe(true);
  });
});

describe('syncScheduler: relogio recuado (FR-029)', () => {
  it('`now < lastSuccessfulSyncAt` NAO é devido e continua IDLE', () => {
    const s = syncedAt(T0);
    const now = T0 - 5 * DAY; // fuso trocado, NTP corrigiu, VM voltou de snapshot
    expect(shouldSyncNow(s, now, true)).toBe(false);
    expect(syncPhase(s, now, true)).toBe('IDLE');
  });

  it('o marcador NAO é reescrito quando o relogio recua', () => {
    // Reescrever seria pior que o sintoma: um salto de relogio viraria perda permanente
    // do historico de sincronizacao. O agendador é puro e nao escreve nada — a prova é
    // que nenhuma funcao de consulta devolve estado novo, e o objeto segue identico.
    const s = syncedAt(T0);
    const before = JSON.stringify(s);
    const now = T0 - 5 * DAY;
    syncPhase(s, now, true);
    shouldSyncNow(s, now, true);
    nextDueAt(s, true);
    syncFreshness(s, now, true);
    expect(JSON.stringify(s)).toBe(before);
    expect(s.lastSuccessfulSyncAt).toBe(T0);
  });

  it('`daysSinceLastSuccess` nao devolve numero negativo com relogio recuado', () => {
    // A tela diria "-5 dias desde a ultima sincronizacao", que é pior que nao dizer nada.
    expect(daysSinceLastSuccess(syncedAt(T0), T0 - 5 * DAY)).toBe(0);
  });

  it('relogio recuado NAO congela o backoff para sempre', () => {
    // FR-029 tem duas metades: nao disparar em rajada E nao deixar de sincronizar
    // indefinidamente. Com `lastAttemptAt` no futuro, a espera nunca venceria; então a
    // espera é considerada cumprida e UMA tentativa repara o marcador.
    const s = state({ lastAttemptAt: T0, consecutiveFailures: 3 });
    expect(syncPhase(s, T0 - 2 * DAY, true)).toBe('DUE');
  });
});

describe('syncScheduler: backoff exponencial com teto (FR-028)', () => {
  it('`failures: 0` nao espera nada', () => {
    expect(backoffMs(0)).toBe(0);
  });

  it('`failures` negativo tambem é 0, nao NaN nem espera invertida', () => {
    expect(backoffMs(-3)).toBe(0);
  });

  it('segue min(30min * 2^(n-1), 6h) para 1..5', () => {
    expect(backoffMs(1)).toBe(30 * MINUTE);
    expect(backoffMs(2)).toBe(60 * MINUTE);
    expect(backoffMs(3)).toBe(2 * HOUR);
    expect(backoffMs(4)).toBe(4 * HOUR);
    expect(backoffMs(5)).toBe(6 * HOUR); // 8h seria o calculo cru; o teto corta
  });

  it('failures alto respeita o teto de 6h sem estourar para Infinity', () => {
    // 2^49 multiplicado antes do `min` seria numero absurdo; com `n` maior ainda, `Infinity`.
    // `Infinity` compararia como "espera infinita" e o app nunca mais tentaria.
    expect(backoffMs(50)).toBe(BACKOFF_MAX_MS);
    expect(Number.isFinite(backoffMs(50))).toBe(true);
    expect(backoffMs(1000)).toBe(BACKOFF_MAX_MS);
    expect(BACKOFF_MAX_MS).toBe(6 * HOUR);
    expect(BACKOFF_BASE_MS).toBe(30 * MINUTE);
  });

  it('estado com falha fica em BACKOFF ate a espera vencer, e então vira DUE', () => {
    const s = state({ lastSuccessfulSyncAt: T0 - 2 * DAY, lastAttemptAt: T0, consecutiveFailures: 2 });
    const wait = backoffMs(2);
    expect(syncPhase(s, T0 + wait - 1, true)).toBe('BACKOFF');
    expect(shouldSyncNow(s, T0 + wait - 1, true)).toBe(false);
    expect(syncPhase(s, T0 + wait, true)).toBe('DUE');
    expect(shouldSyncNow(s, T0 + wait, true)).toBe(true);
  });

  it('em BACKOFF, `nextDueAt` é a ultima tentativa + a espera (nao o ultimo sucesso + 24h)', () => {
    const s = state({ lastSuccessfulSyncAt: T0 - 2 * DAY, lastAttemptAt: T0, consecutiveFailures: 2 });
    expect(nextDueAt(s, true)).toBe(T0 + backoffMs(2));
  });

  it('sucesso zera o contador de falhas e tira o estado do backoff', () => {
    const s = state({ lastSuccessfulSyncAt: T0 - 2 * DAY, lastAttemptAt: T0, consecutiveFailures: 4 });
    const after = recordSyncOutcome(s, 'SUCCESS', T0 + 5 * HOUR, { heroesOrdered: 120 });
    expect(after.consecutiveFailures).toBe(0);
    expect(backoffMs(after.consecutiveFailures)).toBe(0);
    expect(syncPhase(after, T0 + 5 * HOUR, true)).toBe('IDLE');
  });
});

/* ------------------------------------------------------------------ *
 * T042 — I-22 e I-23
 * ------------------------------------------------------------------ */

describe('syncScheduler: I-22 — só desfecho diferente de FAILURE avanca o marcador', () => {
  const before = syncedAt(T0, { consecutiveFailures: 1 });
  const failedAt = T0 + 30 * HOUR;

  it('I-22: FAILURE NAO avanca `lastSuccessfulSyncAt`', () => {
    const after = recordSyncOutcome(before, 'FAILURE', failedAt, { error: 'as duas fontes fora' });
    expect(before.lastSuccessfulSyncAt).toBe(T0);
    expect(after.lastSuccessfulSyncAt).toBe(T0); // identico ao de antes, não `failedAt`
  });

  it('I-22: FAILURE avanca `lastAttemptAt` — é ele que alimenta o backoff', () => {
    const after = recordSyncOutcome(before, 'FAILURE', failedAt, { error: 'timeout' });
    expect(after.lastAttemptAt).toBe(failedAt);
    // Sem esse avanco o backoff mediria a espera a partir de um instante velho e a
    // retentativa sairia em rajada, contra FR-028.
    expect(nextDueAt(after, true)).toBe(failedAt + backoffMs(after.consecutiveFailures));
  });

  it('I-22: FAILURE incrementa `consecutiveFailures`', () => {
    const after = recordSyncOutcome(before, 'FAILURE', failedAt, { error: 'timeout' });
    expect(after.consecutiveFailures).toBe(2);
    expect(before.consecutiveFailures).toBe(1); // o estado de entrada nao é mutado
  });

  it('I-22: SUCCESS avanca o marcador e zera as falhas', () => {
    const at = T0 + 30 * HOUR;
    const after = recordSyncOutcome(before, 'SUCCESS', at, { heroesOrdered: 124 });
    expect(after.lastSuccessfulSyncAt).toBe(at);
    expect(after.lastAttemptAt).toBe(at);
    expect(after.consecutiveFailures).toBe(0);
  });

  it('I-22: PARTIAL tambem avanca o marcador e zera as falhas — parcial é sucesso para o marcador', () => {
    // Tabela de degradacao de `contracts/meta-sources.md § 5`: só OpenDota (sem token da
    // STRATZ) => PARTIAL e o arquivo É escrito. Tratar PARTIAL como falha faria o jogador
    // sem token nunca ver o marcador avancar, e ainda cairia em backoff eterno.
    const at = T0 + 30 * HOUR;
    const after = recordSyncOutcome(before, 'PARTIAL', at, {
      sourcesUsed: ['OPENDOTA_BRACKET'],
      sourcesFailed: ['STRATZ_BRACKET'],
      heroesOrdered: 124,
    });
    expect(after.lastSuccessfulSyncAt).toBe(at);
    expect(after.consecutiveFailures).toBe(0);
    expect(syncPhase(after, at, true)).toBe('IDLE');
  });

  it('duas falhas seguidas somam, e o sucesso seguinte zera de uma vez', () => {
    const one = recordSyncOutcome(before, 'FAILURE', T0 + 30 * HOUR, { error: 'a' });
    const two = recordSyncOutcome(one, 'FAILURE', T0 + 31 * HOUR, { error: 'b' });
    expect(two.consecutiveFailures).toBe(3);
    expect(two.lastSuccessfulSyncAt).toBe(T0);
    const ok = recordSyncOutcome(two, 'SUCCESS', T0 + 40 * HOUR, { heroesOrdered: 10 });
    expect(ok.consecutiveFailures).toBe(0);
    expect(ok.lastSuccessfulSyncAt).toBe(T0 + 40 * HOUR);
  });
});

describe('syncScheduler: I-23 — FAILURE implica arquivo nao escrito', () => {
  it('I-23 (metade do agendador): o registro de falha nao contabiliza escrita alguma', () => {
    // A garantia DURA de I-23 mora em `electron/heroGrid/gridFile.cjs` (a guarda E-3
    // compara os bytes antes de gravar) e no hook, que só chama a escrita no caminho de
    // sucesso/parcial. Aqui se verifica a metade que é do agendador, e nada além disso:
    // o `SyncRecord` de falha registra `heroesOrdered: 0` e nao sinaliza mudanca de
    // estrutura, então nenhuma tela pode reportar escrita a partir de um desfecho de falha.
    const s = syncedAt(T0);
    const after = recordSyncOutcome(s, 'FAILURE', T0 + 30 * HOUR, {
      sourcesFailed: ['OPENDOTA_BRACKET', 'STRATZ_BRACKET'],
      error: 'nenhuma das duas fontes respondeu',
      // Mesmo se quem chama passar um numero por engano, o registro de falha zera:
      heroesOrdered: 124,
      structureChanged: true,
    });
    const record = after.history[after.history.length - 1];
    expect(record.outcome).toBe('FAILURE');
    expect(record.heroesOrdered).toBe(0);
    expect(record.structureChanged).toBe(false);
    expect(record.error).toBe('nenhuma das duas fontes respondeu');
    // E o estado resultante nao sinaliza sucesso de escrita em nenhum campo:
    expect(after.lastSuccessfulSyncAt).toBe(T0);
  });

  it('`buildSyncRecord` produz o registro de falha com as duas fontes marcadas como fora', () => {
    const record = buildSyncRecord('FAILURE', T0, {
      sourcesUsed: ['OPENDOTA_BRACKET'],
      sourcesFailed: ['OPENDOTA_BRACKET', 'STRATZ_BRACKET'],
      error: 'rede fora',
    });
    expect(record.at).toBe(T0);
    expect(record.heroesOrdered).toBe(0);
    expect(record.sourcesUsed).toEqual([]); // falha nao "usou" fonte nenhuma
    expect(record.sourcesFailed).toEqual(['OPENDOTA_BRACKET', 'STRATZ_BRACKET']);
  });

  it('registro de sucesso, ao contrario, carrega os herois ordenados', () => {
    const record = buildSyncRecord('SUCCESS', T0, {
      sourcesUsed: ['OPENDOTA_BRACKET', 'STRATZ_BRACKET'],
      heroesOrdered: 124,
      structureChanged: true,
    });
    expect(record.heroesOrdered).toBe(124);
    expect(record.structureChanged).toBe(true);
    expect(record.error).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * T048 — I-20: feature desligada
 * ------------------------------------------------------------------ */

describe('syncScheduler: I-20 / FR-002 / SC-001 — feature desligada nao faz nada', () => {
  /** Inclui de proposito um estado que, ligado, estaria DUE, e outro em BACKOFF. */
  const cases: Array<{ label: string; state: SyncState; now: number }> = [
    { label: 'estado virgem (nunca sincronizou)', state: state(), now: T0 },
    { label: 'estado que estaria DUE (30h desde o sucesso)', state: syncedAt(T0), now: T0 + 30 * HOUR },
    { label: 'estado que estaria IDLE (1h desde o sucesso)', state: syncedAt(T0), now: T0 + HOUR },
    {
      label: 'estado que estaria em BACKOFF',
      state: state({ lastSuccessfulSyncAt: T0 - 2 * DAY, lastAttemptAt: T0, consecutiveFailures: 2 }),
      now: T0 + 10 * MINUTE,
    },
  ];

  for (const c of cases) {
    it(`I-20: com \`enabled === false\`, ${c.label} devolve OFF e nenhuma acao`, () => {
      // SC-001 / FR-002: com a feature desmarcada o agendador nem chega a olhar o estado.
      // `OFF` é o que faz o hook nao armar timer; `shouldSyncNow` falso é o que impede a
      // requisicao de meta; `nextDueAt` nulo é o que impede a leitura do arquivo de grid
      // agendada para "a proxima prevista". Nenhum dos tres depende do estado.
      expect(syncPhase(c.state, c.now, false)).toBe('OFF');
      expect(shouldSyncNow(c.state, c.now, false)).toBe(false);
      expect(nextDueAt(c.state, false)).toBeNull();
      expect(syncFreshness(c.state, c.now, false).nextDueAt).toBeNull();
    });
  }

  it('I-20: o mesmo estado que devolve OFF desligado devolve DUE ligado — a diferenca é só a flag', () => {
    const s = syncedAt(T0);
    const now = T0 + 30 * HOUR;
    expect(syncPhase(s, now, false)).toBe('OFF');
    expect(syncPhase(s, now, true)).toBe('DUE');
  });
});

/* ------------------------------------------------------------------ *
 * Complementos: primeira vez, frescor e corte do historico
 * ------------------------------------------------------------------ */

describe('syncScheduler: nunca sincronizou', () => {
  it('estado vazio é devido na primeira vez, com `daysSinceLastSuccess` nulo', () => {
    const s = state();
    expect(shouldSyncNow(s, T0, true)).toBe(true);
    expect(syncPhase(s, T0, true)).toBe('DUE');
    expect(daysSinceLastSuccess(s, T0)).toBeNull();
  });

  it('`null` no lugar do estado tambem lê como "nunca sincronizou", nao lanca', () => {
    // O hook pode chamar antes de a config carregar; lancar ali deixaria a aba em branco.
    expect(shouldSyncNow(null, T0, true)).toBe(true);
    expect(daysSinceLastSuccess(null, T0)).toBeNull();
    expect(nextDueAt(null, true)).toBeNull();
  });

  it('`syncFreshness` de estado virgem: dias nulos e proxima prevista nula', () => {
    expect(syncFreshness(state(), T0, true)).toEqual({
      daysSinceLastSuccess: null,
      nextDueAt: null,
    });
  });
});

describe('syncScheduler: daysSinceLastSuccess (FR-024a)', () => {
  it('conta 3 dias cheios', () => {
    expect(daysSinceLastSuccess(syncedAt(T0), T0 + 3 * DAY)).toBe(3);
  });

  it('conta fracao de dia — 12h é 0.5', () => {
    expect(daysSinceLastSuccess(syncedAt(T0), T0 + 12 * HOUR)).toBeCloseTo(0.5, 10);
  });

  it('conta fracao de dia — 30h é 1.25', () => {
    expect(daysSinceLastSuccess(syncedAt(T0), T0 + 30 * HOUR)).toBeCloseTo(1.25, 10);
  });

  it('espelho velho por app fechado fica VISIVEL: 9 dias aparecem como 9', () => {
    const s = syncedAt(T0);
    const now = T0 + 9 * DAY;
    const fresh = syncFreshness(s, now, true);
    expect(fresh.daysSinceLastSuccess).toBe(9);
    expect(fresh.nextDueAt).toBe(T0 + SYNC_INTERVAL_MS); // já passou, e a tela mostra isso
  });
});

describe('syncScheduler: historico (C-5 / FR-036)', () => {
  it('o 21º registro corta o mais antigo e o historico para em 20', () => {
    let s = state();
    for (let i = 0; i < MAX_SYNC_HISTORY; i += 1) {
      s = recordSyncOutcome(s, 'SUCCESS', T0 + i * DAY, { heroesOrdered: i });
    }
    expect(s.history).toHaveLength(MAX_SYNC_HISTORY);
    expect(s.history[0].heroesOrdered).toBe(0);

    const at = T0 + MAX_SYNC_HISTORY * DAY;
    const after = recordSyncOutcome(s, 'SUCCESS', at, { heroesOrdered: 999 });
    expect(after.history).toHaveLength(MAX_SYNC_HISTORY);
    // O corte é na cauda antiga: o primeiro registro sumiu e o novo é o ultimo.
    expect(after.history[0].heroesOrdered).toBe(1);
    expect(after.history[after.history.length - 1].heroesOrdered).toBe(999);
    expect(after.history[after.history.length - 1].at).toBe(at);
  });

  it('o registro novo entra no fim, em ordem cronologica crescente', () => {
    const s = recordSyncOutcome(state(), 'FAILURE', T0, { error: 'x' });
    const after = recordSyncOutcome(s, 'SUCCESS', T0 + HOUR, { heroesOrdered: 5 });
    const outcomes = after.history.map((r: SyncRecord) => r.outcome);
    expect(outcomes).toEqual(['FAILURE', 'SUCCESS']);
  });

  it('registro malformado herdado da config nao sobrevive ao proximo registro', () => {
    // `recordSyncOutcome` passa o historico pelo `clampSyncHistory` de `preferences.ts`,
    // que é o unico lugar do projeto que decide o que é registro valido.
    const dirty = state({ history: [{ at: 0 } as unknown as SyncRecord] });
    const after = recordSyncOutcome(dirty, 'SUCCESS', T0, { heroesOrdered: 1 });
    expect(after.history).toHaveLength(1);
    expect(after.history[0].at).toBe(T0);
  });
});

describe('syncScheduler: RUNNING é exclusivo', () => {
  it('enquanto uma sincronizacao roda, o estado é RUNNING e nao DUE', () => {
    const s = syncedAt(T0);
    const now = T0 + 30 * HOUR;
    expect(syncPhase(s, now, true, true)).toBe('RUNNING');
    expect(shouldSyncNow(s, now, true, true)).toBe(false);
  });

  it('feature desligada vence RUNNING: OFF é terminal', () => {
    expect(syncPhase(syncedAt(T0), T0 + 30 * HOUR, false, true)).toBe('OFF');
  });
});
