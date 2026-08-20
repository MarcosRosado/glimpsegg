import { CURRENT_GAME_PATCH } from '../constants/gameVersion';

const CACHE_KEY_PATCH = 'glimpse_dota_game_patch';
const CACHE_KEY_TIMESTAMP = 'glimpse_dota_game_patch_ts';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface GamePatchInfo {
  patch: string;
  source: 'steam' | 'stratz' | 'opendota' | 'dotaconstants' | 'cache' | 'fallback';
  cachedAt?: number;
}

/**
 * Parses a Dota 2 version string into [major, minor, letter] for accurate semver comparison.
 * e.g. "7.41e" -> [7, 41, "e"], "7.41" -> [7, 41, ""]
 */
export function parsePatchVersion(version: string): [number, number, string] {
  if (!version) return [0, 0, ''];
  const match = String(version).trim().match(/^v?(\d+)\.(\d+)([a-z])?$/i);
  if (!match) return [0, 0, ''];
  return [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    (match[3] || '').toLowerCase(),
  ];
}

/**
 * Compares two Dota 2 patch strings.
 * Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
export function comparePatches(a: string, b: string): number {
  const [majorA, minorA, letterA] = parsePatchVersion(a);
  const [majorB, minorB, letterB] = parsePatchVersion(b);

  if (majorA !== majorB) return majorA - majorB;
  if (minorA !== minorB) return minorA - minorB;
  return letterA.localeCompare(letterB);
}

/**
 * Extracts a patch string (e.g. "7.41e", "7.41") from a news or announcement title.
 */
export function extractPatchFromTitle(title: string): string | null {
  if (!title || typeof title !== 'string') return null;

  // Match patterns like 'Gameplay Patch 7.41e', 'Gameplay Update 7.41b', 'Patch 7.41'
  const match1 = title.match(/\b(?:gameplay\s+patch|gameplay\s+update|patch)\s+v?(\d+\.\d+[a-z]?)\b/i);
  if (match1) return match1[1];

  // Match patterns like '7.41d Gameplay Patch', '7.41 Gameplay Update'
  const match2 = title.match(/\bv?(\d+\.\d+[a-z]?)\s+(?:gameplay\s+patch|gameplay\s+update|patch)\b/i);
  if (match2) return match2[1];

  return null;
}

/**
 * Reads cached patch synchronously from localStorage.
 * Falls back to CURRENT_GAME_PATCH if no cache exists or if CURRENT_GAME_PATCH is newer.
 */
export function getCachedGamePatch(): string {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PATCH);
    if (cached && comparePatches(cached, CURRENT_GAME_PATCH) >= 0) {
      return cached;
    }
  } catch {
    // localStorage might not be accessible in all environments
  }
  return CURRENT_GAME_PATCH;
}

/**
 * Saves patch to localStorage cache.
 */
export function setCachedGamePatch(patch: string): void {
  try {
    localStorage.setItem(CACHE_KEY_PATCH, patch);
    localStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
  } catch {
    // ignore
  }
}

/**
 * Check if the cache is still valid within TTL.
 */
function isCacheFresh(): boolean {
  try {
    const tsStr = localStorage.getItem(CACHE_KEY_TIMESTAMP);
    const cached = localStorage.getItem(CACHE_KEY_PATCH);
    if (!tsStr || !cached) return false;
    const ts = parseInt(tsStr, 10);
    return Date.now() - ts < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Queries Steam News API for official Dota 2 patch announcements.
 * This is the most granular source containing sub-version letters (e.g. 7.41e).
 */
async function fetchFromSteamNews(): Promise<string | null> {
  const url = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=25&feeds=steam_community_announcements';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam news HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.appnews?.newsitems || [];
  const patches: string[] = [];

  for (const item of items) {
    const p = extractPatchFromTitle(item.title);
    if (p) patches.push(p);
  }

  if (patches.length === 0) return null;
  patches.sort(comparePatches);
  return patches[patches.length - 1];
}

/**
 * Queries STRATZ GraphQL constants if an API token is provided.
 */
async function fetchFromStratz(token?: string): Promise<string | null> {
  let cleanToken = (token || '').trim();
  if (!cleanToken) {
    try {
      cleanToken = (localStorage.getItem('stratz_api_key') || '').trim();
    } catch {
      // ignore
    }
  }
  if (!cleanToken) return null;

  const query = `
    query GetGameVersions {
      constants {
        gameVersions {
          id
          name
        }
      }
    }
  `;

  let json: any;
  if (window.api && typeof window.api.stratzQuery === 'function') {
    const res = await window.api.stratzQuery<any>(query, {}, cleanToken);
    if (res.success && res.data) json = res.data;
  } else {
    const res = await fetch('https://api.stratz.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'STRATZ_API',
      },
      body: JSON.stringify({ query }),
    });
    if (res.ok) {
      const data = await res.json();
      json = data.data;
    }
  }

  const versions = json?.constants?.gameVersions;
  if (Array.isArray(versions) && versions.length > 0) {
    const valid = versions.map((v: any) => v.name).filter(Boolean);
    valid.sort(comparePatches);
    return valid[valid.length - 1] || null;
  }
  return null;
}

