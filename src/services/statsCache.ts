import { getCachedGamePatch } from './gameVersionService';

/**
 * Cache local para agregados de heroi da STRATZ.
 *
 * Segue o mesmo padrao de gameVersionService.ts (localStorage + timestamp + TTL),
 * generalizado. Justificativa: `itemFullPurchase` e `heroVsHeroMatchup` sao agregados
 * de mudanca lenta, com chave (heroi, posicao, bracket) — exatamente a forma que um
 * cache por patch atende. Custo por abertura da aba: 1 request a frio, 0 morno.
 */

const PREFIX = 'glimpse_hs_v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface Envelope<T> {
  ts: number;
  patch: string;
  data: T;
}

/** Camada em memoria, para trocar de aba nao re-parsear JSON. */
const memory = new Map<string, Envelope<unknown>>();

export function statsCacheKey(parts: (string | number)[]): string {
  return PREFIX + parts.join(':');
}

function currentPatch(): string {
  try {
    return getCachedGamePatch() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function readStatsCache<T>(key: string): T | null {
  const patch = currentPatch();

  const inMemory = memory.get(key) as Envelope<T> | undefined;
  if (inMemory && isFresh(inMemory, patch)) return inMemory.data;

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!isFresh(env, patch)) {
      localStorage.removeItem(key);
      return null;
    }
    memory.set(key, env);
    return env.data;
  } catch {
    return null;
  }
}

function isFresh<T>(env: Envelope<T>, patch: string): boolean {
  if (!env || typeof env.ts !== 'number') return false;
  // Invalidacao dura por patch: agregado é por patch, e uma virada de patch nao pode
  // servir meta velha, mesmo dentro do TTL.
  if (env.patch !== patch) return false;
  return Date.now() - env.ts < TTL_MS;
}

export function writeStatsCache<T>(key: string, data: T): void {
  const env: Envelope<T> = { ts: Date.now(), patch: currentPatch(), data };
  memory.set(key, env);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // Cota estourada: remove os mais antigos e tenta uma vez. Falhando, roda sem cache.
    if (pruneOldest()) {
      try {
        localStorage.setItem(key, JSON.stringify(env));
      } catch {
        /* segue sem cache */
      }
    }
  }
}

function pruneOldest(): boolean {
  try {
    const entries: { key: string; ts: number }[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const env = JSON.parse(localStorage.getItem(k) || '{}');
        entries.push({ key: k, ts: typeof env.ts === 'number' ? env.ts : 0 });
      } catch {
        entries.push({ key: k, ts: 0 });
      }
    }
    if (entries.length === 0) return false;
    entries.sort((a, b) => a.ts - b.ts);
    const toDrop = Math.max(1, Math.ceil(entries.length / 3));
    for (let i = 0; i < toDrop; i += 1) {
      localStorage.removeItem(entries[i].key);
      memory.delete(entries[i].key);
    }
    return true;
  } catch {
    return false;
  }
}
