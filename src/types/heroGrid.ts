import { RankBracketBasic } from '../utils/rankBracket';

/**
 * Entidades da feature de layout espelho de herois (specs/001-meta-hero-grid).
 *
 * Convencao do projeto: identificadores em ingles, comentario em pt-BR explicando o
 * *porque*. Cada comentario aqui aponta a invariante (I-n) de `data-model.md` que o
 * campo existe para sustentar — os campos deste arquivo nao sao decorativos, sao o
 * contrato que os testes verificam.
 *
 * Sobre L-4 (preservar campo desconhecido que a Valve acrescente em patch novo): NAO ha
 * index signature `[k: string]: unknown` nestas interfaces de proposito. Ela silenciaria
 * erro de digitacao em `file.config` / `cat.hero_id`, que com `strict: false` é a classe
 * de bug mais barata de pegar aqui. A preservacao acontece em RUNTIME, porque o
 * `mirrorBuilder` copia por spread (`{ ...category, hero_ids: ordered }`) e o `valveJson`
 * serializa as chaves que o objeto realmente tem — e é isso que `valveJson.test.ts`
 * verifica com o round-trip, nao o tipo.
 */

/* ------------------------------------------------------------------ *
 * 1. O arquivo de grids (formato da Valve)
 * ------------------------------------------------------------------ */

/**
 * Formato do `hero_grid_config.json`. Verificado contra arquivo real: `version: 3`.
 *
 * `configs` é um ARRAY, e é nisso que a feature inteira se apoia: o espelho é um
 * elemento novo ao lado do layout do jogador, nunca uma alteracao dele (FR-007).
 */
export interface HeroGridFile {
  /** I-3: preservar o valor LIDO. Fixar 3 aqui seria reescrever arquivo de patch futuro. */
  version: number;
  configs: HeroGridConfig[];
}

export interface HeroGridConfig {
  config_name: string;
  categories: HeroGridCategory[];
}

export interface HeroGridCategory {
  category_name: string;
  /** I-6: copiado da origem sem tocar. Sem isso o espelho renderiza fora de lugar. */
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  /**
   * A ORDEM é o que aparece no jogo, e é o UNICO campo que o espelho altera.
   * I-7: o CONJUNTO tem de ser identico ao da origem — nenhum a mais, nenhum a menos.
   */
  hero_ids: number[];
}

/* ------------------------------------------------------------------ *
 * 2. Identidade: posicao, nunca nome
 * ------------------------------------------------------------------ */

/**
 * Como o app se refere a um layout ou a uma categoria.
 *
 * Por que nao `config_name`: o Dota 2 permite dois layouts com o mesmo nome, permite
 * duas CATEGORIAS com o mesmo nome (o grid publicado pelo D2PT repete "Best with" sete
 * vezes num unico layout — caso real, nao hipotese) e permite renomear a qualquer
 * momento. Identidade por nome perde o rastro do espelho num rename e cria um segundo
 * na sincronizacao seguinte, violando FR-008c.
 */
export interface ConfigRef {
  /** A identidade: posicao no array `configs`. */
  index: number;
  /** Ultimo nome conhecido. Rotulo para exibir e para detectar rename (N-3). */
  name: string;
}

/* ------------------------------------------------------------------ *
 * 3. Resultado do espelhamento
 * ------------------------------------------------------------------ */

/** Relatorio por grupo do espelho. */
export interface MirrorGroupReport {
  /** I-4a: a identidade é a POSICAO. Nomes repetem, e os dois grupos sao independentes. */
  categoryIndex: number;
  /** Rotulo, so para exibir. */
  categoryName: string;
  ordered: number;
  withoutData: number;
}

/**
 * Saida pura de `mirrorBuilder`: o arquivo inteiro pronto para serializar e gravar.
 * Sem campo de posicao por grupo — FR-034 removeu o recorte por funcao.
 */
export interface MirrorResult {
  /** Origem INTOCADA (I-1) + espelho novo ou substituido. Nenhum outro config muda (I-2). */
  file: HeroGridFile;
  source: ConfigRef;
  mirror: ConfigRef;
  perGroup: MirrorGroupReport[];
  /** FR-035a: herois do ranking que NAO estao na origem. So informativo, nao entram no espelho. */
  outsideSource: number[];
  /** FR-008d: a estrutura da origem mudou desde o ultimo espelho. */
  structureChanged: boolean;
}

/* ------------------------------------------------------------------ *
 * 4. Winrate com procedencia
 * ------------------------------------------------------------------ */

