import { MetaWinrate } from '../../types/heroGrid';
import { RankBracketBasic } from '../../utils/rankBracket';
import { getCachedGamePatch } from '../gameVersionService';
import { readStatsCache, statsCacheKey, writeStatsCache } from '../statsCache';
import { RateLimitedError } from '../stratzHeroStats';

/**
 * Segunda fonte de winrate de meta (FR-015): `heroStats.winWeek` da STRATZ.
 *
 * Preenche heroi que a OpenDota nao devolveu e serve de segunda medicao. Vai pelo
 * bridge `window.api.stratzQuery` que ja existe — nenhum host novo, nenhuma mudanca de
 * CSP, nenhum handler IPC novo, porque `api.stratz.com` ja esta liberado nos dois lados
 * e o handler `api:stratz-graphql` é generico. Mesmo desenho de `stratzHeroStats.ts`.
 *
 * `RateLimitedError` é REAPROVEITADA de `stratzHeroStats.ts` de proposito: uma segunda
 * classe com o mesmo nome faria `instanceof` falhar em quem trata as duas fontes junto.
 */

/* ------------------------------------------------------------------ *
 * 1. A query verificada
 * ------------------------------------------------------------------ */

/**
 * Verificada contra a API real (introspeccao + 6 requisicoes 200, uma por bracket) —
 * ver `contracts/meta-sources.md § 2`. Tres decisoes que parecem omissao e nao sao:
 *
 * - sem `groupBy`: o default JA devolve uma linha por heroi (127 linhas, zero duplicata
 *   por `heroId`, medido nos 6 brackets). Passar `HERO_ID` nao muda nada.
 * - sem `durationMinute`: sem agrupamento por duracao o campo vem `0` e nao significa
 *   nada aqui. Pedir numero que nao significa nada é o comeco de inventar dado.
 * - sem `positionIds`: recorte por posicao esta FORA de escopo (FR-034). O winrate desta
 *   feature é o geral do heroi por ranque.
 */
export const GET_HERO_META_WINRATES_QUERY = `
query GetHeroMetaWinrates($brackets: [RankBracket]) {
  heroStats {
    winWeek(take: 1, bracketIds: $brackets) {
      week
      heroId
      winCount
      matchCount
    }
  }
}
`;

/**
 * Expansao do `RankBracketBasic` do app na lista de medalhas de `bracketIds`.
 *
 * Esta tabela existe porque `winWeek` NAO aceita o `RankBracketBasicEnum` que o resto do
 * projeto usa: o argumento é `bracketIds: [RankBracket]`, e `RankBracket` é o enum por
 * MEDALHA (`HERALD`, `GUARDIAN`, ...). Isso foi MEDIDO por introspecao, nao inferido do
 * nome — `stratzHeroStats.ts` usa `bracketBasicIds` porque `itemFullPurchase` aceita esse
 * outro argumento; sao campos diferentes com vocabularios diferentes.
 *
 * A particao é a MESMA de `tierToBracket()`, entao o app nao ganha conceito novo, so uma
 * traducao de fronteira. `ALL` => `null` => o argumento é OMITIDO (sem filtro), e nao uma
 * lista com as nove medalhas.
 */
export const BRACKET_TO_MEDAL_IDS: Record<RankBracketBasic, string[] | null> = {
  UNCALIBRATED: ['UNCALIBRATED'],
  HERALD_GUARDIAN: ['HERALD', 'GUARDIAN'],
  CRUSADER_ARCHON: ['CRUSADER', 'ARCHON'],
  LEGEND_ANCIENT: ['LEGEND', 'ANCIENT'],
  DIVINE_IMMORTAL: ['DIVINE', 'IMMORTAL'],
  ALL: null,
};

/* ------------------------------------------------------------------ *
 * 2. Resultado: tres ausencias diferentes, nunca confundidas
 * ------------------------------------------------------------------ */

/**
 * Por que um envelope em vez de `MetaWinrate[] | null`: quem chama precisa classificar o
 * `outcome` da sincronizacao (`SUCCESS`/`PARTIAL`/`FAILURE`), e `null` juntaria tres
 * situacoes que a tabela de degradacao trata de forma diferente.
 *
 * - `OK`      — respondeu com linhas uteis. `rows.length > 0`.
 * - `EMPTY`   — respondeu 200 e sem linha nenhuma para o bracket. A fonte FUNCIONOU;
 *               nao entra em `sourcesFailed`.
 * - `NO_TOKEN`— I-21 / FR-015a: ausencia de token NAO é erro, é fonte INDISPONIVEL. A
 *               feature conclui inteira so com a OpenDota, rotulado. Nao entra em
 *               `sourcesFailed` (nao houve tentativa) e NUNCA sozinha causa `FAILURE`.
 * - `ERROR`   — rede/API falhou de fato. Esta, sim, entra em `sourcesFailed`.
 */
