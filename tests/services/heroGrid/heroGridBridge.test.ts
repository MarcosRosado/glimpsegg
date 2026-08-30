import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  heroGridBridge,
  isDotaRunning,
  isHeroGridFileAccessAvailable,
  isUnavailableInBrowser,
  listAccounts,
  listBackups,
  readFile,
  restoreBackup,
  writeFile,
} from '../../../src/services/heroGrid/heroGridBridge';
import { GridWriteRequest, HeroGridErrorCode, HeroGridResult } from '../../../src/types/heroGrid';

/**
 * O que este teste protege é uma regra so: no caminho browser a ponte devolve
 * indisponivel EXPLICITO, nunca sucesso simulado. Sucesso fabricado aqui faria o app
 * registrar espelho gravado e data de sincronizacao que nao existem em disco — a mesma
 * classe de bug que motivou a remocao do antigo `mockData.ts`.
 *
 * O vitest roda em `environment: 'node'`: nao ha `window`. Por isso todo cenario monta o
 * `window` com `vi.stubGlobal` e o `afterEach` restaura — inclusive o cenario "browser",
 * que precisa de um `window` SEM `api` (ausencia de `window` inteiro é outro caso, e esta
 * coberto a parte).
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});


/**
 * Assercao de falha + narrowing num passo.
 *
 * Mesmo com `strict: false` o TS nao deixa ler `code`/`error` da uniao `HeroGridResult`
 * sem estreitar antes — e é bom que nao deixe: ler `code` de um resultado que podia ser
 * sucesso é exatamente o descuido que faria um teste "passar" com `undefined`.
 */
function esperaFalha(
  result: HeroGridResult<unknown>,
): { success: false; error: string; code?: HeroGridErrorCode } {
  expect(result.success).toBe(false);
  return result as { success: false; error: string; code?: HeroGridErrorCode };
}

const PATH = '/home/u/.steam/steam/userdata/123/570/remote/cfg/hero_grid_config.json';

/**
 * Um argumento que serve para as seis chamadas. As operacoes sem parametro simplesmente o
 * ignoram — o que interessa no loop é o ramo de disponibilidade, nao a assinatura.
 */
const ANY_ARGS: any = { path: PATH, content: '{}' };

/** Enumeracao vinda do proprio objeto exportado: operacao nova entra no loop sozinha. */
const OPERATIONS = Object.keys(heroGridBridge) as Array<keyof typeof heroGridBridge>;

function fakeHeroGridApi(impl: (op: string, args: any) => any) {
  return {
    listAccounts: vi.fn((...a: any[]) => impl('listAccounts', a[0])),
    readFile: vi.fn((...a: any[]) => impl('readFile', a[0])),
    writeFile: vi.fn((...a: any[]) => impl('writeFile', a[0])),
    restoreBackup: vi.fn((...a: any[]) => impl('restoreBackup', a[0])),
    listBackups: vi.fn((...a: any[]) => impl('listBackups', a[0])),
    isDotaRunning: vi.fn((...a: any[]) => impl('isDotaRunning', a[0])),
  };
}

describe('heroGridBridge — caminho browser (window sem api)', () => {
  it('enumera as seis operacoes do contrato', () => {
    expect([...OPERATIONS].sort()).toEqual(
      [
        'isDotaRunning',
        'listAccounts',
        'listBackups',
        'readFile',
        'restoreBackup',
        'writeFile',
      ].sort(),
    );
  });

  // Loop em vez de seis testes escritos a mao: operacao adicionada no futuro sem
  // tratamento do ramo browser cai aqui automaticamente.
  for (const op of OPERATIONS) {
    it(`${op} devolve indisponivel explicito, nunca sucesso`, async () => {
      vi.stubGlobal('window', {});

      const result = await (heroGridBridge[op] as any)(ANY_ARGS);

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAVAILABLE');
      expect(typeof result.error).toBe('string');
      // Criterio de aceitacao do quickstart: a palavra tem de aparecer.
      expect(result.error.toLowerCase()).toContain('indisponivel');
    });
  }

  it('nenhuma das seis devolve success: true', async () => {
    vi.stubGlobal('window', {});

    const results = await Promise.all(
      OPERATIONS.map((op) => (heroGridBridge[op] as any)(ANY_ARGS)),
    );

    expect(results.map((r: any) => r.success)).toEqual(OPERATIONS.map(() => false));
    expect(results.some((r: any) => r.success === true)).toBe(false);
  });

  it('funciona sem `window` nenhum (o modulo é importavel em ambiente node)', async () => {
    vi.stubGlobal('window', undefined);

    const result = esperaFalha(await readFile({ path: PATH }));

    expect(result.code).toBe('UNAVAILABLE');
  });

  it('isHeroGridFileAccessAvailable é false', () => {
    vi.stubGlobal('window', {});
    expect(isHeroGridFileAccessAvailable()).toBe(false);
  });
});

