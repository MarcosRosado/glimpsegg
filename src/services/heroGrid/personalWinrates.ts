import { PersonalWinrate } from '../../types/heroGrid';

/**
 * Desempenho pessoal por heroi (contrato `meta-sources.md § 3`).
 *
 * `GET /api/players/{account_id}/heroes` da OpenDota: publico, sem token, uma requisicao.
 * Alimenta o componente pessoal da nota combinada (FR-030) e a amostra por heroi que
 * FR-032 manda exibir.
 *
 * Os dois caminhos de rede, no padrao curto de `services/opendota.ts`:
 * `window.api.openDotaFetch` no Electron, `fetch` direto no browser (`npm run dev`).
 */

/**
 * Forma medida da resposta (HTTP 200, 127 linhas, verificado em 2026-08-26). Os nomes de
 * campo sao snake_case e o de vitorias é `win`, NAO `wins` — dai o mapeamento explicito
 * abaixo em vez de spread.
 *
 * `{ hero_id, last_played, games, win, with_games, with_win, against_games, against_win }`
 *
 * `with_*` / `against_*` sao sinergia e confronto; fora de escopo aqui (FR-034 tirou
 * recorte por contexto), entao nao entram no `PersonalWinrate`.
 */
interface RawPlayerHeroRow {
  hero_id: number | string;
  games: number;
  win: number;
}

/**
 * TTL CURTO, de proposito diferente dos 7 dias do `statsCache`.
 *
 * O `statsCache` existe para agregado global de meta, que muda por patch — por isso ele
 * invalida por patch e guarda por uma semana. Historico do jogador é o oposto: muda todo
 * dia, e nao tem relacao com virada de patch. Cachear por 7 dias faria a nota combinada
 * ignorar as partidas da semana. 1 hora é o suficiente para abrir e fechar a aba varias
 * vezes sem repetir a requisicao, e curto o bastante para uma sessao de jogo aparecer.
 *
 * Implementado aqui mesmo, sem dependencia nova: memoria + `localStorage` quando existir
 * (no `environment: 'node'` do vitest e em qualquer caminho sem DOM ele simplesmente nao
 * existe, e o cache degrada para so memoria).
 */
const CACHE_PREFIX = 'glimpse_gridpersonal_v1:';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — ver comentario acima

interface Envelope {
  ts: number;
  data: PersonalWinrate[];
}

const memory = new Map<string, Envelope>();

function cacheKey(accountId: string): string {
  return CACHE_PREFIX + accountId;
}

function readCache(key: string): PersonalWinrate[] | null {
  const inMemory = memory.get(key);
  if (inMemory && Date.now() - inMemory.ts < CACHE_TTL_MS) return inMemory.data;

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope;
    if (!env || typeof env.ts !== 'number' || !Array.isArray(env.data)) return null;
    if (Date.now() - env.ts >= CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    memory.set(key, env);
    return env.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: PersonalWinrate[]): void {
  const env: Envelope = { ts: Date.now(), data };
  memory.set(key, env);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    /* cota estourada: segue so com memoria */
  }
}

/**
 * Parte pura: linhas cruas -> `PersonalWinrate[]`.
 *
 * `games === 0` é heroi nunca jogado. A entrada é MANTIDA com `games: 0`, porque FR-032
 * manda exibir a amostra e "0 partidas" é informacao real e util na tela. O que NAO se
 * inventa é o winrate: `winRate` fica `0` apenas como valor aritmetico degenerado de uma
 * divisao sem denominador, e NENHUMA camada acima deve leve-lo como "esse jogador perde
 * com esse heroi". Quem consome isso é a nota, e para ela o campo que decide é `games`:
 * `personalWeight = games / (games + K)` da 0 com `games: 0`, entao o componente pessoal
 * sai do calculo por peso zero e sobra o meta — sem estimativa, sem rotulo falso.
 */
export function mapPlayerHeroesToPersonal(rawRows: unknown): PersonalWinrate[] {
  const rows: any[] = Array.isArray(rawRows) ? rawRows : [];
  const out: PersonalWinrate[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as RawPlayerHeroRow;
    // `hero_id` vem como number na resposta medida, mas a OpenDota ja devolveu string em
    // outros endpoints — normalizar aqui é mais barato que descobrir na ordenacao.
    const heroId = typeof r.hero_id === 'number' ? r.hero_id : Number(r.hero_id);
    if (!Number.isFinite(heroId) || heroId <= 0) continue;

    const games = Number.isFinite(Number(r.games)) ? Math.max(0, Number(r.games)) : 0;
    const rawWins = Number.isFinite(Number(r.win)) ? Math.max(0, Number(r.win)) : 0;
    // Prende em [0, games] para `winRate` nunca sair de 0..1 com linha malformada.
    const wins = Math.min(rawWins, games);

    out.push({
      heroId,
      games,
      wins,
      winRate: games > 0 ? wins / games : 0,
    });
  }

  return out;
}

/**
 * Busca (ou le do cache de 1h) o desempenho pessoal do jogador.
 *
 * NUNCA lanca. Retorno:
 *
 * - `null` => AUSENCIA. Perfil nao configurado / sem `accountId`, ou a fonte nao
 *             respondeu. Nos dois casos o caminho a jusante é o mesmo e é NORMAL, nao
 *             erro: `COMBINED` opera como `META_ONLY` rotulado (FR-030c). É de proposito
 *             que os dois colapsam num valor: diferente do meta, onde a distincao
 *             "indisponivel vs sem dado" decide `PARTIAL` vs `FAILURE`, aqui nao existe
 *             decisao que dependa do motivo — o espelho é construido do mesmo jeito.
 * - `[]`   => conta valida cujo historico veio vazio (perfil privado, conta nova). Segue
 *             valendo como "sem dado pessoal", sem inventar nada.
 */
export async function fetchPersonalWinrates(
  accountId: string | number | null | undefined,
): Promise<PersonalWinrate[] | null> {
  const id = String(accountId ?? '').trim();
  // Ausencia limpa: sem perfil nao existe requisicao a fazer, e isso é caminho normal.
  if (!id) return null;

  const key = cacheKey(id);
  const cached = readCache(key);
  if (cached) return cached;

  const endpoint = `players/${encodeURIComponent(id)}/heroes`;
  let rawRows: any = null;

  try {
    if (window.api && typeof window.api.openDotaFetch === 'function') {
      const res = await window.api.openDotaFetch<any[]>(endpoint);
      if (res.success && Array.isArray(res.data)) {
        rawRows = res.data;
      }
    } else {
      const res = await fetch(`https://api.opendota.com/api/${endpoint}`);
      if (res.ok) {
        rawRows = await res.json();
      }
    }
  } catch (err) {
    console.warn('[heroGrid] OpenDota player heroes indisponivel:', err);
    return null;
  }

  // Fonte nao respondeu de forma utilizavel. Nao cacheia: ausencia cacheada impediria a
  // proxima tentativa dentro da hora.
  if (!Array.isArray(rawRows)) return null;

  const personal = mapPlayerHeroesToPersonal(rawRows);
  writeCache(key, personal);
  return personal;
}
