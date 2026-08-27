import type { AppConfig } from '../../types/electron';
import type {
  ConfigRef,
  HeroGridGroupView,
  HeroGridPreferences,
  HeroScore,
  HeroScoreBreakdown,
  MetaSource,
  MetaWinrate,
  MirrorSnapshot,
  NoDataReason,
  PersonalWinrate,
  RankingCriterion,
  SyncOutcome,
  SyncRecord,
  SyncState,
} from '../../types/heroGrid';
import type { RankBracketBasic } from '../rankBracket';

/**
 * Preferencias e estado de sincronizacao da feature de layout espelho de herois
 * (specs/001-meta-hero-grid, contracts/config-keys.md).
 *
 * Este modulo NAO faz rede e NAO lê arquivo de grid — só config. Ele existe separado
 * porque a leitura é a parte que sustenta C-1 e precisa ser testavel sem I/O: as funcoes
 * puras (`preferencesFromConfig`, `syncStateFromConfig`, `clampSyncHistory`) recebem um
 * objeto plano e devolvem o modelo completo; as funcoes assincronas só escolhem de onde
 * vem esse objeto plano.
 *
 * ## C-1 — chave ausente lê como o default
 *
 * É o mecanismo de FR-001, e nao uma conveniencia: quem atualiza de uma versao anterior
 * do app nao tem NENHUMA das chaves `heroGrid*` no `stratz_app_config.json`, logo lê
 * `enabled: false` e a feature nasce desligada. Por isso `loadConfig()` do `main.cjs` nao
 * lista as chaves novas (C-2) — o default mora só aqui, e nao pode divergir em dois
 * lugares. Pela mesma razao, valor de tipo inesperado (string onde se espera boolean,
 * `criterion: 'FOO'`, `index` nao-numerico) também cai no default em vez de propagar
 * lixo: config editado a mao ou escrito por versao futura nao pode derrubar a leitura.
 *
 * ## C-4 — desmarcar `enabled` PRESERVA `heroGridMirror`
 *
 * `disableHeroGrid()` grava só `heroGridEnabled: false`. Limpar `heroGridMirror` ali
 * tornaria a remocao do espelho impossivel: sem a referencia (index + ultimo nome) o app
 * nao sabe mais qual config do arquivo da Valve é o espelho dele, e o layout gerado
 * ficaria orfao no jogo para sempre. Nenhuma funcao de desativacao deste modulo escreve
 * `heroGridMirror`.
 */

/* ------------------------------------------------------------------ *
 * 1. Chaves
 * ------------------------------------------------------------------ */

/**
 * As chaves de `AppConfig` que esta feature possui, como literais.
 *
 * Sem concatenacao em runtime em nenhum lugar do modulo (mesma disciplina das chaves de
 * i18n): nome de chave montado por template escapa de qualquer busca textual, e é assim
 * que uma chave renomeada vira leitura silenciosa de `undefined`.
 */
export const heroGridConfigKeys = [
  'heroGridEnabled',
  'heroGridSteamId3',
  'heroGridFilePath',
  'heroGridSource',
  'heroGridMirror',
  'heroGridMirrorName',
  'heroGridCriterion',
  'heroGridBracket',
  'heroGridLastSuccessfulSyncAt',
  'heroGridLastAttemptAt',
  'heroGridConsecutiveFailures',
  'heroGridSyncHistory',
  'heroGridMirrorSnapshot',
] as const;

export type HeroGridConfigKey = (typeof heroGridConfigKeys)[number];

/**
 * Caminho browser (`npm run dev`, `window.api === undefined`).
 *
 * Prefixo escolhido: `hero_grid_`, snake_case, seguindo as chaves que o projeto já tem no
 * `localStorage` (`stratz_api_key`, `stratz_steam_id`, `app_language`) — prefixo por
 * dominio + nome em snake_case. Nao se usa a chave de `AppConfig` direto para o
 * `localStorage` nao ficar com camelCase misturado ao que já existe.
 *
 * Tabela de literais, um `Record` fechado em `HeroGridConfigKey`: chave nova sem entrada
 * aqui quebra o `tsc -b`, que é o unico gate disponivel com `strict: false`.
 */