describe('heroGridBridge — preload antigo (window.api sem heroGrid)', () => {
  // Caso real de atualizacao parcial: o app tem `window.api`, mas de uma versao anterior a
  // esta feature. Tem de virar aviso de indisponibilidade, nao TypeError.
  const legacyApi = { openDotaFetch: vi.fn(), store: { get: vi.fn() } };

  for (const op of OPERATIONS) {
    it(`${op} devolve indisponivel sem lancar`, async () => {
      vi.stubGlobal('window', { api: legacyApi });

      const result = await (heroGridBridge[op] as any)(ANY_ARGS);

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAVAILABLE');
    });
  }

  it('isHeroGridFileAccessAvailable é false', () => {
    vi.stubGlobal('window', { api: legacyApi });
    expect(isHeroGridFileAccessAvailable()).toBe(false);
  });

  it('heroGrid presente mas nao-objeto tambem é indisponivel', async () => {
    vi.stubGlobal('window', { api: { heroGrid: 'sim' } });
    const result = esperaFalha(await listAccounts());
    expect(result.code).toBe('UNAVAILABLE');
    expect(isHeroGridFileAccessAvailable()).toBe(false);
  });
});

describe('heroGridBridge — caminho Electron', () => {
  it('isHeroGridFileAccessAvailable é true quando heroGrid existe', () => {
    vi.stubGlobal('window', { api: { heroGrid: fakeHeroGridApi(() => ({})) } });
    expect(isHeroGridFileAccessAvailable()).toBe(true);
  });

  it('repassa os argumentos de cada operacao e devolve o resultado do IPC sem alterar', async () => {
    // Resultado distinto por operacao: assim uma ponte que chamasse o canal errado (copy
    // & paste entre as seis funcoes) reprovaria em vez de passar por coincidencia.
    const payloads: Record<string, any> = {
      listAccounts: { success: true, data: [{ steamId3: '123' }] },
      readFile: { success: true, data: { exists: true, file: { version: 3, configs: [] } } },
      writeFile: { success: true, data: { backupPath: '/x.bak', bytesWritten: 42 } },
      restoreBackup: { success: true, data: { restoredFrom: '/x.bak' } },
      listBackups: { success: true, data: [{ path: '/x.bak', at: 1, bytes: 2 }] },
      isDotaRunning: { success: true, data: { running: false, method: 'ps' } },
    };
    const api = fakeHeroGridApi((op) => Promise.resolve(payloads[op]));
    vi.stubGlobal('window', { api: { heroGrid: api } });

    const writeRequest: GridWriteRequest = {
      path: PATH,
      content: '{"version":3}',
      expectedSourceIndex: 1,
      expectedSourceConfig: { config_name: 'Meu', categories: [] },
      expectedMirrorIndex: 2,
      expectedConfigCount: 3,
      allowWhileDotaRunning: false,
    };

    // `toBe` e nao `toEqual`: o objeto tem de ser o MESMO, sem reembalagem.
    expect(await listAccounts()).toBe(payloads.listAccounts);
    expect(await readFile({ path: PATH })).toBe(payloads.readFile);
    expect(await writeFile(writeRequest)).toBe(payloads.writeFile);
    expect(await restoreBackup({ path: PATH, backupPath: '/x.bak' })).toBe(payloads.restoreBackup);
    expect(await listBackups({ path: PATH })).toBe(payloads.listBackups);
    expect(await isDotaRunning()).toBe(payloads.isDotaRunning);

    expect(api.readFile).toHaveBeenCalledWith({ path: PATH });
    expect(api.writeFile).toHaveBeenCalledWith(writeRequest);
    expect(api.restoreBackup).toHaveBeenCalledWith({ path: PATH, backupPath: '/x.bak' });
    expect(api.listBackups).toHaveBeenCalledWith({ path: PATH });
    expect(api.listAccounts).toHaveBeenCalledTimes(1);
    expect(api.isDotaRunning).toHaveBeenCalledTimes(1);
  });

  it('IPC que lanca vira resultado de falha, sem excecao escapando', async () => {
    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() => {
          throw new Error('canal removido');
        }),
      },
    });

    for (const op of OPERATIONS) {
      const result: any = await (heroGridBridge[op] as any)(ANY_ARGS);
      expect(result.success).toBe(false);
      expect(result.error).toContain('canal removido');
      // Falha real no Electron NAO é indisponibilidade de modo: a UI diz outra coisa.
      expect(result.code).not.toBe('UNAVAILABLE');
      expect(isUnavailableInBrowser(result)).toBe(false);
    }
  });

  it('promessa rejeitada tambem vira resultado de falha', async () => {
    vi.stubGlobal('window', {
      api: { heroGrid: fakeHeroGridApi(() => Promise.reject(new Error('EPIPE no main'))) },
    });

    const result = esperaFalha(await writeFile({ path: PATH } as any));

    expect(result.error).toContain('EPIPE no main');
  });

  it('mensagem de falha nao carrega o conteudo do arquivo nem o caminho (S-2)', async () => {
    const segredo = '{"version":3,"configs":[{"config_name":"segredo"}]}';
    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() => {
          throw new Error('falha ao gravar');
        }),
      },
    });

    const result = await writeFile({ path: PATH, content: segredo } as any);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error).not.toContain(segredo);
      expect(result.error).not.toContain(PATH);
    }
  });

  it('infere codigo a partir de erro do Node quando o main deixa subir cru', async () => {
    const enoent: any = new Error('ENOENT: no such file');
    enoent.code = 'ENOENT';
    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() => {
          throw enoent;
        }),
      },
    });

    const result = esperaFalha(await readFile({ path: PATH }));

    expect(result.code).toBe('FILE_NOT_FOUND');
  });

  it('excecao que ja traz codigo do contrato preserva esse codigo', async () => {
    const err: any = new Error('origem divergiu');
    err.code = 'SOURCE_MUTATED';
    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() => {
          throw err;
        }),
      },
    });

    const result = esperaFalha(await writeFile({ path: PATH } as any));

    expect(result.code).toBe('SOURCE_MUTATED');
  });

  it('nunca infere UNAVAILABLE a partir de excecao — houve tentativa real de disco', async () => {
    const err: any = new Error('mentiu o codigo');
    err.code = 'UNAVAILABLE';
    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() => {
          throw err;
        }),
      },
    });

    const result = esperaFalha(await writeFile({ path: PATH } as any));

    expect(result.code).toBeUndefined();
    expect(isUnavailableInBrowser(result)).toBe(false);
  });

  it('resposta invalida do main vira falha sem codigo, em vez de TypeError adiante', async () => {
    vi.stubGlobal('window', {
      api: { heroGrid: fakeHeroGridApi(() => Promise.resolve(undefined)) },
    });

    const result = esperaFalha(await listBackups({ path: PATH }));

    expect(result.code).toBeUndefined();
  });
});

