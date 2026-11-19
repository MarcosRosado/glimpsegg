import { SteamResolveResult } from '../types/electron';
import { openDotaGet } from './opendota';

const STEAM64_OFFSET = BigInt('76561197960265728');

/**
 * Parses and normalizes various Steam ID formats:
 * - 32-bit Account ID (e.g. 155353139)
 * - 64-bit SteamID (e.g. 76561198115618867)
 * - Profile URLs (e.g. https://steamcommunity.com/profiles/76561198115618867)
 * - Vanity URLs (e.g. https://steamcommunity.com/id/arteezy)
 */
export async function resolveSteamId(input: string): Promise<SteamResolveResult> {
  if (!input || !input.trim()) {
    return { success: false, error: 'Please enter a Steam ID or Profile URL' };
  }

  // If running in Electron with IPC
  if (window.api && typeof window.api.resolveSteamId === 'function') {
    return await window.api.resolveSteamId(input);
  }

  // Browser fallback
  const trimmed = input.trim();

  // Pure digits
  if (/^\d+$/.test(trimmed)) {
    const num = BigInt(trimmed);
    if (num > STEAM64_OFFSET) {
      const steam32 = String(Number(num - STEAM64_OFFSET));
      return { success: true, steamAccountId: steam32, steamId64: trimmed };
    } else {
      const steam64 = String(BigInt(trimmed) + STEAM64_OFFSET);
      return { success: true, steamAccountId: trimmed, steamId64: steam64 };
    }
  }

  // Profile URL
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/);
  if (profileMatch) {
    const num = BigInt(profileMatch[1]);
    const steam32 = String(Number(num - STEAM64_OFFSET));
    return { success: true, steamAccountId: steam32, steamId64: profileMatch[1] };
  }

  // Vanity URL search via OpenDota
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  const vanityName = vanityMatch ? vanityMatch[1] : trimmed;

  try {
    const res = await fetch(`https://api.opendota.com/api/search?q=${encodeURIComponent(vanityName)}`);
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const steam32 = String(first.account_id);
        const steam64 = String(BigInt(steam32) + STEAM64_OFFSET);
        return {
          success: true,
          steamAccountId: steam32,
          steamId64: steam64,
          personaname: first.personaname,
          avatar: first.avatarfull,
        };
      }
    }
  } catch (err) {
    console.warn('Vanity resolution failed:', err);
  }

  return {
    success: false,
    error: 'Could not resolve Steam ID. Enter a 32-bit Account ID (e.g. 155353139) or 64-bit ID.',
  };
}

/**
 * Completa um resultado já resolvido com o nome e a foto do perfil público da OpenDota.
 *
 * `resolveSteamId` só traz nome e foto pela busca de nome (link `/id/`); ID numérico e link
 * `/profiles/` são convertidos sem consulta nenhuma, e a confirmação do onboarding aparecia
 * só com o número — o jogador não tinha como ver se era a conta dele. Nome e foto vêm de
 * `players/{id}`, o perfil DAQUELE id, então não há risco de mostrar a conta de outra pessoa.
 *
 * Falha da consulta não derruba a resolução: o ID continua válido e `profileStatus` diz o que
 * houve, para a tela avisar em vez de calar. `fetchPlayer` é injetado para o teste.
 */
export async function withOpenDotaProfile(
  res: SteamResolveResult,
  fetchPlayer: (accountId: string) => Promise<unknown | null> = (id) => openDotaGet<unknown>(`players/${id}`),
): Promise<SteamResolveResult> {
  if (!res.success || !res.steamAccountId) return res;
  if (res.personaname) return { ...res, profileStatus: 'FOUND' };
  let player: unknown | null = null;
  try {
    player = await fetchPlayer(res.steamAccountId);
  } catch {
    player = null;
  }
  if (player === null || typeof player !== 'object') return { ...res, profileStatus: 'UNAVAILABLE' };
  const profile = (player as { profile?: { personaname?: unknown; avatarfull?: unknown } }).profile;
  const name = typeof profile?.personaname === 'string' && profile.personaname.trim() ? profile.personaname : null;
  if (!name) return { ...res, profileStatus: 'NOT_FOUND' };
  const avatar = typeof profile?.avatarfull === 'string' && profile.avatarfull ? profile.avatarfull : undefined;
  return { ...res, personaname: name, avatar: avatar ?? res.avatar, profileStatus: 'FOUND' };
}
