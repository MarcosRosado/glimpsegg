/**
 * Secao CONTA da 2.0 (§3.6 de docs/PROPOSTA-V2.md): totais, contagens e recordes da conta pela
 * OpenDota, sem token. Mappers puros testados contra `__fixtures__/opendota-account.json`
 * (respostas reais); as funcoes `fetch*` passam por `openDotaGet` (os dois caminhos de rede).
 *
 * AMOSTRA POR CAMPO. Em `/totals` cada campo traz o proprio `n` — o numero de partidas em que
 * ele existe. Campo que so vem de replay analisado (`lane_efficiency_pct`, `stuns`, `pings`)
 * tem `n` bem menor que `kills`. A media sai com ESSE `n` ao lado, nunca dividida pelo total
 * de partidas da conta.
 *
 * CAMPOS QUE NAO SAO SOMA. `kda` em `/totals` é a soma da razao de cada partida: a media dela
 * é media de razoes, diferente do KDA do agregado que o app usa no resto. `comeback`, `stomp`,
 * `throw` e `loss` sao deficits/vantagens em ouro por partida, presentes so quando houve
 * (e negativos quando nao houve, ver `utils/matchMetrics/turningPoint.ts`) — somar ou tirar
 * media disso nao diz nada. Os dois grupos ficam FORA de `ACCOUNT_TOTAL_FIELDS`.
 *
 * RECORDES. `/players/{id}/matches?sort=<campo>&limit=1` — uma chamada por campo, entao a
 * lista é curta e o resultado fica em cache por um dia.
 */
import { openDotaGet } from './opendota';
import { readStatsCache, statsCacheKey, writeStatsCache } from './statsCache';

/** Campos de `/totals` que somam e tem media com sentido, na ordem de exibicao sugerida. */
export const ACCOUNT_TOTAL_FIELDS = [
  'kills',
  'deaths',
  'assists',
  'gold_per_min',
  'xp_per_min',
  'last_hits',
  'denies',
  'lane_efficiency_pct',
  'duration',
  'level',
  'hero_damage',
  'tower_damage',
  'hero_healing',
  'stuns',
  'tower_kills',
  'neutral_kills',
  'courier_kills',
  'purchase_tpscroll',
  'purchase_ward_observer',
  'purchase_ward_sentry',
  'purchase_gem',
  'purchase_rapier',
  'pings',
  'actions_per_min',
] as const;
export type AccountTotalField = (typeof ACCOUNT_TOTAL_FIELDS)[number];

export interface AccountTotal {
  field: AccountTotalField;
  /** Partidas em que o campo existe — a amostra desta linha. */
  matches: number;
  sum: number;
  /** `sum / matches`; `null` com amostra zero. */
  average: number | null;
}

/** `/totals` -> so os campos de `ACCOUNT_TOTAL_FIELDS`, na ordem deles. Pura. */
export function mapAccountTotals(raw: unknown): AccountTotal[] {
  if (!Array.isArray(raw)) return [];
  const byField = new Map<string, { n: number; sum: number }>();
  for (const r of raw) {
    if (typeof r?.field !== 'string') continue;
    const n = typeof r.n === 'number' && Number.isFinite(r.n) ? r.n : 0;
    const sum = typeof r.sum === 'number' && Number.isFinite(r.sum) ? r.sum : 0;
    byField.set(r.field, { n, sum });
  }
  const out: AccountTotal[] = [];
  for (const field of ACCOUNT_TOTAL_FIELDS) {
    const v = byField.get(field);
    if (!v) continue;
    out.push({ field, matches: v.n, sum: v.sum, average: v.n > 0 ? v.sum / v.n : null });
  }
  return out;
}

/** Categorias de `/counts`. `lane_role` 0 é "sem rota": partida nao analisada, nao uma rota. */
export const ACCOUNT_COUNT_CATEGORIES = ['patch', 'game_mode', 'lobby_type', 'lane_role', 'is_radiant', 'region', 'leaver_status'] as const;
export type AccountCountCategory = (typeof ACCOUNT_COUNT_CATEGORIES)[number];

export interface AccountCountEntry {
  /** A chave crua da OpenDota (id do patch, do modo, da rota...). */
  key: string;
  games: number;
  wins: number;
  /** Percentual, uma casa; `null` com zero partidas. */
  winRate: number | null;
}

export type AccountCounts = Record<AccountCountCategory, AccountCountEntry[]>;