describe('heroGridBridge — codigo de falha do IPC chega intacto', () => {
  // A UI precisa do `code` para dizer a coisa certa: `SOURCE_MUTATED` pede "reveja a
  // origem", nao "falha ao gravar". Traduzir ou engolir o codigo aqui é a maneira mais
  // facil de perder essa distincao sem ninguem notar.
  const codes = [
    'SOURCE_MUTATED',
    'CONFIG_COUNT_MISMATCH',
    'SOURCE_INDEX_GONE',
    'DOTA_RUNNING',
    'WRITE_IN_PROGRESS',
    'NO_PERMISSION',
  ] as const;

  for (const code of codes) {
    it(`repassa ${code} do main sem traduzir`, async () => {
      const ipcResult = { success: false as const, code, error: 'mensagem do main' };
      vi.stubGlobal('window', {
        api: { heroGrid: fakeHeroGridApi(() => Promise.resolve(ipcResult)) },
      });

      const result = await writeFile({ path: PATH } as any);

      expect(result).toBe(ipcResult);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.code).toBe(code);
        expect(result.error).toBe('mensagem do main');
      }
      // Falhou NO Electron, nao indisponivel POR modo browser.
      expect(isUnavailableInBrowser(result)).toBe(false);
    });
  }

  it('isUnavailableInBrowser separa os dois casos', async () => {
    vi.stubGlobal('window', {});
    const browser = await writeFile({ path: PATH } as any);
    expect(isUnavailableInBrowser(browser)).toBe(true);

    vi.stubGlobal('window', {
      api: {
        heroGrid: fakeHeroGridApi(() =>
          Promise.resolve({ success: false, code: 'DOTA_RUNNING', error: 'jogo aberto' }),
        ),
      },
    });
    const electron = await writeFile({ path: PATH } as any);
    expect(isUnavailableInBrowser(electron)).toBe(false);
  });
});
