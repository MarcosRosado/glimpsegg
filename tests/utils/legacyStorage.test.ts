import { describe, it, expect } from 'vitest';
import {
  LEGACY_LOCAL_STORAGE_KEYS,
  LOCAL_STORAGE_KEYS,
  migrateLegacyLocalStorage,
  type KeyValueStorage,
} from '../../src/utils/legacyStorage';

/** `Storage` minimo em memoria: o vitest roda sem DOM. */
function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

describe('migrateLegacyLocalStorage', () => {
  it('copia as chaves stratz_* para glimpsegg_* e deixa as antigas', () => {
    const s = memoryStorage({ stratz_steam_id: '123', stratz_profile_history: '[{"steamAccountId":"123"}]' });
    expect(migrateLegacyLocalStorage(s).sort()).toEqual([LOCAL_STORAGE_KEYS.profileHistory, LOCAL_STORAGE_KEYS.steamId].sort());
    expect(s.data[LOCAL_STORAGE_KEYS.steamId]).toBe('123');
    expect(s.data[LOCAL_STORAGE_KEYS.profileHistory]).toBe('[{"steamAccountId":"123"}]');
    expect(s.data.stratz_steam_id).toBe('123');
  });

  it('roda uma vez: chave nova presente nao é sobrescrita', () => {
    const s = memoryStorage({ stratz_steam_id: 'antigo', glimpsegg_steam_id: 'novo' });
    expect(migrateLegacyLocalStorage(s)).toEqual([]);
    expect(s.data.glimpsegg_steam_id).toBe('novo');
  });

  it('nunca toca no token da STRATZ', () => {
    const s = memoryStorage({ stratz_api_key: 'fake-token-for-test' });
    migrateLegacyLocalStorage(s);
    expect(s.data).toEqual({ stratz_api_key: 'fake-token-for-test' });
    expect(Object.values(LEGACY_LOCAL_STORAGE_KEYS)).not.toContain('stratz_api_key');
  });

  it('storage que lanca ou ausente nao derruba o app', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(migrateLegacyLocalStorage(throwing)).toEqual([]);
    expect(migrateLegacyLocalStorage(null)).toEqual([]);
  });
});
