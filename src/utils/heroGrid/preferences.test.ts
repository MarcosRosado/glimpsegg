import { describe, expect, it } from 'vitest';
import type {
  HeroGridGroupView,
  HeroScore,
  MirrorSnapshot,
  SyncRecord,
} from '../../types/heroGrid';
import {
  browserConfigIO,
  clampSyncHistory,
  disableHeroGrid,
  HERO_GRID_DEFAULTS,
  heroGridConfigKeys,
  loadHeroGridPreferences,
  loadMirrorSnapshot,
  MAX_SYNC_HISTORY,
  mirrorSnapshotFromConfig,
  preferencesFromConfig,
  preferencesPatch,
  saveHeroGridPreferences,
  saveMirrorSnapshot,
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

/* --- Fixtures do snapshot do espelho, na mesma linha do `record` acima --- */

function group(extra: Partial<HeroGridGroupView> = {}): HeroGridGroupView {
  return {
    categoryIndex: 0,
    categoryName: 'Carregadores',
    heroIds: [1, 8, 44],
    ordered: 3,
    withoutData: 0,
    xPosition: 12,
    // Geometria da Valve é float mesmo valendo inteiro; o fixture mistura os dois de
    // proposito para o round-trip nao passar so com inteiro.
    yPosition: 40.5,
    width: 300,
    height: 120.25,
    ...extra,
  };
}

function heroScore(extra: Partial<HeroScore> = {}): HeroScore {
  return {
    heroId: 8,
    score: 0.5412,
    breakdown: { metaComponent: 0.512, personalComponent: 0.601, personalWeight: 0.3 },
    criterion: 'COMBINED',
    ...extra,
  };
}

function snapshot(extra: Partial<MirrorSnapshot> = {}): MirrorSnapshot {
  return {
    at: 1_700_000_000_000,
    written: true,
    criterion: 'COMBINED',
    bracketIsPlayerSpecific: true,
    sourcesUsed: ['OPENDOTA_BRACKET'],
    sourcesMissing: ['STRATZ_BRACKET'],
    source: { index: 0, name: 'Meu layout' },
    mirror: { index: 4, name: 'Meu layout — GlimpseGG' },
    groups: [group(), group({ categoryIndex: 1, categoryName: 'Suportes', heroIds: [5, 26] })],
    scores: [heroScore()],
    ...extra,
  };
}

/** Açúcar: o snapshot vive sob uma chave só do config, e todo teste abaixo parte dela. */
function fromRaw(raw: unknown): MirrorSnapshot | null {
  return mirrorSnapshotFromConfig({ heroGridMirrorSnapshot: raw } as never);
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

describe('snapshot do espelho: a foto é tudo-ou-nada na estrutura', () => {
  it('snapshot completo atravessa a leitura sem perder nenhum campo', () => {
    expect(fromRaw(snapshot())).toEqual(snapshot());
  });

  it('C-1: config vazio, undefined e null devolvem null sem lançar', () => {
    expect(mirrorSnapshotFromConfig({})).toBeNull();
    expect(mirrorSnapshotFromConfig(undefined)).toBeNull();
    expect(mirrorSnapshotFromConfig(null)).toBeNull();
    expect(() => mirrorSnapshotFromConfig({})).not.toThrow();
  });

  it('valor que não é objeto de snapshot devolve null em vez de virar foto vazia', () => {
    expect(fromRaw(undefined)).toBeNull();
    expect(fromRaw(null)).toBeNull();
    expect(fromRaw('snapshot')).toBeNull();
    expect(fromRaw(42)).toBeNull();
    expect(fromRaw([])).toBeNull();
  });

  /**
   * A data é o que a tela exibe ao lado do layout. Sem ela a replica viraria "o espelho do
   * jogador, em algum momento", que é justamente a meia verdade que a doutrina proibe.
   */
  it('at ausente, zero, negativo ou NaN derruba o snapshot inteiro', () => {
    expect(fromRaw({ ...snapshot(), at: undefined })).toBeNull();
    expect(fromRaw({ ...snapshot(), at: 0 })).toBeNull();
    expect(fromRaw({ ...snapshot(), at: -1 })).toBeNull();
    expect(fromRaw({ ...snapshot(), at: NaN })).toBeNull();
    expect(fromRaw({ ...snapshot(), at: '1700000000000' })).toBeNull();
  });

  it('source ou mirror sem ConfigRef válida derruba o snapshot inteiro — sem índice não se localiza layout nenhum', () => {
    expect(fromRaw({ ...snapshot(), source: undefined })).toBeNull();
    expect(fromRaw({ ...snapshot(), source: { name: 'só nome' } })).toBeNull();
    expect(fromRaw({ ...snapshot(), source: { index: -1, name: 'x' } })).toBeNull();
    expect(fromRaw({ ...snapshot(), source: { index: 1.5, name: 'x' } })).toBeNull();
    expect(fromRaw({ ...snapshot(), mirror: null })).toBeNull();
    expect(fromRaw({ ...snapshot(), mirror: 'GlimpseGG' })).toBeNull();
    expect(fromRaw({ ...snapshot(), mirror: [] })).toBeNull();
  });

  it('groups que não é array derruba o snapshot inteiro', () => {
    expect(fromRaw({ ...snapshot(), groups: undefined })).toBeNull();
    expect(fromRaw({ ...snapshot(), groups: {} })).toBeNull();
    expect(fromRaw({ ...snapshot(), groups: 'nenhum' })).toBeNull();
  });

  /**
   * O oposto do de cima: `groups: []` é array e sobrevive. Layout sem grupo é estado
   * possivel no arquivo da Valve, e a replica desenha uma foto vazia — que é honesta —
   * em vez de sumir com a data e a procedencia que ela tambem exibe.
   */
  it('groups vazio é array válido e a foto sobrevive', () => {
    const read = fromRaw({ ...snapshot(), groups: [] });
    expect(read).not.toBeNull();
    expect(read.groups).toEqual([]);
  });

  /**
   * Um grupo sem geometria nao tem onde ser desenhado, e desenha-lo num lugar arbitrario
   * seria inventar o layout do jogador. Por isso derruba a FOTO INTEIRA, e nao so o grupo:
   * a replica com um grupo a menos pareceria o grid dele, sem nenhum sinal de que falta algo.
   */
  it('UM grupo com geometria não numérica derruba o snapshot inteiro, não só aquele grupo', () => {
    for (const broken of [
      group({ xPosition: undefined }),
      group({ yPosition: null as never }),
      group({ width: '300' as never }),
      group({ height: NaN }),
      group({ xPosition: Infinity }),
    ]) {
      expect(fromRaw({ ...snapshot(), groups: [group(), broken] })).toBeNull();
    }
  });

  it('categoryIndex inválido derruba o snapshot inteiro — a identidade do grupo é a POSIÇÃO (I-4a)', () => {
    for (const broken of [
      group({ categoryIndex: undefined }),
      group({ categoryIndex: -1 }),
      group({ categoryIndex: 0.5 }),
      group({ categoryIndex: '0' as never }),
    ]) {
      expect(fromRaw({ ...snapshot(), groups: [broken] })).toBeNull();
    }
    expect(fromRaw({ ...snapshot(), groups: [null] })).toBeNull();
    expect(fromRaw({ ...snapshot(), groups: ['Carregadores'] })).toBeNull();
  });

  it('categoryName ausente degrada para vazio (N-1: nome é rótulo) sem derrubar a foto', () => {
    const read = fromRaw({ ...snapshot(), groups: [group({ categoryName: undefined })] });
    expect(read.groups[0].categoryName).toBe('');
    expect(read.groups[0].categoryIndex).toBe(0);
  });

  it('heroId não inteiro é filtrado da ordem do grupo sem derrubar a foto', () => {
    const read = fromRaw({
      ...snapshot(),
      groups: [group({ heroIds: [1, '8', 2.5, null, 44] as never })],
    });
    expect(read.groups[0].heroIds).toEqual([1, 44]);
  });
});

describe('snapshot do espelho: a foto tem de descrever o DISCO, não uma intenção', () => {
  it('written diferente de true derruba a foto inteira', () => {
    // A foto só é gravada depois de os bytes chegarem ao disco. `written: false` no config é
    // corrupção ou edição manual — aceitá-la desenharia como "o seu layout" algo que o Dota
    // nunca recebeu, que é a única forma de a tela de réplica mentir.
    expect(fromRaw({ ...snapshot(), written: false })).toBeNull();
    expect(fromRaw({ ...snapshot(), written: undefined })).toBeNull();
    expect(fromRaw({ ...snapshot(), written: 'true' })).toBeNull();
    expect(fromRaw({ ...snapshot(), written: 1 })).toBeNull();
  });

  it('criterion inválido derruba a foto, não degrada para o default', () => {
    // O critério decide QUAL número cada herói exibe e ainda rotula o que produziu o
    // arquivo: cair em 'COMBINED' diria "Combinado" sobre uma ordem que pode ter saído de
    // outro critério. O resto da estrutura é tudo-ou-nada, e este também.
    expect(fromRaw({ ...snapshot(), criterion: 'FOO' })).toBeNull();
    expect(fromRaw({ ...snapshot(), criterion: undefined })).toBeNull();
    expect(fromRaw({ ...snapshot(), criterion: null })).toBeNull();
    // E o válido sobrevive sem tradução no caminho.
    expect(fromRaw({ ...snapshot(), criterion: 'PERSONAL_ONLY' })?.criterion).toBe(
      'PERSONAL_ONLY',
    );
  });
});

describe('snapshot do espelho: scores é a exceção deliberada (descarte individual)', () => {
  /**
   * Pode descartar nota porque quem desenha a replica é `groups[].heroIds`: o heroi cuja
   * nota se perdeu continua no grupo, rotulado "sem dado". Derrubar a foto aqui trocaria
   * uma degradacao honesta por tela vazia.
   */
  it('lista com 1 nota boa e 2 lixo devolve exatamente 1 nota, e o snapshot sobrevive', () => {
    const read = fromRaw({
      ...snapshot(),
      scores: [heroScore(), { heroId: 'x' }, null],
    });
    expect(read).not.toBeNull();
    expect(read.scores).toHaveLength(1);
    expect(read.scores[0]).toEqual(heroScore());
  });

  it('scores ausente ou não-array lê como lista vazia, nunca como snapshot null', () => {
    expect(fromRaw({ ...snapshot(), scores: undefined }).scores).toEqual([]);
    expect(fromRaw({ ...snapshot(), scores: 'nenhuma' }).scores).toEqual([]);
    expect(fromRaw({ ...snapshot(), scores: {} }).scores).toEqual([]);
    expect(fromRaw({ ...snapshot(), scores: undefined })).not.toBeNull();
  });

  it('FR-030b: nota sem breakdown, ou com personalWeight inválido, cai inteira', () => {
    const dropped = [
      heroScore({ breakdown: undefined }),
      heroScore({ breakdown: null as never }),
      heroScore({ breakdown: { metaComponent: 0.5, personalComponent: 0.6 } as never }),
      heroScore({ breakdown: { personalWeight: 1.4 } as never }),
      heroScore({ breakdown: { personalWeight: -0.1 } as never }),
      heroScore({ breakdown: { personalWeight: '0.3' } as never }),
    ];
    for (const bad of dropped) {
      const read = fromRaw({ ...snapshot(), scores: [bad] });
      expect(read).not.toBeNull();
      expect(read.scores).toEqual([]);
    }
  });

  it('nota sem heroId inteiro cai, mas as outras notas da lista continuam', () => {
    const read = fromRaw({
      ...snapshot(),
      scores: [heroScore({ heroId: undefined }), heroScore({ heroId: 26 })],
    });
    expect(read.scores.map((s) => s.heroId)).toEqual([26]);
  });

  it('score fora de 0..1 degrada para null (sem dado) sem derrubar a nota', () => {
    expect(fromRaw({ ...snapshot(), scores: [heroScore({ score: 58.2 })] }).scores[0].score).toBeNull();
    expect(fromRaw({ ...snapshot(), scores: [heroScore({ score: null })] }).scores[0].score).toBeNull();
  });

  it('criterion inválido na nota cai no default COMBINED em vez de propagar lixo', () => {
    const read = fromRaw({ ...snapshot(), scores: [heroScore({ criterion: 'D2PT' as never })] });
    expect(read.scores[0].criterion).toBe('COMBINED');
  });

  it('noDataReason válido sobrevive; inválido simplesmente não aparece', () => {
    expect(
      fromRaw({ ...snapshot(), scores: [heroScore({ noDataReason: 'NO_META' })] }).scores[0]
        .noDataReason
    ).toBe('NO_META');
    expect(
      fromRaw({ ...snapshot(), scores: [heroScore({ noDataReason: 'SEM_MOTIVO' as never })] })
        .scores[0]
    ).not.toHaveProperty('noDataReason');
  });
});

describe('snapshot do espelho: FR-014 — winrate, fonte e amostra andam juntos', () => {
  const meta = {
    heroId: 8,
    source: 'OPENDOTA_BRACKET' as const,
    winRate: 0.523,
    wins: 5230,
    matchCount: 10000,
    bracket: 'LEGEND_ANCIENT' as const,
    bracketIsPlayerSpecific: true,
    patch: '7.39c',
  };

  it('meta completo atravessa com fonte, amostra e ranque intactos', () => {
    const read = fromRaw({ ...snapshot(), scores: [heroScore({ meta })] });
    expect(read.scores[0].meta).toEqual(meta);
  });

  /**
   * O ponto de FR-014: o numero pelado nao pode chegar a tela. Meia procedencia sai do
   * caminho inteiro — a nota continua (ela tem `breakdown`), mas SEM `meta`, e a UI mostra
   * a nota sem winrate em vez de um winrate sem fonte.
   */
  it('meta sem source derruba o meta, e a nota sobrevive sem ele — nunca com meta pela metade', () => {
    const read = fromRaw({
      ...snapshot(),
      scores: [heroScore({ meta: { ...meta, source: undefined } as never })],
    });
    expect(read).not.toBeNull();
    expect(read.scores).toHaveLength(1);
    expect(read.scores[0]).not.toHaveProperty('meta');
    expect(read.scores[0].score).toBe(0.5412);
  });

  it('meta sem amostra, sem winrate na faixa ou sem ranque válido também não sobrevive', () => {
    for (const bad of [
      { ...meta, matchCount: undefined },
      { ...meta, matchCount: -1 },
      { ...meta, matchCount: 10.5 },
      { ...meta, winRate: 52.3 },
      { ...meta, winRate: undefined },
      { ...meta, bracket: 'IMMORTAL_ONLY' },
      { ...meta, source: 'D2PT' },
      { ...meta, heroId: undefined },
    ]) {
      const read = fromRaw({ ...snapshot(), scores: [heroScore({ meta: bad as never })] });
      expect(read.scores[0]).not.toHaveProperty('meta');
    }
  });

  it('I-13: bracketIsPlayerSpecific ausente lê como false — na dúvida a tela diz "média geral"', () => {
    const read = fromRaw({
      ...snapshot(),
      scores: [heroScore({ meta: { ...meta, bracketIsPlayerSpecific: undefined } as never })],
    });
    expect(read.scores[0].meta.bracketIsPlayerSpecific).toBe(false);
    expect(fromRaw({ ...snapshot(), bracketIsPlayerSpecific: undefined }).bracketIsPlayerSpecific).toBe(
      false
    );
  });

  it('personal inválido some sem derrubar a nota; válido atravessa com a amostra', () => {
    const personal = { heroId: 8, games: 40, wins: 24, winRate: 0.6 };
    expect(fromRaw({ ...snapshot(), scores: [heroScore({ personal })] }).scores[0].personal).toEqual(
      personal
    );
    for (const bad of [
      { ...personal, games: undefined },
      { ...personal, games: -2 },
      { ...personal, winRate: 60 },
      { ...personal, heroId: '8' },
    ]) {
      const read = fromRaw({ ...snapshot(), scores: [heroScore({ personal: bad as never })] });
      expect(read.scores).toHaveLength(1);
      expect(read.scores[0]).not.toHaveProperty('personal');
    }
  });

  it('fonte desconhecida em sourcesUsed/sourcesMissing é filtrada sem derrubar a foto', () => {
    const read = fromRaw({
      ...snapshot(),
      sourcesUsed: ['D2PT', 'OPENDOTA_BRACKET', 'OPENDOTA_BRACKET'],
      sourcesMissing: 'nenhuma',
    });
    expect(read.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(read.sourcesMissing).toEqual([]);
  });
});

describe('snapshot do espelho: amostra zero não é amostra', () => {
  it('meta com matchCount 0 não sobrevive, e a nota fica sem meta', () => {
    // "52,3% · OpenDota · 0 partidas" é número sem lastro. Simétrico ao lado pessoal, que
    // exige `games > 0` para exibir. A nota em si sobrevive: ela tem `breakdown`.
    const read = fromRaw({
      ...snapshot(),
      scores: [
        heroScore({
          meta: {
            heroId: 8,
            source: 'OPENDOTA_BRACKET',
            winRate: 0.523,
            wins: 0,
            matchCount: 0,
            bracket: 'ALL',
            bracketIsPlayerSpecific: false,
            patch: '7.39',
          },
        }),
      ],
    });
    expect(read).not.toBeNull();
    expect(read?.scores).toHaveLength(1);
    expect(read?.scores[0].meta).toBeUndefined();
  });
});

describe('persistência do snapshot nos dois caminhos de IO', () => {
  it('ida e volta pelo caminho de config (Electron) devolve a foto idêntica', async () => {
    const { io, writes } = recordingIO();
    await saveMirrorSnapshot(snapshot(), io);
    expect(writes).toHaveLength(1);
    // O que voltou do "disco" é exatamente o patch gravado.
    const reread = recordingIO(writes[0]);
    expect(await loadMirrorSnapshot(reread.io)).toEqual(snapshot());
  });

  it('ida e volta pelo storage do browser devolve a foto idêntica, serializada em JSON', async () => {
    const storage = fakeStorage();
    const io = browserConfigIO(storage);
    await saveMirrorSnapshot(snapshot(), io);
    expect(storage.data.get('hero_grid_mirror_snapshot')).toBe(JSON.stringify(snapshot()));
    expect(await loadMirrorSnapshot(io)).toEqual(snapshot());
  });

  it('storage vazio lê null — mesmo C-1 das preferências', async () => {
    expect(await loadMirrorSnapshot(browserConfigIO(fakeStorage()))).toBeNull();
  });

  it('valor corrompido no storage lê null em vez de derrubar a aba', async () => {
    const io = browserConfigIO(fakeStorage({ hero_grid_mirror_snapshot: '{{quebrado' }));
    expect(await loadMirrorSnapshot(io)).toBeNull();
  });

  /**
   * Diferente de `saveHeroGridPreferences`, que ignora campo ausente: aqui `null` é uma
   * ORDEM DE APAGAR. Espelho removido da colecao com a foto antiga no config faria a tela
   * seguir mostrando um layout que nao existe mais no jogo.
   */
  it('saveMirrorSnapshot(null) grava a chave com null de propósito, em vez de não gravar nada', async () => {
    const { io, writes } = recordingIO();
    await saveMirrorSnapshot(null, io);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveProperty('heroGridMirrorSnapshot');
    expect(writes[0].heroGridMirrorSnapshot).toBeNull();
    expect(Object.keys(writes[0])).toEqual(['heroGridMirrorSnapshot']);
  });

  it('apagar pelo storage do browser volta como null, e não como a string "null"', async () => {
    const storage = fakeStorage();
    const io = browserConfigIO(storage);
    await saveMirrorSnapshot(snapshot(), io);
    await saveMirrorSnapshot(null, io);
    expect(storage.data.get('hero_grid_mirror_snapshot')).toBe('null');
    expect(await loadMirrorSnapshot(io)).toBeNull();
  });

  it('gravar o snapshot não toca em nenhuma outra chave da feature', async () => {
    const storage = fakeStorage();
    const io = browserConfigIO(storage);
    await saveHeroGridPreferences({ enabled: true, mirror: { index: 3, name: 'GlimpseGG' } }, io);
    await saveMirrorSnapshot(snapshot(), io);
    const prefs = await loadHeroGridPreferences(io);
    expect(prefs.enabled).toBe(true);
    expect(prefs.mirror).toEqual({ index: 3, name: 'GlimpseGG' });
  });

  /**
   * Mesma razao de C-4 para `heroGridMirror`: o espelho continua na colecao do jogador
   * depois de desmarcar a feature, e a foto é o que a tela usa para mostra-lo.
   */
  it('C-4: disableHeroGrid não apaga o snapshot — grava só heroGridEnabled', async () => {
    const { io, writes } = recordingIO({
      heroGridEnabled: true,
      heroGridMirrorSnapshot: snapshot(),
    });
    await disableHeroGrid(io);
    expect(writes).toEqual([{ heroGridEnabled: false }]);
    expect(writes[0]).not.toHaveProperty('heroGridMirrorSnapshot');
    // E o que estava no config continua legivel depois.
    expect(await loadMirrorSnapshot(io)).toEqual(snapshot());
  });
});

describe('chaves de config: heroGridConfigKeys e as chaves do localStorage andam juntas', () => {
  it('heroGridMirrorSnapshot está na lista de chaves da feature', () => {
    expect(heroGridConfigKeys).toContain('heroGridMirrorSnapshot');
  });

  /**
   * `LOCAL_STORAGE_KEYS` é privado, entao a consistencia é verificada pelo comportamento:
   * escrever TODAS as chaves da feature tem de produzir uma chave de storage distinta para
   * cada uma (nenhuma sobrescrevendo outra) e todas tem de voltar na leitura. Chave nova
   * sem entrada no mapa gravaria em `undefined` e sumiria aqui.
   */
  it('cada chave da feature tem uma chave de storage própria, prefixada e distinta', async () => {
    const storage = fakeStorage();
    const io = browserConfigIO(storage);
    const patch: Record<string, unknown> = {};
    for (const key of heroGridConfigKeys) patch[key] = key;
    await io.write(patch as never);

    expect(storage.data.size).toBe(heroGridConfigKeys.length);
    for (const storageKey of storage.data.keys()) {
      expect(storageKey.startsWith('hero_grid_')).toBe(true);
    }
    expect(await io.read()).toEqual(patch);
  });
});