const LOCAL_STORAGE_KEYS: Record<HeroGridConfigKey, string> = {
  heroGridEnabled: 'hero_grid_enabled',
  heroGridSteamId3: 'hero_grid_steam_id3',
  heroGridFilePath: 'hero_grid_file_path',
  heroGridSource: 'hero_grid_source',
  heroGridMirror: 'hero_grid_mirror',
  heroGridMirrorName: 'hero_grid_mirror_name',
  heroGridCriterion: 'hero_grid_criterion',
  heroGridBracket: 'hero_grid_bracket',
  heroGridLastSuccessfulSyncAt: 'hero_grid_last_successful_sync_at',
  heroGridLastAttemptAt: 'hero_grid_last_attempt_at',
  heroGridConsecutiveFailures: 'hero_grid_consecutive_failures',
  heroGridSyncHistory: 'hero_grid_sync_history',
  heroGridMirrorSnapshot: 'hero_grid_mirror_snapshot',
};

/** Campo de `HeroGridPreferences` -> chave de `AppConfig`. Literais, os dois lados. */
const PREFERENCE_KEYS: Record<keyof HeroGridPreferences, HeroGridConfigKey> = {
  enabled: 'heroGridEnabled',
  steamId3: 'heroGridSteamId3',
  gridFilePath: 'heroGridFilePath',
  source: 'heroGridSource',
  mirror: 'heroGridMirror',
  mirrorName: 'heroGridMirrorName',
  criterion: 'heroGridCriterion',
  bracket: 'heroGridBracket',
};

/** Campo de `SyncState` -> chave de `AppConfig`. */
const SYNC_STATE_KEYS: Record<keyof SyncState, HeroGridConfigKey> = {
  lastSuccessfulSyncAt: 'heroGridLastSuccessfulSyncAt',
  lastAttemptAt: 'heroGridLastAttemptAt',
  consecutiveFailures: 'heroGridConsecutiveFailures',
  history: 'heroGridSyncHistory',
};

/* ------------------------------------------------------------------ *
 * 2. Defaults
 * ------------------------------------------------------------------ */

/**
 * Defaults da tabela de `contracts/config-keys.md`. Congelado: default mutado em runtime
 * viraria um bug que só aparece na segunda leitura.
 *
 * Os dois com requisito nomeado: `enabled: false` (FR-001) e `criterion: 'COMBINED'`
 * (FR-030). `bracket: null` significa "derivar do perfil" — e o `null` é o que faz a UI
 * cair no rotulo de "media geral" quando a derivacao termina em 'ALL'.
 */
export const HERO_GRID_DEFAULTS: Readonly<HeroGridPreferences> = Object.freeze({
  enabled: false,
  steamId3: null,
  gridFilePath: null,
  source: null,
  mirror: null,
  mirrorName: null,
  criterion: 'COMBINED' as RankingCriterion,
  bracket: null,
});

/** Defaults do estado de sincronizacao. `history` sai congelada e vazia. */
export const SYNC_STATE_DEFAULTS: Readonly<SyncState> = Object.freeze({
  lastSuccessfulSyncAt: null,
  lastAttemptAt: null,
  consecutiveFailures: 0,
  history: Object.freeze([]) as SyncRecord[],
});

/** C-5 (FR-036): o historico guarda no maximo 20 registros. */
export const MAX_SYNC_HISTORY = 20;

const VALID_CRITERIA: readonly RankingCriterion[] = ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'];

const VALID_BRACKETS: readonly RankBracketBasic[] = [
  'UNCALIBRATED',
  'HERALD_GUARDIAN',
  'CRUSADER_ARCHON',
  'LEGEND_ANCIENT',
  'DIVINE_IMMORTAL',
  'ALL',
];

const VALID_OUTCOMES: readonly SyncOutcome[] = ['SUCCESS', 'PARTIAL', 'FAILURE'];

const VALID_META_SOURCES: readonly MetaSource[] = ['OPENDOTA_BRACKET', 'STRATZ_BRACKET'];

const VALID_NO_DATA_REASONS: readonly NoDataReason[] = [
  'NO_META',
  'NO_PERSONAL_IN_PERSONAL_ONLY',
  'HERO_UNKNOWN',
];

