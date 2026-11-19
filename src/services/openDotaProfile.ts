/**
 * Perfil, lista de partidas, herois e companheiros pela OpenDota — o caminho unico da
 * dashboard desde que a STRATZ saiu do app (2026-11-19, docs/PLANO-OPENDOTA.md, Fase 6
 * antecipada). Nao exige token.
 *
 * Os mappers sao puros e testados contra `__fixtures__/opendota-player.json`, respostas
 * reais anonimizadas. As funcoes `fetch*` cobrem os dois caminhos de rede por
 * `openDotaGet` (IPC no Electron, `fetch` no browser).
 *
 * O QUE A LISTA NAO TEM, e por isso sai ausente — nunca estimado:
 *  - Veredito de rota: `laneResult` é sempre 'UNKNOWN' e a UI omite o badge. A regra
 *    propria é a Fase 3 do plano.
 *  - Posicao: `/players/{id}/matches` nao traz `position_est`. `role` fica 'UNKNOWN'; a
 *    rota (`lane_role`) so vem em partida parseada.
 *  - Premio (MVP etc.), participacao em abates, fatia de dano e torres do time: exigem os
 *    dez jogadores, que a lista nao traz.
 *  - Patrimonio final e ouro em maos.
 *  - Nota media por heroi: exigiria os oito insumos do Glint em todas as partidas.
 *
 * HEROIS MAIS JOGADOS saem da lista COMPLETA de partidas (uma chamada, seis campos), nao de
 * `/players/{id}/heroes`: em 2026-11-19 essa rota devolvia `games: 0` para os 127 herois de
 * uma conta com 2.870 partidas (a fixture guarda a resposta). De quebra, a lista da o KDA
 * medio de verdade, que `/heroes` nunca teve.
 *
 * GLINT NA LISTA. A lista traz os totais crus das oito estatisticas do modelo, e a tabela
 * publica `GET /benchmarks?hero_id=` da o percentil — os mesmos percentis que o detalhe da
 * partida recebe prontos (ver `utils/glint.ts`). Custa uma chamada por heroi distinto na
 * primeira carga, com cache de 7 dias por patch. Sem posicao, usa os pesos sem papel.
 * Heroi sem tabela (ou tabela que falhou) deixa `glint: null` e a nota some daquela linha.
 */
import type {
  ActivityDay,
  HeroPerformance,
  Lane,
  MatchDynamicType,
  PatchInfo,
  PatchWindow,
  PeerTeammate,
  PlayerMatchFilters,
  PlayerMatchSummary,
  PlayerProfileSummary,
} from '../types/dota';
import { AVATAR_PLACEHOLDER_SVG } from '../utils/imageFallback';
import {
  GLINT_THRESHOLDS,
  computeGlint,
  glintPercentilesFromRaw,
  type HeroBenchmarkTable,
} from '../utils/glint';
import { openDotaGet } from './opendota';
import { readStatsCache, statsCacheKey, writeStatsCache } from './statsCache';

const STEAM64_OFFSET = BigInt('76561197960265728');
/** Quantas partidas recentes a dashboard carrega. */
export const RECENT_MATCHES_LIMIT = 40;
/** Campos pedidos em `project`. Sem `project` a lista vem so com o basico. */
const MATCH_FIELDS = [
  'hero_id', 'player_slot', 'radiant_win', 'duration', 'start_time', 'kills', 'deaths', 'assists',
  'game_mode', 'lobby_type', 'gold_per_min', 'xp_per_min', 'last_hits', 'denies', 'hero_damage',
  'tower_damage', 'hero_healing', 'level', 'item_0', 'item_1', 'item_2', 'item_3', 'item_4',
  'item_5', 'item_neutral', 'party_size', 'average_rank', 'lane_role', 'is_roaming', 'version',
];

/**
 * A lista COMPLETA so com o que os herois precisam. `start_time` entrou na 2.0 para a secao
 * Herois dizer quando o heroi foi jogado por ultimo; o filtro de patch e de periodo é da
 * OpenDota (`?patch=`, `?date=`), entao nao precisa de data para filtrar aqui.
 */