/**
 * Queries OpenDota constants endpoint.
 */
async function fetchFromOpenDota(): Promise<string | null> {
  let patches: any[] = [];
  if (window.api && typeof window.api.openDotaFetch === 'function') {
    const res = await window.api.openDotaFetch<any[]>('constants/patch');
    if (res.success && Array.isArray(res.data)) {
      patches = res.data;
    }
  } else {
    const res = await fetch('https://api.opendota.com/api/constants/patch');
    if (res.ok) {
      patches = await res.json();
    }
  }

  if (Array.isArray(patches) && patches.length > 0) {
    const names = patches.map((p: any) => p.name).filter(Boolean);
    names.sort(comparePatches);
    return names[names.length - 1] || null;
  }
  return null;
}

/**
 * Queries OpenDota GitHub dotaconstants JSON repository.
 */
async function fetchFromGitHubConstants(): Promise<string | null> {
  const res = await fetch('https://raw.githubusercontent.com/odota/dotaconstants/master/build/patch.json');
  if (!res.ok) return null;
  const patches = await res.json();
  if (Array.isArray(patches) && patches.length > 0) {
    const names = patches.map((p: any) => p.name).filter(Boolean);
    names.sort(comparePatches);
    return names[names.length - 1] || null;
  }
  return null;
}

/**
 * Multi-source dynamic patch resolver.
 * Tries Steam News, STRATZ, OpenDota, and GitHub dotaconstants in parallel / cascade,
 * determines the newest version, caches it, and broadcasts an update event.
 */
export async function fetchLatestGamePatch(force = false, token?: string): Promise<string> {
  // Check fresh cache unless forced
  if (!force && isCacheFresh()) {
    return getCachedGamePatch();
  }

  const candidatePatches: string[] = [];

  // Try Steam News (Highest fidelity for letter sub-patches like 7.41e)
  try {
    const steamPatch = await fetchFromSteamNews();
    if (steamPatch) candidatePatches.push(steamPatch);
  } catch (err) {
    console.warn('[GameVersion] Failed to fetch Steam news patch:', err);
  }

  // Try STRATZ
  try {
    const stratzPatch = await fetchFromStratz(token);
    if (stratzPatch) candidatePatches.push(stratzPatch);
  } catch (err) {
    console.warn('[GameVersion] Failed to fetch STRATZ gameVersions:', err);
  }

  // Try OpenDota
  try {
    const openDotaPatch = await fetchFromOpenDota();
    if (openDotaPatch) candidatePatches.push(openDotaPatch);
  } catch (err) {
    console.warn('[GameVersion] Failed to fetch OpenDota patch:', err);
  }

  // Try GitHub dotaconstants
  if (candidatePatches.length === 0) {
    try {
      const gitHubPatch = await fetchFromGitHubConstants();
      if (gitHubPatch) candidatePatches.push(gitHubPatch);
    } catch (err) {
      console.warn('[GameVersion] Failed to fetch GitHub dotaconstants:', err);
    }
  }

  // Add the base static constant as a baseline lower bound
  candidatePatches.push(CURRENT_GAME_PATCH);

  // Sort candidates to find highest version
  candidatePatches.sort(comparePatches);
  const newestPatch = candidatePatches[candidatePatches.length - 1];

  const currentCached = getCachedGamePatch();
  setCachedGamePatch(newestPatch);

  // Broadcast if patch changed or is newer
  if (typeof window !== 'undefined' && newestPatch !== currentCached) {
    window.dispatchEvent(new CustomEvent('glimpse:patch-updated', { detail: { patch: newestPatch } }));
  }

  return newestPatch;
}

/**
 * Subscribes to dynamic game patch changes across the app.
 */
export function subscribeToPatchUpdates(callback: (patch: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ patch: string }>;
    if (customEvent.detail?.patch) {
      callback(customEvent.detail.patch);
    }
  };

  window.addEventListener('glimpse:patch-updated', handler);
  return () => {
    window.removeEventListener('glimpse:patch-updated', handler);
  };
}