/* ------------------------------------------------------------------ *
 * 3. Coercao: valor invalido cai no default, nunca propaga
 * ------------------------------------------------------------------ */

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * String vazia conta como ausente: caminho de arquivo `''` e steamId3 `''` sao lixo de
 * campo de formulario limpo, e tratar como `null` evita a UI achar que há valor.
 */
function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Timestamp epoch ms. `0`, negativo e `NaN` nao sao instante valido aqui. */
function asTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Contador de falhas: inteiro >= 0. Negativo (`-3`) e fracionario caem no default. */
function asCounter(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

function asEnum<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  return typeof value === 'string' && (valid as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asEnumOrNull<T extends string>(value: unknown, valid: readonly T[]): T | null {
  return typeof value === 'string' && (valid as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * C-7: `index` é a identidade, `name` é só o ultimo nome visto.
 *
 * Por isso `index` ausente ou nao-numerico invalida a referencia inteira (devolve `null`):
 * uma `ConfigRef` sem posicao nao localiza nada, e o app NUNCA procura layout por nome.
 * `name` faltando, ao contrario, é degradacao aceitavel — vira `''` e a UI mostra o
 * rotulo generico, sem perder o rastro do layout.
 */
function asConfigRef(value: unknown): ConfigRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as { index?: unknown; name?: unknown };
  if (typeof candidate.index !== 'number' || !Number.isInteger(candidate.index)) return null;
  if (candidate.index < 0) return null;
  return {
    index: candidate.index,
    name: typeof candidate.name === 'string' ? candidate.name : '',
  };
}

function asMetaSources(value: unknown): MetaSource[] {
  if (!Array.isArray(value)) return [];
  const out: MetaSource[] = [];
  for (const item of value) {
    const source = asEnumOrNull(item, VALID_META_SOURCES);
    if (source && !out.includes(source)) out.push(source);
  }
  return out;
}

/**
 * Registro sem `at` ou sem `outcome` valido é descartado (devolve `null`): o historico é
 * exibido como linha do tempo, e registro sem instante nem desfecho nao tem o que exibir.
 * Os demais campos degradam para valor neutro.
 */
function asSyncRecord(value: unknown): SyncRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<SyncRecord>;
  const at = asTimestamp(candidate.at);
  if (at === null) return null;
  const outcome = asEnumOrNull(candidate.outcome, VALID_OUTCOMES);
  if (!outcome) return null;

  const record: SyncRecord = {
    at,
    outcome,
    sourcesUsed: asMetaSources(candidate.sourcesUsed),
    sourcesFailed: asMetaSources(candidate.sourcesFailed),
    heroesOrdered: asCounter(candidate.heroesOrdered, 0),
    structureChanged: asBoolean(candidate.structureChanged, false),
  };
  // S-2: só mensagem, e só se for mensagem — nunca objeto de erro cru, que pode carregar
  // header com token na serializacao.
  if (typeof candidate.error === 'string' && candidate.error.length > 0) {
    record.error = candidate.error;
  }
  return record;
}

/** Razao 0..1. Fora da faixa é lixo, e lixo aqui viraria "58200%" na tela. */
function asRatio(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function asGeometry(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asHeroIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (Number.isInteger(item)) out.push(item as number);
  }
  return out;
}

/**
 * Um grupo do espelho persistido.
 *
 * Devolve `null` — e derruba o snapshot inteiro, ver `asMirrorSnapshot` — quando a
 * geometria nao é numero. Grupo sem posicao nao tem onde ser desenhado, e desenha-lo num
 * lugar arbitrario seria inventar o layout do jogador, que é justamente o que a feature
 * promete nao fazer.
 */
function asGroupView(value: unknown): HeroGridGroupView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<HeroGridGroupView>;
  if (!Number.isInteger(candidate.categoryIndex) || (candidate.categoryIndex as number) < 0) {
    return null;
  }
  const xPosition = asGeometry(candidate.xPosition);
  const yPosition = asGeometry(candidate.yPosition);
  const width = asGeometry(candidate.width);
  const height = asGeometry(candidate.height);
  if (xPosition === null || yPosition === null || width === null || height === null) return null;

  return {
    categoryIndex: candidate.categoryIndex as number,
    // Nome é rotulo (N-1): ausente degrada para vazio, nao invalida o grupo.
    categoryName: typeof candidate.categoryName === 'string' ? candidate.categoryName : '',
    heroIds: asHeroIds(candidate.heroIds),
    ordered: asCounter(candidate.ordered, 0),
    withoutData: asCounter(candidate.withoutData, 0),
    xPosition,
    yPosition,
    width,
    height,
  };
}

function asBreakdown(value: unknown): HeroScoreBreakdown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<HeroScoreBreakdown>;
  const personalWeight = asRatio(candidate.personalWeight);
  // FR-030b: sem `personalWeight` a nota nao é exibivel. Sem decomposicao nao há
  // `HeroScore` legitimo, entao o par inteiro cai.
  if (personalWeight === null) return null;
  return {
    metaComponent: asRatio(candidate.metaComponent),
    personalComponent: asRatio(candidate.personalComponent),
    personalWeight,
  };
}