const HERO_FIELDS = ['hero_id', 'kills', 'deaths', 'assists', 'player_slot', 'radiant_win', 'start_time'];

/**
 * FILTRO DE PATCH. `?patch=<id>` da OpenDota filtra no servidor, MAS nao conhece o patch novo
 * logo depois da virada: em 2026-11-19, um dia depois da 7.42, `?patch=61` voltava `[]` para
 * uma conta com partidas de 7.42 na lista, enquanto `?patch=60` funcionava. Um filtro so do
 * servidor diria "0 partidas neste patch" — afirmacao falsa. Entao:
 *  - patch ATUAL (`endsAt` null): `?date=` com os dias desde a virada, e corte local pelo
 *    `start_time` (o `date` conta dias, nao instantes);
 *  - patch ANTERIOR: `?patch=<id>`, que la ja esta indexado, e o mesmo corte local.
 * O corte local exige `start_time` na projecao, e `filterRowsToPatch` o aplica.
 */
export function patchServerQuery(patch: PatchWindow, nowSeconds: number): { patchId?: number; days?: number } {
  if (patch.endsAt === null) return { days: Math.max(1, Math.ceil((nowSeconds - patch.startsAt) / 86400) + 1) };
  return { patchId: patch.id };
}

/** Linhas cruas dentro da janela do patch. Linha sem `start_time` sai: nao da para afirmar o patch. */
export function filterRowsToPatch(rows: any[], patch: PatchWindow | undefined): any[] {
  if (!patch) return rows;
  return rows.filter((m) => {
    const t = numOrUndef(m?.start_time);
    return t !== undefined && t >= patch.startsAt && (patch.endsAt === null || t < patch.endsAt);
  });
}

/**
 * Endpoint da lista de partidas da conta. Puro. `limit`/`offset` paginam (a OpenDota aceita os
 * dois, conferido em 2026-11-19); o filtro de patch passa por `patchServerQuery`, e `days`
 * pelo `?date=` da OpenDota. Com os dois, vale o menor periodo.
 */
export function playerMatchesEndpoint(
  accountId: number,
  fields: readonly string[],
  opts: PlayerMatchFilters & { limit?: number; offset?: number } = {},
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const params: string[] = [];
  if (opts.limit !== undefined) params.push(`limit=${Math.max(1, Math.floor(opts.limit))}`);
  if (opts.offset) params.push(`offset=${Math.max(0, Math.floor(opts.offset))}`);
  if (opts.heroId !== undefined && opts.heroId > 0) params.push(`hero_id=${Math.floor(opts.heroId)}`);
  const server = opts.patch ? patchServerQuery(opts.patch, nowSeconds) : {};
  if (server.patchId !== undefined) params.push(`patch=${server.patchId}`);
  const days = [server.days, opts.days].filter((d): d is number => typeof d === 'number' && d > 0);
  if (days.length) params.push(`date=${Math.max(1, Math.floor(Math.min(...days)))}`);
  const projected = opts.patch && !fields.includes('start_time') ? [...fields, 'start_time'] : fields;
  for (const f of projected) params.push(`project=${f}`);
  return `players/${accountId}/matches?${params.join('&')}`;
}