/**
 * Vocabulario de fontes, na ordem de precedencia (FR-015): OpenDota primeiro, porque
 * nao exige token. Mesma disciplina de `BenchmarkSource` em `types/dota.ts`.
 *
 * NAO existe fonte sem winrate: a proposta `RANK_ONLY` caiu com o corte do D2PT
 * (FR-013a), justamente porque ordem sem amostra nao satisfaz FR-014.
 */
export type MetaSource = 'OPENDOTA_BRACKET' | 'STRATZ_BRACKET';

export interface MetaWinrate {
  heroId: number;
  /** I-12: nunca construido sem fonte. */
  source: MetaSource;
  /** 0..1. Sempre presente — nao ha fonte sem winrate. */
  winRate: number;
  wins: number;
  /** I-11: o `sampleSize` que FR-014 manda exibir. Sempre presente, em todo caminho. */
  matchCount: number;
  bracket: RankBracketBasic;
  /**
   * I-13: `false` => caiu em 'ALL'. A UI tem de dizer "media geral", NUNCA "no seu
   * ranque". Mesma regra de honestidade de `ResolvedBracket.isPlayerSpecific`.
   */
  bracketIsPlayerSpecific: boolean;
  /** I-12: patch de `gameVersionService`. É o que faz o cache invalidar (FR-021). */
  patch: string;
}

export interface PersonalWinrate {
  heroId: number;
  /** Amostra pessoal — FR-032 manda exibir por heroi. */
  games: number;
  wins: number;
  winRate: number;
}

/* ------------------------------------------------------------------ *
 * 5. Nota combinada
 * ------------------------------------------------------------------ */

/** `COMBINED` é o padrao (FR-030). */
export type RankingCriterion = 'COMBINED' | 'META_ONLY' | 'PERSONAL_ONLY';

/** Motivo de `score === null`. Vai para a UI como "sem dado" + explicacao (FR-018). */
export type NoDataReason = 'NO_META' | 'NO_PERSONAL_IN_PERSONAL_ONLY' | 'HERO_UNKNOWN';

export interface HeroScoreBreakdown {
  /** `wilsonLowerBound` do meta. */
  metaComponent: number | null;
  /** `wilsonLowerBound` do pessoal. */
  personalComponent: number | null;
  /** I-16: 0..1, monotonico nao decrescente em `games`. `games === 0` => 0. */
  personalWeight: number;
}

export interface HeroScore {
  heroId: number;
  /** Nota final usada para ordenar. `null` => "sem dado", e vai para o fim do grupo (I-9). */
  score: number | null;
  /** FR-030b / I-15: sem `breakdown` a nota NAO é exibivel. Por isso nao é opcional. */
  breakdown: HeroScoreBreakdown;
  meta?: MetaWinrate;
  personal?: PersonalWinrate;
  criterion: RankingCriterion;
  noDataReason?: NoDataReason;
}

/* ------------------------------------------------------------------ *
 * 6. Preferencias
 * ------------------------------------------------------------------ */

/**
 * Vai para `AppConfig` (electron.d.ts) como chaves `heroGrid*` achatadas.
 * TODO default mantem a feature desligada — é o mecanismo de FR-001: quem atualiza de
 * uma versao anterior nao tem a chave, e chave ausente lê como o default.
 */
export interface HeroGridPreferences {
  /** FR-001: default FALSE, sempre. */
  enabled: boolean;
  /** Conta escolhida; pre-selecionada pelo `steamAccountId` do app. */
  steamId3: string | null;
  /** FR-006: caminho manual, quando a deteccao automatica nao acha nada. */
  gridFilePath: string | null;
  /** FR-005a: layout de origem. Posicao + ultimo nome visto. */
  source: ConfigRef | null;
  /** FR-008b: o espelho. Sobrevive a rename (FR-008h) e a desativacao (C-4). */
  mirror: ConfigRef | null;
  /**
   * C-8: nome DESEJADO para o espelho. `null` => cai no default de N-5
   * (`"<origem> — GlimpseGG"`). Separado de `mirror.name` (ultimo nome visto) porque
   * confundir os dois transforma a escolha do jogador em falso rename.
   */
  mirrorName: string | null;
  criterion: RankingCriterion;
  /** `null` => derivar do perfil; cai em 'ALL' rotulado. */
  bracket: RankBracketBasic | null;
}

/* ------------------------------------------------------------------ *
 * 7. Estado de sincronizacao
 * ------------------------------------------------------------------ */

export type SyncOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILURE';