function asMetaWinrate(value: unknown): MetaWinrate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<MetaWinrate>;
  if (!Number.isInteger(candidate.heroId)) return null;
  const source = asEnumOrNull(candidate.source, VALID_META_SOURCES);
  const winRate = asRatio(candidate.winRate);
  const bracket = asEnumOrNull(candidate.bracket, VALID_BRACKETS);
  // I-11/I-12: winrate sem fonte, sem amostra ou sem ranque nao pode ser exibido, e exibir
  // o numero pelado é exatamente o que FR-014 proibe. Sem os tres, nao há meta.
  if (!source || winRate === null || !bracket) return null;
  // Amostra ZERO nao é amostra: "52,3% · OpenDota · 0 partidas" é numero sem lastro, e
  // FR-014 pede winrate, fonte e amostra juntos. Simetrico ao lado pessoal, que exige
  // `games > 0` para exibir.
  if (!Number.isInteger(candidate.matchCount) || (candidate.matchCount as number) <= 0) return null;

  return {
    heroId: candidate.heroId as number,
    source,
    winRate,
    wins: asCounter(candidate.wins, 0),
    matchCount: candidate.matchCount as number,
    bracket,
    bracketIsPlayerSpecific: asBoolean(candidate.bracketIsPlayerSpecific, false),
    patch: typeof candidate.patch === 'string' ? candidate.patch : '',
  };
}

function asPersonalWinrate(value: unknown): PersonalWinrate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PersonalWinrate>;
  if (!Number.isInteger(candidate.heroId)) return null;
  const winRate = asRatio(candidate.winRate);
  if (winRate === null) return null;
  if (!Number.isInteger(candidate.games) || (candidate.games as number) < 0) return null;
  return {
    heroId: candidate.heroId as number,
    games: candidate.games as number,
    wins: asCounter(candidate.wins, 0),
    winRate,
  };
}

/**
 * Uma nota persistida. Entrada malformada é DESCARTADA, nao derruba o snapshot.
 *
 * É seguro descartar porque quem renderiza a replica é `groups[].heroIds`, e nao esta
 * lista: heroi cuja nota se perdeu continua aparecendo no grupo, marcado como "sem dado".
 * Isso degrada para o rotulo honesto em vez de sumir com o heroi da tela.
 */
function asHeroScore(value: unknown): HeroScore | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<HeroScore>;
  if (!Number.isInteger(candidate.heroId)) return null;
  const breakdown = asBreakdown(candidate.breakdown);
  if (!breakdown) return null;

  const entry: HeroScore = {
    heroId: candidate.heroId as number,
    score: asRatio(candidate.score),
    breakdown,
    criterion: asEnum(candidate.criterion, VALID_CRITERIA, HERO_GRID_DEFAULTS.criterion),
  };
  const meta = asMetaWinrate(candidate.meta);
  if (meta) entry.meta = meta;
  const personal = asPersonalWinrate(candidate.personal);
  if (personal) entry.personal = personal;
  const reason = asEnumOrNull(candidate.noDataReason, VALID_NO_DATA_REASONS);
  if (reason) entry.noDataReason = reason;
  return entry;
}

/* ------------------------------------------------------------------ *
 * 4. Leitura pura
 * ------------------------------------------------------------------ */

