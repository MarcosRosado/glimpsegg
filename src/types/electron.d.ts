import { ProfileHistoryItem } from './dota';
import {
  ConfigRef,
  GridBackupEntry,
  GridReadPayload,
  GridWriteRequest,
  HeroGridResult,
  RankingCriterion,
  SteamAccountCandidate,
  SyncRecord,
} from './heroGrid';
import { RankBracketBasic } from '../utils/rankBracket';

export interface AppConfig {
  stratzApiKey: string;
  steamAccountId: string;
  profileHistory?: ProfileHistoryItem[];
  theme: 'dark' | 'midnight' | 'slate';
  autoRefresh?: boolean;

  /**
   * Feature de layout espelho de herois (specs/001-meta-hero-grid).
   *
   * TODAS opcionais de proposito. C-1/C-2: quem atualiza de uma versao anterior nao tem
   * nenhuma destas chaves no `stratz_app_config.json`, e chave ausente lê como o default
   * de `utils/heroGrid/preferences.ts` — que mantem a feature DESLIGADA (FR-001). O
   * `loadConfig()` do main nao lista nenhuma delas justamente para o default nao existir
   * em dois lugares e divergir.
   */
  heroGridEnabled?: boolean;
  heroGridSteamId3?: string | null;
  heroGridFilePath?: string | null;
  /** C-7: `index` é a identidade, `name` é o ultimo nome visto. Nunca o contrario. */
  heroGridSource?: ConfigRef | null;
  /** C-4: preservado ao desmarcar a feature, senao remover o espelho fica impossivel. */
  heroGridMirror?: ConfigRef | null;
  /**
   * C-8: nome DESEJADO pelo jogador. Distinto de `heroGridMirror.name`, que é o ultimo nome
   * VISTO no arquivo — gravar o desejado la faria a sync seguinte ler um nome ausente do
   * disco, concluir rename (N-3) e jogar a escolha do jogador fora.
   */
  heroGridMirrorName?: string | null;
  heroGridCriterion?: RankingCriterion;
  heroGridBracket?: RankBracketBasic | null;
  /** I-22: so avanca em `outcome !== 'FAILURE'`. */
  heroGridLastSuccessfulSyncAt?: number | null;
  heroGridLastAttemptAt?: number | null;
  heroGridConsecutiveFailures?: number;
  /** C-5: no maximo 20 registros. */
  heroGridSyncHistory?: SyncRecord[];
}

/**
 * Ponte de arquivo da feature de hero grid.
 *
 * Principio de fronteira: o main NAO decide nada. Ele nao sabe o que é winrate, espelho
 * nem ranking — recebe o texto ja serializado e grava. Toda decisao é funcao pura em
 * `src/`, que o vitest alcanca.
 */
export interface HeroGridApi {
  /** Lista contas Steam candidatas. Nao lê o conteudo de grid nenhum. */
  listAccounts: () => Promise<HeroGridResult<SteamAccountCandidate[]>>;
  /** L-1: arquivo ausente devolve `exists: false`, nao erro, e NAO cria arquivo. */
  readFile: (args: { path: string }) => Promise<HeroGridResult<GridReadPayload>>;
  /** E-3: o main faz `JSON.parse(content)` e aborta com `SOURCE_MUTATED` se a origem divergir. */
  writeFile: (args: GridWriteRequest) => Promise<HeroGridResult<{ backupPath: string; bytesWritten: number }>>;
  restoreBackup: (args: { path: string; backupPath?: string }) => Promise<HeroGridResult<{ restoredFrom: string }>>;
  listBackups: (args: { path: string }) => Promise<HeroGridResult<GridBackupEntry[]>>;
  /** R12: casa nome de executavel EXATO, nunca substring de linha de comando. */
  isDotaRunning: () => Promise<HeroGridResult<{ running: boolean; method: 'ps' | 'tasklist' | 'unsupported' }>>;
}

export interface SteamResolveResult {
  success: boolean;
  steamAccountId?: string;
  steamId64?: string;
  personaname?: string;
  avatar?: string;
  error?: string;
}

export interface StratzGqlResponse<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Array<{ message: string }>;
  error?: string;
  status?: number;
  statusText?: string;
}

export interface ElectronApi {
  store: {
    get: <T = unknown>(key: keyof AppConfig | string) => Promise<T>;
    set: <T = unknown>(key: keyof AppConfig | string, value: T) => Promise<boolean>;
    getAll: () => Promise<AppConfig>;
  };
  stratzQuery: <T = unknown>(query: string, variables?: Record<string, unknown>, customApiKey?: string) => Promise<StratzGqlResponse<T>>;
  openDotaFetch: <T = unknown>(endpoint: string) => Promise<{ success: boolean; data?: T; error?: string }>;
  resolveSteamId: (input: string) => Promise<SteamResolveResult>;
  windowControl: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  updater?: {
    check: () => Promise<{ updateInfo?: { version: string }; dev?: boolean }>;
    quitAndInstall: () => Promise<void>;
    onStatus: (callback: (data: { status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'; version?: string; error?: string }) => void) => () => void;
    onProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
  };
  getPlatform: () => string;
  getVersion?: () => Promise<string>;
  /** Ausente no caminho browser (`npm run dev`) — la a escrita de layout é indisponivel. */
  heroGrid?: HeroGridApi;
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}
