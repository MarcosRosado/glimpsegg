import { Role } from '../types/dota';
import { RankBracketBasic } from '../utils/rankBracket';
import { ItemFullPurchaseRow } from '../utils/buildAdvisor';
import { MatchupRow } from '../utils/insights/threatProfile';
import { readStatsCache, statsCacheKey, writeStatsCache } from './statsCache';

/**
 * Agregados de heroi da STRATZ, para o recomendador de build.
 *
 * UM documento GraphQL com os dois agregados sob a mesma raiz `heroStats`, entao abrir
 * a aba de coaching a frio custa 1 request. Vai pelo bridge `window.api.stratzQuery`
 * que ja existe — nenhuma mudanca de CSP, nenhuma mudanca no EXTERNAL_HOST_ALLOWLIST,
 * nenhum handler IPC novo, porque `api.stratz.com` ja esta liberado nos dois e o
 * handler `api:stratz-graphql` é generico.
 */
export const GET_HERO_BUILD_CONTEXT_QUERY = `
query GetHeroBuildContext(
  $heroId: Short!
  $positionIds: [MatchPlayerPositionType]
  $brackets: [RankBracketBasicEnum]
) {
  heroStats {
    itemFullPurchase(heroId: $heroId, positionIds: $positionIds, bracketBasicIds: $brackets) {
      itemId
      time
      matchCount
      winCount
    }
    heroVsHeroMatchup(heroId: $heroId, bracketBasicIds: $brackets) {
      advantage {
        heroId
        vs {
          heroId2
          winsAverage
          winCount
          matchCount
          synergy
        }
      }
    }
  }
}
`;

export interface HeroBuildContext {
  itemFullPurchase: ItemFullPurchaseRow[];
  matchups: MatchupRow[];
}

function mapResponse(data: any): HeroBuildContext {
  const hs = data?.heroStats;
  const rawItems: any[] = Array.isArray(hs?.itemFullPurchase) ? hs.itemFullPurchase : [];

  const itemFullPurchase: ItemFullPurchaseRow[] = rawItems
    .filter((r) => r && typeof r.itemId === 'number' && typeof r.time === 'number')
    .map((r) => ({
      itemId: r.itemId,
      // `itemFullPurchase.time` vem em MINUTOS. Renomeado aqui, na unica fronteira de
      // conversao, para nao ser confundido com os segundos de `stats.itemPurchases`.
      timeMin: r.time,
      matchCount: r.matchCount || 0,
      winCount: r.winCount || 0,
    }));

  const advantage = hs?.heroVsHeroMatchup?.advantage;
  const vs: any[] = Array.isArray(advantage) && advantage[0]?.vs ? advantage[0].vs : [];
  const matchups: MatchupRow[] = vs
    .filter((r) => r && typeof r.heroId2 === 'number')
    .map((r) => ({
      heroId2: r.heroId2,
      // `winsAverage` É o numero do confronto (winCount/matchCount). Verificado.
      // NAO usar `winRateHeroId1`: ele veio constante em todas as 126 linhas — é o win
      // rate GLOBAL do heroi, nao do confronto.
      winsAverage: typeof r.winsAverage === 'number' ? r.winsAverage : 0,
      winCount: r.winCount || 0,
      matchCount: r.matchCount || 0,
      synergy: typeof r.synergy === 'number' ? r.synergy : 0,
    }));

  return { itemFullPurchase, matchups };
}

export class RateLimitedError extends Error {
  constructor() {
    super('STRATZ rate limit');
    this.name = 'RateLimitedError';
  }
}

export async function fetchHeroBuildContext(
  heroId: number,
  position: Role,
  bracket: RankBracketBasic,
  apiKey?: string,
): Promise<HeroBuildContext | null> {
  if (!heroId || heroId <= 0) return null;

  const key = statsCacheKey(['buildctx', heroId, position, bracket]);
  const cached = readStatsCache<HeroBuildContext>(key);
  if (cached) return cached;

  const variables = {
    heroId,
    positionIds: position === 'UNKNOWN' ? null : [position],
    brackets: [bracket],
  };

  let response: any;
  if (typeof window !== 'undefined' && window.api && typeof window.api.stratzQuery === 'function') {
    response = await window.api.stratzQuery<any>(GET_HERO_BUILD_CONTEXT_QUERY, variables, apiKey);
  } else {
    const res = await fetch('https://api.stratz.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey || ''}`,
        'User-Agent': 'STRATZ_API',
      },
      body: JSON.stringify({ query: GET_HERO_BUILD_CONTEXT_QUERY, variables }),
    });
    // 429: degrada e NAO repete. Retry em cima de rate limit de chave compartilhada
    // so piora a situacao para o proprio usuario.
    if (res.status === 429) throw new RateLimitedError();
    const json = await res.json();
    response = { success: !json.errors, data: json.data, errors: json.errors };
  }

  if (response?.status === 429) throw new RateLimitedError();
  if (response?.errors?.length) {
    console.warn('[stratz] erros parciais em GetHeroBuildContext:', response.errors);
  }
  if (!response?.data?.heroStats) return null;

  const mapped = mapResponse(response.data);
  if (mapped.itemFullPurchase.length === 0 && mapped.matchups.length === 0) return null;

  writeStatsCache(key, mapped);
  return mapped;
}