/**
 * C-5: mantem os 20 registros MAIS RECENTES, descartando os mais antigos.
 *
 * O historico é gravado em ordem cronologica crescente (o novo entra no fim), então o
 * corte é a cauda — `slice(-MAX)`. Entrada nao-array, ou registro malformado dentro dela,
 * some em vez de virar linha vazia na UI.
 */
export function clampSyncHistory(history: unknown): SyncRecord[] {
  if (!Array.isArray(history)) return [];
  const valid: SyncRecord[] = [];
  for (const item of history) {
    const record = asSyncRecord(item);
    if (record) valid.push(record);
  }
  return valid.length > MAX_SYNC_HISTORY ? valid.slice(-MAX_SYNC_HISTORY) : valid;
}

/**
 * O coracao de C-1: config plano -> `HeroGridPreferences` completo.
 *
 * Pura de proposito — é o que permite testar "usuario atualizou de uma versao anterior"
 * com `{}`, sem mock de IPC nem de `localStorage`. `undefined`/`null` e chave desconhecida
 * no objeto nao lancam: o que nao é reconhecido simplesmente nao participa da leitura.
 */
export function preferencesFromConfig(raw?: Partial<AppConfig> | null): HeroGridPreferences {
  const config = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    enabled: asBoolean(config.heroGridEnabled, HERO_GRID_DEFAULTS.enabled),
    steamId3: asNullableString(config.heroGridSteamId3),
    gridFilePath: asNullableString(config.heroGridFilePath),
    source: asConfigRef(config.heroGridSource),
    mirror: asConfigRef(config.heroGridMirror),
    // C-8: nome desejado. Vazio/whitespace lê como `null` para cair no default de N-5, em
    // vez de o espelho nascer com nome em branco no jogo.
    mirrorName: asNullableString(config.heroGridMirrorName),
    criterion: asEnum(config.heroGridCriterion, VALID_CRITERIA, HERO_GRID_DEFAULTS.criterion),
    bracket: asEnumOrNull(config.heroGridBracket, VALID_BRACKETS),
  };
}

/** Mesma disciplina de `preferencesFromConfig`, para o estado do agendador. */
export function syncStateFromConfig(raw?: Partial<AppConfig> | null): SyncState {
  const config = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    lastSuccessfulSyncAt: asTimestamp(config.heroGridLastSuccessfulSyncAt),
    lastAttemptAt: asTimestamp(config.heroGridLastAttemptAt),
    consecutiveFailures: asCounter(
      config.heroGridConsecutiveFailures,
      SYNC_STATE_DEFAULTS.consecutiveFailures
    ),
    history: clampSyncHistory(config.heroGridSyncHistory),
  };
}

/**
 * O espelho gravado, ou `null`.
 *
 * "Ou `null`" é o ponto: `preferencesFromConfig` degrada campo a campo porque preferencia
 * incompleta ainda é utilizavel, mas snapshot é uma FOTO — meia foto do layout do jogador
 * é pior que nenhuma, porque a tela a desenharia como se fosse o grid dele. Entao qualquer
 * peca estrutural ausente (instante, origem, espelho, um grupo sem geometria) devolve
 * `null` inteiro, e a tela cai no estado vazio, que é honesto. Valem como peca estrutural,
 * alem do obvio: `written !== true` (a foto promete descrever o disco) e `criterion`
 * invalido (é ele que decide qual numero cada heroi exibe).
 *
 * A excecao deliberada é `scores`: nota malformada é descartada individualmente, porque
 * quem desenha é `groups[].heroIds` e o heroi sobrevive rotulado como "sem dado".
 */