export type StratzWinratesStatus = 'OK' | 'EMPTY' | 'NO_TOKEN' | 'ERROR';

export interface StratzWinratesOutcome {
  status: StratzWinratesStatus;
  /** Sempre array — nunca `undefined`. Vazio em tudo que nao é `OK`. */
  rows: MetaWinrate[];
  /** S-2: mensagem curta para exibir/logar. NUNCA carrega token. */
  reason?: string;
}

/** `true` só quando a fonte foi tentada e falhou — é o que vira `sourcesFailed`. */
export function stratzSourceFailed(outcome: StratzWinratesOutcome): boolean {
  return outcome.status === 'ERROR';
}

/** `true` quando a fonte nao contribuiu, por qualquer motivo (falha, sem token, vazia). */
export function stratzSourceContributed(outcome: StratzWinratesOutcome): boolean {
  return outcome.status === 'OK' && outcome.rows.length > 0;
}

/* ------------------------------------------------------------------ *
 * 3. O mapper puro
 * ------------------------------------------------------------------ */

export interface WinWeekRow {
  week?: number | null;
  heroId?: number | null;
  winCount?: number | null;
  matchCount?: number | null;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * `winWeek` cru -> `MetaWinrate[]`. Puro e exportado para poder ser testado contra a
 * fixture sem rede.
 *
 * Descarte, nao conserto. Cada filtro abaixo é uma invariante, nao paranoia:
 *
 * - `matchCount === 0` (ou ausente) é AUSENCIA, nao 0% (I-14). Um heroi sem partida no
 *   bracket tem de sair do array, para a nota o tratar como "sem dado" — colocar 0%
 *   colocaria o heroi no fim do ranking como se fosse medido e ruim.
 * - `winCount` ausente/`null` derruba a linha: `winRate` sem `wins` viola I-11.
 * - `winCount > matchCount` é dado impossivel. Fica FORA em vez de ser truncado, porque
 *   truncar produziria um `winRate` de 100% que nunca foi medido.
 * - `heroId` repetido: a primeira linha vence. A medicao nao viu duplicata em nenhum dos
 *   6 brackets, mas duplicata silenciosa aqui viraria heroi contado duas vezes na ordem.
 */
export function mapWinWeekRows(
  rows: unknown,
  bracket: RankBracketBasic,
  patch: string,
  bracketIsPlayerSpecific: boolean = bracket !== 'ALL',
): MetaWinrate[] {
  if (!Array.isArray(rows)) return [];

  const seen = new Set<number>();
  const out: MetaWinrate[] = [];

  for (const raw of rows as WinWeekRow[]) {
    if (!raw || typeof raw !== 'object') continue;
    if (!isPositiveInt(raw.heroId)) continue;
    // I-14: sem amostra, é ausencia.
    if (!isPositiveInt(raw.matchCount)) continue;
    // I-11: `wins` tem de existir.
    if (!isNonNegative(raw.winCount)) continue;
    if (raw.winCount > raw.matchCount) continue;
    if (seen.has(raw.heroId)) continue;

    seen.add(raw.heroId);
    out.push({
      heroId: raw.heroId,
      source: 'STRATZ_BRACKET',
      winRate: raw.winCount / raw.matchCount,
      wins: raw.winCount,
      matchCount: raw.matchCount,
      bracket,
      bracketIsPlayerSpecific,
      patch,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Transporte injetavel
 * ------------------------------------------------------------------ */

export interface StratzTransportResult {
  status?: number;
  data?: unknown;
  errors?: Array<{ message: string }>;
  error?: string;
}

export type StratzTransport = (
  query: string,
  variables: Record<string, unknown>,
  apiKey: string,
) => Promise<StratzTransportResult>;

/**
 * Os dois caminhos de rede do projeto, na mesma funcao:
 * Electron => IPC por `window.api.stratzQuery`; browser (`npm run dev`) => `fetch`
 * direto. É injetavel para o teste poder contar chamadas sem tocar em rede.
 */
export const defaultStratzTransport: StratzTransport = async (query, variables, apiKey) => {
  if (typeof window !== 'undefined' && window.api && typeof window.api.stratzQuery === 'function') {
    const response = await window.api.stratzQuery<unknown>(query, variables, apiKey);
    return {
      status: response?.status,
      data: response?.data,
      errors: response?.errors,
      error: response?.error,
    };
  }

  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'STRATZ_API',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = res.status === 429 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data: (json as any)?.data, errors: (json as any)?.errors };
};

/* ------------------------------------------------------------------ *
 * 5. A funcao publica
 * ------------------------------------------------------------------ */

export interface FetchStratzWinratesOptions {
  transport?: StratzTransport;
  /**
   * `false` => nao le nem escreve `statsCache`. Serve ao teste; em producao o cache é o
   * que faz trocar de aba nao virar request.
   */
  useCache?: boolean;
  /**
   * Vem do `ResolvedBracket.isPlayerSpecific` de quem chama, quando ele sabe mais que a
   * regra "bracket !== ALL" (I-13). Sem valor, o default é essa regra.
   */
  bracketIsPlayerSpecific?: boolean;
}

/**
 * Busca os winrates de meta da STRATZ para um bracket.
 *
 * NAO lanca em ausencia de token nem em falha de rede — devolve `status`. A UNICA excecao
 * é `RateLimitedError` em 429, que sobe para quem chama poder degradar de vez: retry em
 * cima de rate limit de chave compartilhada so piora a situacao do proprio usuario.
 */
export async function fetchStratzWinrates(
  bracket: RankBracketBasic,
  apiKey?: string,
  options: FetchStratzWinratesOptions = {},
): Promise<StratzWinratesOutcome> {
  const { transport = defaultStratzTransport, useCache = true, bracketIsPlayerSpecific } = options;

  // I-21 / FR-015a: sem token a fonte é INDISPONIVEL, nao com erro. Sai antes de
  // qualquer requisicao — nao ha o que tentar, e tentar geraria um 401 que quem chama
  // leria como "a STRATZ caiu".
  if (!apiKey || !apiKey.trim()) {
    return { status: 'NO_TOKEN', rows: [], reason: 'STRATZ sem token configurado' };
  }

  const key = statsCacheKey(['gridmeta', 'stratz', bracket]);
  if (useCache) {
    const cached = readStatsCache<MetaWinrate[]>(key);
    if (cached && cached.length > 0) return { status: 'OK', rows: cached };
  }

  const medals = BRACKET_TO_MEDAL_IDS[bracket] ?? null;
  // `ALL` => `null`: sem filtro. A variavel vai como `null` para o argumento ser tratado
  // como omitido pela API, em vez de virar uma lista das nove medalhas.
  const variables: Record<string, unknown> = { brackets: medals };

  let response: StratzTransportResult;
  try {
    response = await transport(GET_HERO_META_WINRATES_QUERY, variables, apiKey);
  } catch (err) {
    // 429 sobe intacto; qualquer outra falha vira `ERROR` (fonte tentada e falhou).
    if (err instanceof RateLimitedError) throw err;
    return { status: 'ERROR', rows: [], reason: describeError(err) };
  }

  // 429: degrada e NAO repete. Nenhuma segunda chamada ao transporte a partir daqui.
  if (response?.status === 429) throw new RateLimitedError();

  if (typeof response?.status === 'number' && response.status >= 400) {
    return { status: 'ERROR', rows: [], reason: `STRATZ HTTP ${response.status}` };
  }

  const winWeek = (response?.data as any)?.heroStats?.winWeek;

  if (response?.errors?.length) {
    // Erro de GraphQL COM dado é resposta parcial: mapeia o que veio e avisa. Sem dado,
    // é falha da fonte.
    console.warn('[stratz] erros parciais em GetHeroMetaWinrates:', response.errors);
    if (!Array.isArray(winWeek)) {
      return { status: 'ERROR', rows: [], reason: 'STRATZ devolveu erros de GraphQL' };
    }
  }

  if (!Array.isArray(winWeek)) {
    return { status: 'ERROR', rows: [], reason: 'Resposta da STRATZ sem heroStats.winWeek' };
  }

  const rows = mapWinWeekRows(winWeek, bracket, getCachedGamePatch(), bracketIsPlayerSpecific);

  // Respondeu, mas sem nada aproveitavel. NAO é erro — a fonte esta viva e disse "nao
  // tenho dado para este bracket".
  if (rows.length === 0) {
    return { status: 'EMPTY', rows: [], reason: 'STRATZ sem linhas para o bracket' };
  }

  if (useCache) writeStatsCache(key, rows);
  return { status: 'OK', rows };
}

/** S-2: mensagem, nunca token. Nao repassa objeto de erro cru, que pode trazer a request. */
function describeError(err: unknown): string {
  if (err instanceof Error) return `Falha ao consultar a STRATZ: ${err.name}`;
  return 'Falha ao consultar a STRATZ';
}
