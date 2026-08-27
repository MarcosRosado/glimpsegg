import { describe, expect, it } from 'vitest';
import type { SyncRecord } from '../../types/heroGrid';
import {
  browserConfigIO,
  clampSyncHistory,
  disableHeroGrid,
  HERO_GRID_DEFAULTS,
  loadHeroGridPreferences,
  MAX_SYNC_HISTORY,
  preferencesFromConfig,
  preferencesPatch,
  saveHeroGridPreferences,
  syncStateFromConfig,
  syncStatePatch,
  type HeroGridConfigIO,
  type StorageLike,
} from './preferences';

/**
 * Testes das funcoes puras de `preferences.ts`. Ambiente é `node` (sem DOM), então nada
 * aqui toca `localStorage` real: o caminho browser é exercitado com um fake de storage
 * injetado, e o caminho Electron com um `HeroGridConfigIO` de mentira.
 */

/** Fake de `localStorage` — um Map, o suficiente para o contrato de `StorageLike`. */
function fakeStorage(seed: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** IO de mentira que registra o que foi gravado, para provar "só as chaves que mudaram". */
function recordingIO(initial: Record<string, unknown> = {}) {
  const writes: Record<string, unknown>[] = [];
  const io: HeroGridConfigIO = {
    read: async () => initial as never,
    write: async (patch) => {
      writes.push({ ...patch });
    },
  };
  return { io, writes };
}

function record(at: number, extra: Partial<SyncRecord> = {}): SyncRecord {
  return {
    at,
    outcome: 'SUCCESS',
    sourcesUsed: ['OPENDOTA_BRACKET'],
    sourcesFailed: [],
    heroesOrdered: 124,
    structureChanged: false,
    ...extra,
  };
}

describe('preferencesFromConfig', () => {
  it('config vazio devolve a feature desligada e o critério COMBINED (cenário "usuário atualizou de uma versão anterior do app": nenhuma chave heroGrid* existe no stratz_app_config.json, e C-1 manda ler o default — FR-001/FR-030)', () => {
    const prefs = preferencesFromConfig({});
    expect(prefs.enabled).toBe(false);
    expect(prefs.criterion).toBe('COMBINED');
  });

  it('config vazio devolve todos os defaults da tabela do contrato', () => {
    expect(preferencesFromConfig({})).toEqual({
      enabled: false,
      steamId3: null,
      gridFilePath: null,
      source: null,
      mirror: null,
      mirrorName: null,
      criterion: 'COMBINED',
      bracket: null,
    });
  });

  it('undefined e null devolvem os defaults sem lançar', () => {
    expect(preferencesFromConfig(undefined)).toEqual(HERO_GRID_DEFAULTS);
    expect(preferencesFromConfig(null)).toEqual(HERO_GRID_DEFAULTS);
    expect(() => preferencesFromConfig(undefined)).not.toThrow();
  });

  it('chave desconhecida no config não quebra a leitura e é ignorada', () => {
    const prefs = preferencesFromConfig({
      heroGridEnabled: true,
      heroGridFuturoDaValve: { qualquer: 'coisa' },
      naoExiste: 42,
    } as never);
    expect(prefs.enabled).toBe(true);
    expect(prefs).not.toHaveProperty('heroGridFuturoDaValve');
    expect(Object.keys(prefs).sort()).toEqual([
      'bracket',
      'criterion',
      'enabled',
      'gridFilePath',
      'mirror',
      'mirrorName',
      'source',
      'steamId3',
    ]);
  });

  it('cada chave da tabela do contrato, com valor válido, é respeitada', () => {
    const prefs = preferencesFromConfig({
      heroGridEnabled: true,
      heroGridSteamId3: '123456789',
      heroGridFilePath: '/home/x/.steam/steam/userdata/1/570/remote/cfg/hero_grid_config.json',
      heroGridSource: { index: 2, name: 'Meu layout' },
      heroGridMirror: { index: 5, name: 'GlimpseGG' },
      heroGridMirrorName: 'Layout1 — GlimpseGG',
      heroGridCriterion: 'META_ONLY',
      heroGridBracket: 'LEGEND_ANCIENT',
    });
    expect(prefs).toEqual({
      enabled: true,
      steamId3: '123456789',
      gridFilePath: '/home/x/.steam/steam/userdata/1/570/remote/cfg/hero_grid_config.json',
      source: { index: 2, name: 'Meu layout' },
      mirror: { index: 5, name: 'GlimpseGG' },
      mirrorName: 'Layout1 — GlimpseGG',
      criterion: 'META_ONLY',
      bracket: 'LEGEND_ANCIENT',
    });
  });

  /**
   * C-8: `mirrorName` (nome DESEJADO) e `mirror.name` (ultimo nome VISTO no arquivo) sao
   * chaves distintas de proposito. Se um dia alguem as unificar "para simplificar", a
   * sincronizacao seguinte vai comparar um nome que nao existe no disco, concluir rename
   * (N-3) e descartar a escolha do jogador — sem erro visivel.
   */
  it('C-8: mirrorName é independente de mirror.name', () => {
    const prefs = preferencesFromConfig({
      heroGridMirror: { index: 5, name: 'Nome antigo no arquivo' },
      heroGridMirrorName: 'Nome que o jogador quer',
    });
    expect(prefs.mirror).toEqual({ index: 5, name: 'Nome antigo no arquivo' });
    expect(prefs.mirrorName).toBe('Nome que o jogador quer');
  });

  it('C-8: mirrorName vazio ou só espaços lê como null, para cair no default de N-5', () => {
    expect(preferencesFromConfig({ heroGridMirrorName: '' }).mirrorName).toBeNull();
    expect(preferencesFromConfig({ heroGridMirrorName: '   ' }).mirrorName).toBeNull();
    expect(preferencesFromConfig({ heroGridMirrorName: 42 as never }).mirrorName).toBeNull();
    expect(preferencesFromConfig({}).mirrorName).toBeNull();
  });

  it('os três critérios válidos passam', () => {
    expect(preferencesFromConfig({ heroGridCriterion: 'COMBINED' }).criterion).toBe('COMBINED');
    expect(preferencesFromConfig({ heroGridCriterion: 'META_ONLY' }).criterion).toBe('META_ONLY');
    expect(preferencesFromConfig({ heroGridCriterion: 'PERSONAL_ONLY' }).criterion).toBe(
      'PERSONAL_ONLY'
    );
  });

  it('valor de tipo errado cai no default em vez de propagar lixo', () => {
    // Config editado a mão, ou escrito por uma versão futura, não pode virar estado inválido.
    expect(preferencesFromConfig({ heroGridEnabled: 'sim' } as never).enabled).toBe(false);
    expect(preferencesFromConfig({ heroGridEnabled: 1 } as never).enabled).toBe(false);
    expect(preferencesFromConfig({ heroGridCriterion: 'FOO' } as never).criterion).toBe('COMBINED');
    expect(preferencesFromConfig({ heroGridCriterion: 7 } as never).criterion).toBe('COMBINED');
    expect(preferencesFromConfig({ heroGridBracket: 'IMMORTAL_ONLY' } as never).bracket).toBeNull();
    expect(preferencesFromConfig({ heroGridSteamId3: 12345 } as never).steamId3).toBeNull();
    expect(preferencesFromConfig({ heroGridFilePath: '   ' }).gridFilePath).toBeNull();
  });

  it('heroGridConsecutiveFailures negativo cai no default 0', () => {
    expect(syncStateFromConfig({ heroGridConsecutiveFailures: -3 }).consecutiveFailures).toBe(0);
    expect(syncStateFromConfig({ heroGridConsecutiveFailures: 2.5 }).consecutiveFailures).toBe(0);
    expect(syncStateFromConfig({ heroGridConsecutiveFailures: '4' } as never).consecutiveFailures).toBe(
      0
    );
    expect(syncStateFromConfig({ heroGridConsecutiveFailures: 4 }).consecutiveFailures).toBe(4);
  });
});

describe('ConfigRef (C-7: index é a identidade, name é só o último nome visto)', () => {
  it('ConfigRef válido é preservado com index E name', () => {
    const prefs = preferencesFromConfig({
      heroGridSource: { index: 0, name: 'Padrão' },
      heroGridMirror: { index: 3, name: 'GlimpseGG — Meta' },
    });
    expect(prefs.source).toEqual({ index: 0, name: 'Padrão' });
    expect(prefs.mirror).toEqual({ index: 3, name: 'GlimpseGG — Meta' });
  });

  it('ConfigRef malformado cai em null — sem index não se localiza layout nenhum', () => {
    expect(preferencesFromConfig({ heroGridSource: { name: 'só nome' } } as never).source).toBeNull();
    expect(preferencesFromConfig({ heroGridSource: { index: '2', name: 'x' } } as never).source).toBeNull();
    expect(preferencesFromConfig({ heroGridSource: { index: 1.5, name: 'x' } } as never).source).toBeNull();
    expect(preferencesFromConfig({ heroGridSource: { index: -1, name: 'x' } } as never).source).toBeNull();
    expect(preferencesFromConfig({ heroGridMirror: 'GlimpseGG' } as never).mirror).toBeNull();
    expect(preferencesFromConfig({ heroGridMirror: [] } as never).mirror).toBeNull();
    expect(preferencesFromConfig({ heroGridMirror: null }).mirror).toBeNull();
  });

  it('name ausente degrada para string vazia sem perder o rastro do índice', () => {
    expect(preferencesFromConfig({ heroGridSource: { index: 4 } } as never).source).toEqual({
      index: 4,
      name: '',
    });
  });
});

describe('clampSyncHistory (C-5: no máximo 20 registros)', () => {
  it('25 registros viram 20, e os que sobram são os mais recentes', () => {
    const history = Array.from({ length: 25 }, (_, i) => record(1000 + i));
    const clamped = clampSyncHistory(history);
    expect(clamped).toHaveLength(MAX_SYNC_HISTORY);
    expect(clamped[0].at).toBe(1005);
    expect(clamped[clamped.length - 1].at).toBe(1024);
  });

  it('3 registros continuam 3 e [] continua []', () => {
    expect(clampSyncHistory([record(1), record(2), record(3)])).toHaveLength(3);
    expect(clampSyncHistory([])).toEqual([]);
  });

  it('entrada não-array e registro malformado somem em vez de virar linha vazia', () => {
    expect(clampSyncHistory(undefined)).toEqual([]);
    expect(clampSyncHistory('nada')).toEqual([]);
    expect(clampSyncHistory([record(10), { outcome: 'SUCCESS' }, { at: 20 }, null])).toEqual([
      record(10),
    ]);
  });

  it('MAX_SYNC_HISTORY é 20, como o contrato manda', () => {
    expect(MAX_SYNC_HISTORY).toBe(20);
  });
});

describe('syncStateFromConfig', () => {
  it('config vazio devolve o estado zerado do contrato', () => {
    expect(syncStateFromConfig({})).toEqual({
      lastSuccessfulSyncAt: null,
      lastAttemptAt: null,
      consecutiveFailures: 0,
      history: [],
    });
  });

  it('undefined/null devolvem o estado zerado sem lançar', () => {
    expect(syncStateFromConfig(undefined)).toEqual(syncStateFromConfig({}));
    expect(syncStateFromConfig(null)).toEqual(syncStateFromConfig({}));
  });

  it('valores válidos são respeitados e o histórico é normalizado', () => {
    const state = syncStateFromConfig({
      heroGridLastSuccessfulSyncAt: 1_700_000_000_000,
      heroGridLastAttemptAt: 1_700_000_100_000,
      heroGridConsecutiveFailures: 2,
      heroGridSyncHistory: [record(1, { outcome: 'PARTIAL', sourcesFailed: ['STRATZ_BRACKET'] })],
    });
    expect(state.lastSuccessfulSyncAt).toBe(1_700_000_000_000);
    expect(state.lastAttemptAt).toBe(1_700_000_100_000);
    expect(state.consecutiveFailures).toBe(2);
    expect(state.history[0].outcome).toBe('PARTIAL');
    expect(state.history[0].sourcesFailed).toEqual(['STRATZ_BRACKET']);
  });

  it('timestamp inválido cai em null', () => {
    expect(syncStateFromConfig({ heroGridLastAttemptAt: 0 }).lastAttemptAt).toBeNull();
    expect(syncStateFromConfig({ heroGridLastAttemptAt: -5 }).lastAttemptAt).toBeNull();
    expect(syncStateFromConfig({ heroGridLastAttemptAt: 'ontem' } as never).lastAttemptAt).toBeNull();
    expect(syncStateFromConfig({ heroGridLastSuccessfulSyncAt: NaN }).lastSuccessfulSyncAt).toBeNull();
  });

  it('fonte inválida dentro do registro é filtrada, mantendo o registro', () => {
    const state = syncStateFromConfig({
      heroGridSyncHistory: [record(9, { sourcesUsed: ['D2PT', 'OPENDOTA_BRACKET'] as never })],
    });
    expect(state.history[0].sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
  });
});

describe('patch de escrita (só as chaves que mudaram, nunca undefined)', () => {
  it('grava apenas os campos presentes, mapeados para as chaves de AppConfig', () => {
    expect(preferencesPatch({ enabled: true })).toEqual({ heroGridEnabled: true });
    expect(preferencesPatch({ criterion: 'PERSONAL_ONLY', bracket: 'ALL' })).toEqual({
      heroGridCriterion: 'PERSONAL_ONLY',
      heroGridBracket: 'ALL',
    });
  });

  it('campo com undefined não é gravado; null é valor legítimo e é gravado', () => {
    expect(preferencesPatch({ enabled: undefined, mirror: null })).toEqual({
      heroGridMirror: null,
    });
    expect(preferencesPatch({})).toEqual({});
  });

  it('C-5 também na escrita: histórico de 25 é cortado para 20 antes de persistir', () => {
    const patch = syncStatePatch({
      history: Array.from({ length: 25 }, (_, i) => record(1000 + i)),
    });
    expect(patch.heroGridSyncHistory).toHaveLength(MAX_SYNC_HISTORY);
    expect(patch.heroGridSyncHistory[0].at).toBe(1005);
  });

  it('saveHeroGridPreferences não chama o IO quando não há nada para gravar', async () => {
    const { io, writes } = recordingIO();
    await saveHeroGridPreferences({}, io);
    expect(writes).toEqual([]);
    await saveHeroGridPreferences({ steamId3: '42' }, io);
    expect(writes).toEqual([{ heroGridSteamId3: '42' }]);
  });

  it('C-4: desativar grava só heroGridEnabled e PRESERVA heroGridMirror', async () => {
    const { io, writes } = recordingIO({
      heroGridEnabled: true,
      heroGridMirror: { index: 3, name: 'GlimpseGG' },
    });
    await disableHeroGrid(io);
    expect(writes).toEqual([{ heroGridEnabled: false }]);
    expect(writes[0]).not.toHaveProperty('heroGridMirror');
  });
});

describe('caminho browser (fake de storage injetado, sem DOM)', () => {
  it('storage vazio lê como os defaults — mesmo C-1 do caminho Electron', async () => {
    const prefs = await loadHeroGridPreferences(browserConfigIO(fakeStorage()));
    expect(prefs.enabled).toBe(false);
    expect(prefs.criterion).toBe('COMBINED');
  });

  it('ida e volta pelo storage preserva os valores', async () => {
    const storage = fakeStorage();
    const io = browserConfigIO(storage);
    await saveHeroGridPreferences(
      { enabled: true, criterion: 'META_ONLY', mirror: { index: 3, name: 'GlimpseGG' } },
      io
    );
    const prefs = await loadHeroGridPreferences(io);
    expect(prefs.enabled).toBe(true);
    expect(prefs.criterion).toBe('META_ONLY');
    expect(prefs.mirror).toEqual({ index: 3, name: 'GlimpseGG' });
    // As chaves do localStorage seguem o prefixo snake_case do projeto.
    expect(storage.data.has('hero_grid_enabled')).toBe(true);
    expect(storage.data.has('hero_grid_criterion')).toBe(true);
  });

  it('valor corrompido no storage é ignorado e o default vale', async () => {
    const io = browserConfigIO(fakeStorage({ hero_grid_enabled: '{{quebrado' }));
    expect((await loadHeroGridPreferences(io)).enabled).toBe(false);
  });
});
