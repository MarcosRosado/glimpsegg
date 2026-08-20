import { ProfileHistoryItem } from './dota';

export interface AppConfig {
  stratzApiKey: string;
  steamAccountId: string;
  profileHistory?: ProfileHistoryItem[];
  theme: 'dark' | 'midnight' | 'slate';
  autoRefresh?: boolean;
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
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}