/** `/counts` -> por categoria, mais jogado primeiro. `lane_role` 0 sai (nao é rota). Pura. */
export function mapAccountCounts(raw: unknown): AccountCounts {
  const out = Object.fromEntries(ACCOUNT_COUNT_CATEGORIES.map((c) => [c, [] as AccountCountEntry[]])) as AccountCounts;
  if (!raw || typeof raw !== 'object') return out;
  for (const cat of ACCOUNT_COUNT_CATEGORIES) {
    const group = (raw as any)[cat];
    if (!group || typeof group !== 'object') continue;
    const entries: AccountCountEntry[] = [];
    for (const [key, v] of Object.entries(group as Record<string, any>)) {
      if (cat === 'lane_role' && key === '0') continue;
      const games = typeof v?.games === 'number' ? v.games : 0;
      const wins = typeof v?.win === 'number' ? v.win : 0;
      if (games <= 0) continue;
      entries.push({ key, games, wins, winRate: parseFloat(((wins / games) * 100).toFixed(1)) });
    }
    out[cat] = entries.sort((a, b) => b.games - a.games || a.key.localeCompare(b.key));
  }
  return out;
}

/** Campos com recorde: o maior valor numa partida. `deaths` fica fora — maior nao é recorde. */
export const ACCOUNT_RECORD_FIELDS = [
  'kills',
  'assists',
  'gold_per_min',
  'xp_per_min',
  'last_hits',
  'denies',
  'hero_damage',
  'tower_damage',
  'hero_healing',
  'duration',
] as const;
export type AccountRecordField = (typeof ACCOUNT_RECORD_FIELDS)[number];

export interface AccountRecord {
  field: AccountRecordField;
  value: number;
  matchId: string;
  heroId: number;
  /** Unix (s). */
  startTime: number | null;
  won: boolean;
}

/** Uma resposta de `matches?sort=<campo>&limit=1` -> o recorde, ou `null` sem linha valida. Pura. */
export function mapAccountRecord(field: AccountRecordField, rows: unknown): AccountRecord | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const m = rows[0];
  const value = m?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || m?.match_id == null) return null;
  return {
    field,
    value,
    matchId: String(m.match_id),
    heroId: typeof m.hero_id === 'number' ? m.hero_id : 0,
    startTime: typeof m.start_time === 'number' ? m.start_time : null,
    won: (typeof m.player_slot === 'number' ? m.player_slot < 128 : false) === !!m.radiant_win,
  };
}

export function accountRecordEndpoint(accountId: number, field: AccountRecordField): string {
  const project = [field, 'hero_id', 'start_time', 'player_slot', 'radiant_win'].map((f) => `project=${f}`).join('&');
  return `players/${accountId}/matches?sort=${field}&limit=1&${project}`;
}

const validId = (id: string): number | null => {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
};

/** Totais da conta. `null` em falha de rede. */
export async function fetchAccountTotals(steamAccountId: string): Promise<AccountTotal[] | null> {
  const id = validId(steamAccountId);
  if (id === null) return null;
  const raw = await openDotaGet<any[]>(`players/${id}/totals`);
  return Array.isArray(raw) ? mapAccountTotals(raw) : null;
}

/** Contagens por patch, modo, fila, rota, lado, regiao e abandono. `null` em falha de rede. */
export async function fetchAccountCounts(steamAccountId: string): Promise<AccountCounts | null> {
  const id = validId(steamAccountId);
  if (id === null) return null;
  const raw = await openDotaGet<any>(`players/${id}/counts`);
  return raw && typeof raw === 'object' ? mapAccountCounts(raw) : null;
}

/**
 * Recordes da conta, um por campo pedido. Uma chamada por campo (a OpenDota limita a 60 por
 * minuto), duas por vez, com cache de um dia por conta. Campo cujo pedido falhou sai da lista;
 * `null` so se TODOS falharam.
 */
export async function fetchAccountRecords(
  steamAccountId: string,
  fields: readonly AccountRecordField[] = ACCOUNT_RECORD_FIELDS,
): Promise<AccountRecord[] | null> {
  const id = validId(steamAccountId);
  if (id === null) return null;
  // O cache comum vale 7 dias; o dia na chave encurta para um, sem mexer no `statsCache`.
  const day = Math.floor(Date.now() / 86_400_000);
  const key = statsCacheKey(['od-account-records', id, day, fields.join(',')]);
  const cached = readStatsCache<AccountRecord[]>(key);
  if (cached) return cached;

  const results: Array<AccountRecord | null | undefined> = new Array(fields.length);
  let failures = 0;
  const queue = fields.map((f, i) => [f, i] as const);
  const worker = async () => {
    while (queue.length) {
      const [field, i] = queue.shift()!;
      const rows = await openDotaGet<any[]>(accountRecordEndpoint(id, field));
      if (!Array.isArray(rows)) failures++;
      results[i] = Array.isArray(rows) ? mapAccountRecord(field, rows) : undefined;
    }
  };
  await Promise.all([worker(), worker()]);
  if (failures === fields.length) return null;
  const records = results.filter((r): r is AccountRecord => !!r);
  // So cacheia resposta completa: falha parcial nao pode congelar um recorde faltando por um dia.
  if (failures === 0) writeStatsCache(key, records);
  return records;
}
