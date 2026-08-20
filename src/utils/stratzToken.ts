/**
 * STRATZ API Token Utilities & Auto-Detection
 * 
 * STRATZ Bearer Tokens are JWTs containing claims including the user's Steam Account ID:
 * {
 *   "Subject": "...",
 *   "SteamId": "123456789",
 *   "APIUser": "true",
 *   "exp": 1800000000,
 *   "iss": "https://api.stratz.com"
 * }
 */

export interface ValidatedTokenInfo {
  success: boolean;
  steamAccountId?: string;
  name?: string;
  avatar?: string;
  seasonRank?: number;
  leaderboardRank?: number;
  error?: string;
}

/**
 * Extracts the Steam Account ID (SteamID32) directly from a STRATZ Bearer JWT Token.
 */
export function extractSteamIdFromStratzToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  const parts = clean.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    const steamId = parsed.SteamId || parsed.steamId || parsed.steamID || parsed.sub || null;
    if (steamId && /^\d+$/.test(String(steamId))) {
      return String(steamId);
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Validates a STRATZ API Key against api.stratz.com/graphql and retrieves account details.
 */
export async function validateStratzApiKey(
  token: string,
  explicitSteamId?: string
): Promise<ValidatedTokenInfo> {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) {
    return { success: false, error: 'Token não pode estar vazio.' };
  }

  const detectedSteamId = explicitSteamId || extractSteamIdFromStratzToken(cleanToken);

  try {
    if (detectedSteamId) {
      const parsedId = parseInt(detectedSteamId, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return { success: false, error: 'ID de conta Steam inválido.' };
      }

      const query = `
        query ValidateTokenUser($id: Long!) {
          player(steamAccountId: $id) {
            steamAccount {
              id
              name
              avatar
              seasonRank
              isAnonymous
            }
          }
        }
      `;

      let response: any;
      if (window.api && typeof window.api.stratzQuery === 'function') {
        response = await window.api.stratzQuery<any>(query, { id: parsedId }, cleanToken);
      } else {
        const res = await fetch('https://api.stratz.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'STRATZ_API',
          },
          body: JSON.stringify({ query, variables: { id: parsedId } }),
        });

        if (res.status === 401 || res.status === 403) {
          return { success: false, error: 'Chave de API inválida ou expirada (401 Unauthorized).' };
        }
        if (!res.ok) {
          return { success: false, error: `Erro na API do STRATZ: HTTP ${res.status}` };
        }

        const json = await res.json();
        response = { success: !json.errors, data: json.data, errors: json.errors };
      }

      if (!response.success && response.error) {
        return { success: false, error: response.error };
      }

      if (response.errors && response.errors.length > 0) {
        return { success: false, error: response.errors[0].message || 'Erro ao validar token com a API.' };
      }

      const account = response.data?.player?.steamAccount;
      return {
        success: true,
        steamAccountId: String(account?.id || detectedSteamId),
        name: account?.name || `Jogador ${detectedSteamId}`,
        avatar: account?.avatar || undefined,
        seasonRank: account?.seasonRank || undefined,
      };
    } else {
      // Fallback: Test basic token validity if no SteamId was encoded
      const query = `
        query TestToken {
          constants {
            gameVersions {
              id
              name
            }
          }
        }
      `;

      let response: any;
      if (window.api && typeof window.api.stratzQuery === 'function') {
        response = await window.api.stratzQuery<any>(query, {}, cleanToken);
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

        if (res.status === 401 || res.status === 403) {
          return { success: false, error: 'Chave de API inválida ou expirada.' };
        }
        if (!res.ok) {
          return { success: false, error: `Erro na API: HTTP ${res.status}` };
        }

        const json = await res.json();
        response = { success: !json.errors, data: json.data, errors: json.errors };
      }

      if (!response.success) {
        return { success: false, error: response.error || 'Token inválido.' };
      }

      return {
        success: true,
        error: 'Token válido, mas o SteamID precisa ser informado manualmente.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha de conexão com os servidores do STRATZ.',
    };
  }
}