export function mirrorSnapshotFromConfig(raw?: Partial<AppConfig> | null): MirrorSnapshot | null {
  const config = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const value = config.heroGridMirrorSnapshot;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<MirrorSnapshot>;
  const at = asTimestamp(candidate.at);
  if (at === null) return null;

  // A foto só é gravada depois de os bytes chegarem ao disco, entao `written !== true` é
  // config corrompido ou editado a mao. Aceitar seria desenhar como "o seu layout" algo
  // que nunca foi escrito — o campo promete a invariante, e é aqui que ela é cobrada.
  if (candidate.written !== true) return null;

  // O criterio decide QUAL numero cada tile exibe e ainda aparece rotulando o que produziu
  // o arquivo. Degrada-lo para o default diria "Combinado" sobre uma ordem que pode ter
  // saido de outro criterio — o resto da estrutura derruba a foto inteira, e este tambem.
  const criterion = asEnumOrNull(candidate.criterion, VALID_CRITERIA);
  if (!criterion) return null;

  const source = asConfigRef(candidate.source);
  const mirror = asConfigRef(candidate.mirror);
  if (!source || !mirror) return null;

  if (!Array.isArray(candidate.groups)) return null;
  const groups: HeroGridGroupView[] = [];
  for (const item of candidate.groups) {
    const group = asGroupView(item);
    if (!group) return null;
    groups.push(group);
  }

  const scores: HeroScore[] = [];
  if (Array.isArray(candidate.scores)) {
    for (const item of candidate.scores) {
      const score = asHeroScore(item);
      if (score) scores.push(score);
    }
  }

  return {
    at,
    written: true,
    criterion,
    // I-13: ausente lê como `false`, que é a direcao segura — a tela diz "media geral".
    bracketIsPlayerSpecific: asBoolean(candidate.bracketIsPlayerSpecific, false),
    sourcesUsed: asMetaSources(candidate.sourcesUsed),
    sourcesMissing: asMetaSources(candidate.sourcesMissing),
    source,
    mirror,
    groups,
    scores,
  };
}

/* ------------------------------------------------------------------ *
 * 5. I/O: os dois caminhos de config
 * ------------------------------------------------------------------ */

/** O minimo de `localStorage` que o caminho browser usa. Permite fake em teste node. */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

/**
 * A ponte de config, abstraida para o teste poder injetar.
 *
 * `read` devolve um `Partial<AppConfig>` plano — o mesmo formato que as funcoes puras
 * acima consomem, o que mantem toda a decisao fora do I/O.
 */
export interface HeroGridConfigIO {
  read: () => Promise<Partial<AppConfig>>;
  write: (patch: Partial<AppConfig>) => Promise<void>;
}

/** Electron: um `getAll()` em vez de 11 `get()` — é um IPC, nao onze. */
export function electronConfigIO(api: NonNullable<Window['api']>): HeroGridConfigIO {
  return {
    read: async () => {
      try {
        const all = await api.store.getAll();
        return (all || {}) as Partial<AppConfig>;
      } catch {
        // Config ilegivel lê como config vazio, e config vazio é a feature desligada
        // (C-1). Falhar aqui deixaria o app sem tela de configuracao.
        return {};
      }
    },
    write: async (patch) => {
      for (const key of Object.keys(patch) as HeroGridConfigKey[]) {
        await api.store.set(key, patch[key]);
      }
    },
  };
}

/**
 * Browser (`npm run dev`): tudo em JSON, inclusive string.
 *
 * Uniformizar a serializacao é o que faz `null` voltar como `null` e nao como a string
 * `"null"` — e é o mesmo dos dois lados da leitura, então nao há formato para divergir.
 */
export function browserConfigIO(storage: StorageLike): HeroGridConfigIO {
  return {
    read: async () => {
      const out: Record<string, unknown> = {};
      for (const key of heroGridConfigKeys) {
        try {
          const raw = storage.getItem(LOCAL_STORAGE_KEYS[key]);
          if (raw === null || raw === undefined) continue;
          out[key] = JSON.parse(raw);
        } catch {
          // Valor corrompido no localStorage: ignora a chave e deixa o default valer.
        }
      }
      return out as Partial<AppConfig>;
    },
    write: async (patch) => {
      for (const key of Object.keys(patch) as HeroGridConfigKey[]) {
        try {
          storage.setItem(LOCAL_STORAGE_KEYS[key], JSON.stringify(patch[key]));
        } catch {
          /* cota estourada: segue sem persistir */
        }
      }
    },
  };
}

/** Nao lança quando nao há nenhum dos dois caminhos (SSR, teste node sem fake). */
function nullConfigIO(): HeroGridConfigIO {
  return { read: async () => ({}), write: async () => {} };
}

/**
 * A bifurcacao do projeto, no unico lugar deste modulo: `window.api` presente => Electron;
 * ausente => `localStorage`.
 */