export interface SyncRecord {
  at: number;
  outcome: SyncOutcome;
  sourcesUsed: MetaSource[];
  sourcesFailed: MetaSource[];
  heroesOrdered: number;
  structureChanged: boolean;
  /** S-2: mensagem, NUNCA token. */
  error?: string;
}

export interface SyncState {
  /** I-22: epoch ms. So `outcome !== 'FAILURE'` mexe aqui (FR-017). */
  lastSuccessfulSyncAt: number | null;
  lastAttemptAt: number | null;
  /** Alimenta o backoff `min(30min * 2^(n-1), 6h)` (FR-028). */
  consecutiveFailures: number;
  /** C-5: no maximo 20 registros (FR-036). */
  history: SyncRecord[];
}

/** Estados da maquina do agendador (`data-model.md § 6`). */
export type SyncPhase = 'IDLE' | 'DUE' | 'RUNNING' | 'BACKOFF' | 'OFF';

/** Cabecalho de frescor da aba — FR-024a. Espelho velho tem de ser visivel. */
export interface SyncFreshness {
  /** `null` => nunca sincronizou. */
  daysSinceLastSuccess: number | null;
  nextDueAt: number | null;
}

/* ------------------------------------------------------------------ *
 * 8. Contas Steam detectadas
 * ------------------------------------------------------------------ */

export interface SteamAccountCandidate {
  /** Nome do diretorio em `userdata/`. I-26: so inteiro positivo — `0` e `anonymous` nao sao contas. */
  steamId3: string;
  /** I-25: ja resolvido por `realpath`, para as tres raizes do Linux nao virarem tres candidatos. */
  steamRoot: string;
  gridFilePath: string;
  /** I-27: `false` é estado APRESENTAVEL, nao erro — o arquivo so nasce quando o jogador cria um grid. */
  gridFileExists: boolean;
  /** `steamId3 === steamAccountId` do app. Serve para pre-selecionar. */
  isConfiguredProfile: boolean;
}

/* ------------------------------------------------------------------ *
 * 9. Codigos de erro da ponte de arquivo
 * ------------------------------------------------------------------ */

/** Codigos de `contracts/ipc-hero-grid.md`. `SOURCE_MUTATED` é o que importa. */
export type HeroGridErrorCode =
  | 'FILE_NOT_FOUND'
  | 'INVALID_JSON'
  | 'NO_PERMISSION'
  | 'SOURCE_MUTATED'
  | 'CONFIG_COUNT_MISMATCH'
  | 'SOURCE_INDEX_GONE'
  | 'DOTA_RUNNING'
  | 'WRITE_IN_PROGRESS'
  | 'NAME_COLLISION'
  | 'UNSUPPORTED_PLATFORM'
  | 'UNAVAILABLE';

/**
 * Resultado das operacoes de arquivo e das que podem recusar.
 *
 * Interface PLANA, e nao uma uniao discriminada `{success:true,data} | {success:false,error}`,
 * pela mesma razao que `StratzGqlResponse` em `electron.d.ts` é plana: com `strict: false` o
 * TypeScript nao estreita uniao por literal booleano, entao dentro de um `if (!res.success)`
 * o `res.code` viraria erro de compilacao em todo chamador. A uniao daria seguranca melhor —
 * mas so com `strictNullChecks` ligado, que é uma mudanca de projeto, nao desta feature.
 * Sendo plana, `data` é opcional: quem consome checa `success` primeiro, como no resto do app.
 */
export interface HeroGridResult<T> {
  success: boolean;
  data?: T;
  /** S-2: mensagem legivel, NUNCA token. */
  error?: string;
  code?: HeroGridErrorCode;
}

export interface GridReadPayload {
  exists: boolean;
  file: HeroGridFile | null;
  /** O texto cru, para o backup byte a byte (E-1). */
  raw?: string;
}

export interface GridBackupEntry {
  path: string;
  at: number;
  bytes: number;
}

export interface GridWriteRequest {
  path: string;
  /** Texto final byte a byte, produzido por `valveJson.ts`. O main nao serializa nada. */
  content: string;
  /** POSICAO, nunca nome. */
  expectedSourceIndex: number;
  /** A guarda E-3: o main compara por igualdade profunda e ABORTA se divergir. */
  expectedSourceConfig: HeroGridConfig;
  /** A unica posicao que pode ter mudado ou nascido. */
  expectedMirrorIndex: number;
  /** Quantos configs o arquivo deve ter depois da escrita. */
  expectedConfigCount: number;
  allowWhileDotaRunning: boolean;
}