/** Janelas de patch a partir do catalogo (mais recente primeiro): cada uma termina na virada seguinte. Pura. */
export function patchWindows(catalog: PatchInfo[]): PatchWindow[] {
  const byTime = [...catalog].sort((a, b) => a.releasedAt - b.releasedAt);
  return byTime
    .map((p, i) => ({ id: p.id, name: p.name, startsAt: p.releasedAt, endsAt: i + 1 < byTime.length ? byTime[i + 1].releasedAt : null }))
    .reverse();
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrUndef = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** `lane_role`: 1 safe, 2 mid, 3 off, 4 selva. So existe em partida parseada. */
function mapLane(m: any): Lane {
  if (m?.is_roaming === true) return 'ROAMING';
  switch (m?.lane_role) {
    case 1:
      return 'SAFE';
    case 2:
      return 'MID';
    case 3:
      return 'OFF';
    case 4:
      return 'JUNGLE';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Forma da partida. Mesmos criterios do classificador que usava IMP, com os limiares na
 * escala do Glint (`GLINT_THRESHOLDS`, por taxa de disparo medida). Sem nota, so decide o
 * que nao depende dela; o resto fica `undefined` e a UI omite o chip.
 */
export function classifyMatchDynamic(
  m: { isVictory: boolean; durationSeconds: number; kills: number; deaths: number; assists: number; goldPerMinute: number },
  glint: number | null,
): MatchDynamicType | undefined {
  const durMin = m.durationSeconds / 60;
  const kda = (m.kills + m.assists) / Math.max(1, m.deaths);
  const has = glint !== null;

  if (m.isVictory && durMin <= 32 && (kda >= 5.5 || m.goldPerMinute >= 750 || (has && glint >= GLINT_THRESHOLDS.stomp))) {
    return 'STOMP';
  }
  if (m.isVictory && durMin >= 45 && (m.deaths >= 6 || (has && glint < GLINT_THRESHOLDS.neutral))) {
    return 'COMEBACK';
  }
  if (!has) return undefined;
  // Nao depende de vitoria, de proposito: partida bem jogada e perdida existe.
  if (glint >= GLINT_THRESHOLDS.impact) return 'HIGH_IMPACT';
  if (glint <= GLINT_THRESHOLDS.poor) return 'LOW_IMPACT';
  return 'EVEN_MATCH';
}

/** Uma linha de `/players/{id}/matches` -> `PlayerMatchSummary`. Pura. */
export function mapOpenDotaPlayerMatch(
  m: any,
  tables?: Record<number, HeroBenchmarkTable | null | undefined>,
): PlayerMatchSummary {
  const isRadiant = num(m?.player_slot) < 128;
  const isVictory = isRadiant === !!m?.radiant_win;
  const kills = num(m?.kills);
  const deaths = num(m?.deaths);
  const assists = num(m?.assists);
  const durationSeconds = num(m?.duration);
  const heroId = num(m?.hero_id);
  const goldPerMinute = num(m?.gold_per_min);
  const experiencePerMinute = num(m?.xp_per_min);
  const numLastHits = num(m?.last_hits);
  const numDenies = num(m?.denies);
  // Mesma formula que a lista sempre usou (o bonus de 1,2 sem morte é dela).
  const kda = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;

  // Dano em heroi é insumo do Glint: ausente (partida muito antiga) => sem nota.
  const heroDamage = numOrUndef(m?.hero_damage);
  const glint =
    heroDamage === undefined
      ? null
      : computeGlint(
          glintPercentilesFromRaw(
            { durationSeconds, goldPerMinute, experiencePerMinute, kills, deaths, assists, lastHits: numLastHits, denies: numDenies, heroDamage },
            tables?.[heroId],
          ),
          null,
        );

  const avgRank = numOrUndef(m?.average_rank);
  return {
    matchId: String(m?.match_id ?? ''),
    heroId,
    isRadiant,
    isVictory,
    durationSeconds,
    startDateTime: num(m?.start_time),
    kills,
    deaths,
    assists,
    kda: parseFloat(kda.toFixed(1)),
    numLastHits,
    numDenies,
    goldPerMinute,
    experiencePerMinute,
    // O IMP era da STRATZ. `null`, nao 0: zero é uma nota, e nenhuma tela pode exibi-lo.
    imp: null,
    glint,
    role: 'UNKNOWN',
    lane: mapLane(m),
    dynamicType: classifyMatchDynamic({ isVictory, durationSeconds, kills, deaths, assists, goldPerMinute }, glint),
    laneResult: 'UNKNOWN',
    items: [m?.item_0, m?.item_1, m?.item_2, m?.item_3, m?.item_4, m?.item_5].map(num),
    neutralItem: num(m?.item_neutral),
    // Numericos, como a OpenDota manda: `resolveMatchType` entende '22', '7', '0'.
    gameMode: m?.game_mode != null ? String(m.game_mode) : undefined,
    lobbyType: m?.lobby_type != null ? String(m.lobby_type) : undefined,
    partySize: numOrUndef(m?.party_size) ?? null,
    level: numOrUndef(m?.level),
    heroDamage,
    towerDamage: numOrUndef(m?.tower_damage),
    heroHealing: numOrUndef(m?.hero_healing),
    killParticipationPct: null,
    damageSharePct: null,
    // `average_rank` é a medalha media (75 = Divine 5); o tier é a dezena.
    bracket: avgRank !== undefined && avgRank >= 10 ? Math.floor(avgRank / 10) : null,
    isParsed: m?.version !== null && m?.version !== undefined,
  };
}

export interface OpenDotaProfileRaw {
  player: any;
  wl: any;
  /** As partidas recentes, com todos os campos de `MATCH_FIELDS`. */
  matches: any[];
  /** A lista completa, so com heroi, KDA, lado e resultado. Alimenta os herois mais jogados. */
  heroMatches: any[];
  peers?: any[];
}

/**
 * Desempenho por heroi, contado na lista completa de partidas, mais jogado primeiro (empate:
 * menor id). Pura. É a base da secao Herois e dos "mais jogados" do Inicio.
 */
export function mapHeroPerformance(heroMatches: unknown): HeroPerformance[] {
  if (!Array.isArray(heroMatches)) return [];
  const byHero = new Map<number, { games: number; wins: number; k: number; d: number; a: number; last: number | null }>();
  for (const m of heroMatches) {
    const heroId = num(m?.hero_id);
    if (!heroId) continue;
    const h = byHero.get(heroId) || { games: 0, wins: 0, k: 0, d: 0, a: 0, last: null };
    byHero.set(heroId, h);
    h.games++;
    if ((num(m?.player_slot) < 128) === !!m?.radiant_win) h.wins++;
    h.k += num(m?.kills);
    h.d += num(m?.deaths);
    h.a += num(m?.assists);
    const t = numOrUndef(m?.start_time);
    if (t !== undefined && (h.last === null || t > h.last)) h.last = t;
  }
  return [...byHero.entries()]
    .sort((x, y) => y[1].games - x[1].games || x[0] - y[0])
    .map(([heroId, h]) => ({
      heroId,
      matchCount: h.games,
      winCount: h.wins,
      winRate: parseFloat(((h.wins / h.games) * 100).toFixed(1)),
      // KDA do agregado (soma de abates e assistencias sobre soma de mortes), nao media de razoes.
      kda: parseFloat((h.d === 0 ? h.k + h.a : (h.k + h.a) / h.d).toFixed(1)),
      lastPlayed: h.last,
    }));
}

/** Herois mais jogados, contados na lista completa de partidas. Pura. */
export function mapMostPlayedHeroes(heroMatches: unknown, limit = 8): PlayerProfileSummary['mostPlayedHeroes'] {
  return mapHeroPerformance(heroMatches)
    .slice(0, limit)
    .map((h) => ({
      heroId: h.heroId,
      matchCount: h.matchCount,
      winCount: h.winCount,
      winRate: h.winRate,
      avgKda: h.kda,
      // Nota media por heroi nao existe neste caminho.
      avgImp: null,
    }));
}

/** `/constants/patch` -> catalogo, mais recente primeiro. Pura; item sem nome, id ou data sai. */
export function mapPatchCatalog(raw: unknown): PatchInfo[] {
  if (!Array.isArray(raw)) return [];
  const out: PatchInfo[] = [];
  for (const p of raw) {
    const id = numOrUndef(p?.id);
    const ms = typeof p?.date === 'string' ? Date.parse(p.date) : NaN;
    if (id === undefined || typeof p?.name !== 'string' || !p.name || !Number.isFinite(ms)) continue;
    out.push({ id, name: p.name, releasedAt: Math.floor(ms / 1000) });
  }
  return out.sort((a, b) => b.releasedAt - a.releasedAt || b.id - a.id);
}

export function mapOpenDotaPeers(peers: unknown): PeerTeammate[] {
  if (!Array.isArray(peers)) return [];
  return peers
    .filter((p: any) => p?.account_id && p.with_games > 0)
    .slice(0, 15)
    .map((p: any) => ({
      accountId: p.account_id,
      name: p.personaname || `Player ${p.account_id}`,
      avatar: p.avatar || AVATAR_PLACEHOLDER_SVG,
      withGames: num(p.with_games),
      withWin: num(p.with_win),
      winRateWith: p.with_games ? parseFloat(((num(p.with_win) / p.with_games) * 100).toFixed(1)) : 0,
      againstGames: num(p.against_games),
      againstWin: num(p.against_win),
      lastPlayed: num(p.last_played),
    }));
}

/** Atividade dos ultimos 30 dias, sobre as partidas recentes carregadas. */
function buildActivityDays(matches: PlayerMatchSummary[], now: Date): ActivityDay[] {
  const days: Record<string, ActivityDay> = {};
  for (let i = 29; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days[key] = { date: key, count: 0, wins: 0, losses: 0 };
  }
  for (const m of matches) {
    const day = days[new Date(m.startDateTime * 1000).toISOString().slice(0, 10)];
    if (!day) continue;
    day.count++;
    if (m.isVictory) day.wins++;
    else day.losses++;
  }
  return Object.values(days);
}

/**
 * As respostas da OpenDota -> `PlayerProfileSummary`. Pura; `now` entra por
 * parametro para o teste nao depender do relogio.
 */
export function mapOpenDotaProfile(
  raw: OpenDotaProfileRaw,
  tables: Record<number, HeroBenchmarkTable | null | undefined> = {},
  now: Date = new Date(),
): PlayerProfileSummary | null {
  const profile = raw?.player?.profile;
  const accountId = num(profile?.account_id);
  // Conta inexistente ou privada volta sem `profile`: nao ha perfil para mostrar.
  if (!accountId) return null;

  const recentMatches = (Array.isArray(raw.matches) ? raw.matches : []).map((m) => mapOpenDotaPlayerMatch(m, tables));
  const win = num(raw?.wl?.win);
  const lose = num(raw?.wl?.lose);
  const totalMatches = win + lose;
  const steamId64 = String(BigInt(accountId) + STEAM64_OFFSET);

  const mostPlayedHeroes = mapMostPlayedHeroes(raw.heroMatches);

  const peers = mapOpenDotaPeers(raw.peers);
  const leaderboardRank = numOrUndef(raw?.player?.leaderboard_rank);
  return {
    steamAccountId: String(accountId),
    steamId64,
    name: profile.personaname || `Player ${accountId}`,
    avatar: profile.avatarfull || profile.avatarmedium || profile.avatar || AVATAR_PLACEHOLDER_SVG,
    profileUri: profile.profileurl || `https://steamcommunity.com/profiles/${steamId64}`,
    // 0 = sem medalha conhecida (nao calibrado ou perfil sem dado). Nunca um palpite.
    seasonRank: num(raw?.player?.rank_tier),
    leaderboardRank,
    totalMatches,
    winCount: win,
    winRate: totalMatches ? parseFloat(((win / totalMatches) * 100).toFixed(1)) : 0,
    recentMatches,
    mostPlayedHeroes,
    peers: peers.length > 0 ? peers : undefined,
    activityDays: buildActivityDays(recentMatches, now),
  };
}

/** Tabela de percentis de um heroi, com cache de 7 dias por patch. `null` em falha. */
export async function fetchHeroBenchmarkTable(heroId: number): Promise<HeroBenchmarkTable | null> {
  const key = statsCacheKey(['od-benchmarks', heroId]);
  const cached = readStatsCache<HeroBenchmarkTable>(key);
  if (cached) return cached;
  const res = await openDotaGet<any>(`benchmarks?hero_id=${heroId}`);
  const table = res?.result;
  if (!table || typeof table !== 'object') return null;
  writeStatsCache(key, table);
  return table as HeroBenchmarkTable;
}

/** Tabelas de varios herois, poucas por vez: a OpenDota limita a 60 chamadas por minuto. */
async function fetchBenchmarkTables(heroIds: number[]): Promise<Record<number, HeroBenchmarkTable | null>> {
  const out: Record<number, HeroBenchmarkTable | null> = {};
  const queue = [...new Set(heroIds)].filter((id) => id > 0);
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift()!;
      try {
        out[id] = await fetchHeroBenchmarkTable(id);
      } catch {
        out[id] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return out;
}

export async function fetchPlayerPeers(steamAccountId: string): Promise<PeerTeammate[]> {
  return mapOpenDotaPeers(await openDotaGet<any[]>(`players/${steamAccountId}/peers`));
}

/**
 * Busca e monta o perfil. `null` em qualquer falha do perfil em si (conta inexistente,
 * privada, rede) — quem chama mostra o erro; nao existe perfil de demonstracao. As partes
 * acessorias (herois, companheiros, tabelas) degradam para vazio sem derrubar o perfil.
 */
export async function fetchPlayerProfile(steamAccountId: string): Promise<PlayerProfileSummary | null> {
  const numericId = parseInt(steamAccountId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  try {
    const [player, wl, matches, heroMatches, peers] = await Promise.all([
      openDotaGet<any>(`players/${numericId}`),
      openDotaGet<any>(`players/${numericId}/wl`),
      openDotaGet<any[]>(playerMatchesEndpoint(numericId, MATCH_FIELDS, { limit: RECENT_MATCHES_LIMIT })),
      openDotaGet<any[]>(playerMatchesEndpoint(numericId, HERO_FIELDS)),
      openDotaGet<any[]>(`players/${numericId}/peers`),
    ]);
    if (!player?.profile) return null;
    const list = Array.isArray(matches) ? matches : [];
    const tables = await fetchBenchmarkTables(list.map((m) => num(m?.hero_id)));
    return mapOpenDotaProfile({ player, wl, matches: list, heroMatches: heroMatches ?? [], peers: peers ?? [] }, tables);
  } catch (err) {
    console.warn('OpenDota profile fetch failed:', err);
    return null;
  }
}

/**
 * Uma pagina da lista de partidas, com os mesmos campos e o mesmo Glint da dashboard. `hasMore`
 * diz se a pagina veio cheia (pode haver mais); `null` em falha de rede — quem chama mostra o
 * erro em vez de fingir que a lista acabou.
 */
export async function fetchPlayerMatchesPage(
  steamAccountId: string,
  opts: PlayerMatchFilters & { offset?: number; limit?: number } = {},
): Promise<{ matches: PlayerMatchSummary[]; hasMore: boolean } | null> {
  const numericId = parseInt(steamAccountId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  const limit = opts.limit ?? RECENT_MATCHES_LIMIT;
  try {
    const rows = await openDotaGet<any[]>(playerMatchesEndpoint(numericId, MATCH_FIELDS, { ...opts, limit }));
    if (!Array.isArray(rows)) return null;
    // `hasMore` olha a pagina CRUA: o corte local pode encurtar uma pagina que ainda tem sequencia.
    const kept = filterRowsToPatch(rows, opts.patch);
    const tables = await fetchBenchmarkTables(kept.map((m) => num(m?.hero_id)));
    return { matches: kept.map((m) => mapOpenDotaPlayerMatch(m, tables)), hasMore: rows.length >= limit };
  } catch (err) {
    console.warn('OpenDota match page fetch failed:', err);
    return null;
  }
}

/** Desempenho por heroi da conta, com filtro de patch e periodo no servidor. `null` em falha. */
export async function fetchHeroPerformance(steamAccountId: string, filters: PlayerMatchFilters = {}): Promise<HeroPerformance[] | null> {
  const numericId = parseInt(steamAccountId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  const rows = await openDotaGet<any[]>(playerMatchesEndpoint(numericId, HERO_FIELDS, filters));
  return Array.isArray(rows) ? mapHeroPerformance(filterRowsToPatch(rows, filters.patch)) : null;
}

/** Catalogo de patches para o filtro, com cache de 7 dias. `null` em falha. */
export async function fetchPatchCatalog(): Promise<PatchInfo[] | null> {
  const key = statsCacheKey(['od-patch-catalog']);
  const cached = readStatsCache<PatchInfo[]>(key);
  if (cached && cached.length) return cached;
  const list = mapPatchCatalog(await openDotaGet<any[]>('constants/patch'));
  if (!list.length) return null;
  writeStatsCache(key, list);
  return list;
}