export function resolveConfigIO(): HeroGridConfigIO {
  if (typeof window !== 'undefined' && window.api && window.api.store) {
    return electronConfigIO(window.api);
  }
  if (typeof localStorage !== 'undefined') {
    return browserConfigIO(localStorage);
  }
  return nullConfigIO();
}

/* ------------------------------------------------------------------ *
 * 6. Escrita: só o que mudou, nunca `undefined`
 * ------------------------------------------------------------------ */

/**
 * Monta o patch de config a partir de um `Partial`, ignorando campo ausente.
 *
 * Gravar `undefined` seria o pior dos dois mundos: no Electron a chave passa a existir com
 * valor `undefined` (que o JSON descarta na proxima gravacao, mudando o config sem
 * intencao) e no browser vira a string `"undefined"`, que nao volta a ser nada.
 */
function buildPatch<T extends object>(
  partial: Partial<T>,
  keyMap: Record<keyof T, HeroGridConfigKey>
): Partial<AppConfig> {
  const patch: Record<string, unknown> = {};
  for (const field of Object.keys(partial) as (keyof T)[]) {
    const configKey = keyMap[field];
    if (!configKey) continue; // campo desconhecido: ignorado, nao gravado
    const value = partial[field];
    if (value === undefined) continue;
    patch[configKey] = value;
  }
  return patch as Partial<AppConfig>;
}

/** Exposta para teste: o patch é o que a escrita realmente manda para o config. */
export function preferencesPatch(partial: Partial<HeroGridPreferences>): Partial<AppConfig> {
  return buildPatch(partial, PREFERENCE_KEYS);
}

export function syncStatePatch(partial: Partial<SyncState>): Partial<AppConfig> {
  const patch = buildPatch(partial, SYNC_STATE_KEYS);
  // C-5 aplicado tambem na ESCRITA: sem isso o arquivo cresce sem limite e o corte na
  // leitura só esconderia o problema.
  if (patch.heroGridSyncHistory !== undefined) {
    patch.heroGridSyncHistory = clampSyncHistory(patch.heroGridSyncHistory);
  }
  return patch;
}

export async function loadHeroGridPreferences(
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<HeroGridPreferences> {
  return preferencesFromConfig(await io.read());
}

export async function saveHeroGridPreferences(
  partial: Partial<HeroGridPreferences>,
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<void> {
  const patch = preferencesPatch(partial);
  if (Object.keys(patch).length === 0) return;
  await io.write(patch);
}

export async function loadSyncState(
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<SyncState> {
  return syncStateFromConfig(await io.read());
}

export async function saveSyncState(
  partial: Partial<SyncState>,
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<void> {
  const patch = syncStatePatch(partial);
  if (Object.keys(patch).length === 0) return;
  await io.write(patch);
}

export async function loadMirrorSnapshot(
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<MirrorSnapshot | null> {
  return mirrorSnapshotFromConfig(await io.read());
}

/**
 * Grava (ou apaga, com `null`) a foto do espelho.
 *
 * Diferente de `saveHeroGridPreferences`, aqui `null` é gravado de proposito em vez de ser
 * ignorado como campo ausente: quando o espelho é removido da colecao, deixar a foto antiga
 * no config faria a tela continuar mostrando um layout que nao existe mais no jogo.
 */
export async function saveMirrorSnapshot(
  snapshot: MirrorSnapshot | null,
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<void> {
  // `?? null` porque esta escrita nao passa por `buildPatch`, que é quem barra `undefined`
  // nas outras. Com `strict: false` um `undefined` chega aqui sem o compilador reclamar, e
  // gravado ele vira chave-com-`undefined` no Electron e a string `"undefined"` no browser
  // — o "pior dos dois mundos" que o comentario de `buildPatch` descreve.
  await io.write({ heroGridMirrorSnapshot: snapshot ?? null });
}

/**
 * C-4: desativar grava SÓ `heroGridEnabled: false`.
 *
 * `heroGridMirror` (e `heroGridSource`) ficam intactos de proposito — o jogador que
 * desmarca a feature ainda precisa poder remover o espelho do arquivo depois, e sem a
 * referencia o app nao sabe mais qual dos `configs` é o espelho dele.
 */
export async function disableHeroGrid(
  io: HeroGridConfigIO = resolveConfigIO()
): Promise<void> {
  await io.write({ heroGridEnabled: false });
}
