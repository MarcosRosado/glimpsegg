import { MetaWinrate } from '../../types/heroGrid';
import { RankBracketBasic } from '../../utils/rankBracket';
import { getCachedGamePatch } from '../gameVersionService';
import { fetchOpenDotaHeroStats } from '../opendota';
import { readStatsCache, statsCacheKey, writeStatsCache } from '../statsCache';

/**
 * Fonte PRIMARIA de meta do layout espelho (FR-015).
 *
 * Vem primeiro porque nao exige token, custa 1 requisicao e reaproveita
 * `fetchOpenDotaHeroStats()`, que ja existe e ja cobre os dois caminhos de rede
 * (`window.api.openDotaFetch` no Electron, `fetch` direto no browser). É o que faz a
 * feature fechar sem configuracao nenhuma (FR-015a): sem chave da STRATZ o espelho
 * continua sendo construido, rotulado como PARTIAL.
 *
 * O trabalho deste modulo é so somar os buckets de rank tier de `/api/heroStats` na
 * particao de bracket que o app ja usa. Nenhuma inferencia, nenhum preenchimento.
 */

/**
 * Buckets `N_pick`/`N_win` de `/api/heroStats` somados por bracket.
 *
 * É a MESMA PARTICAO que `tierToBracket()` (`utils/rankBracket.ts`) aplica sobre a
 * medalha do jogador: tier <= 2 Herald/Guardian, <= 4 Crusader/Archon, <= 6
 * Legend/Ancient, o resto Divine/Immortal. Escrita aqui como tabela de literais
 * explicitos justamente para o app NAO ganhar vocabulario novo de ranque — se a
 * particao mudar, muda nos dois lugares e o teste quebra.
 *
 * `UNCALIBRATED` nao aparece: `/api/heroStats` nao publica bucket de nao calibrado
 * (os buckets 1..8 sao as oito medalhas), entao pedir esse bracket cai em 1..8, isto é,
 * o mesmo que `ALL` — e o resultado sai com `bracketIsPlayerSpecific: false`, porque a
 * UI nao pode chamar media geral de "no seu ranque" (I-13).
 */
const BRACKET_BUCKETS: Record<RankBracketBasic, number[]> = {
  HERALD_GUARDIAN: [1, 2],
  CRUSADER_ARCHON: [3, 4],
  LEGEND_ANCIENT: [5, 6],
  DIVINE_IMMORTAL: [7, 8],
  ALL: [1, 2, 3, 4, 5, 6, 7, 8],
  UNCALIBRATED: [1, 2, 3, 4, 5, 6, 7, 8],
};

/** Brackets que representam de fato o ranque do jogador (I-13 / FR-020). */
function isPlayerSpecific(bracket: RankBracketBasic): boolean {
  return bracket !== 'ALL' && bracket !== 'UNCALIBRATED';
}

function finiteNonNegative(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Parte pura: linhas cruas de `/api/heroStats` -> `MetaWinrate[]`.
 *
 * Exportada porque a soma de buckets é onde I-11, I-12 e I-14 se decidem, e testar isso
 * com mock de rede esconderia justamente o erro que importa (trocar um indice de bucket).
 *
 * A REGRA QUE MAIS IMPORTA: bucket com `pick === 0` é AUSENCIA DE DADO, nao 0% de
 * winrate. Um heroi sem pick no bracket pedido NAO entra no array — ele ganha ausencia,
 * e a nota trata como "sem dado" (I-14, FR-018). Preencher com zero deixaria a tela mais
 * completa e mandaria o heroi para o fim do ranking como se fosse medido e ruim, que é
 * exatamente a regressao que a doutrina do projeto proibe.
 */
export function mapHeroStatsToWinrates(
  rawRows: unknown,
  bracket: RankBracketBasic,
  patch: string,
): MetaWinrate[] {
  const rows: any[] = Array.isArray(rawRows) ? rawRows : [];
  const buckets = BRACKET_BUCKETS[bracket] || BRACKET_BUCKETS.ALL;
  const playerSpecific = isPlayerSpecific(bracket);
  const out: MetaWinrate[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    // `id` é o heroId em `/api/heroStats`. Linha sem id nao é enderecavel: pular.
    const heroId = typeof row.id === 'number' ? row.id : Number(row.id);
    if (!Number.isFinite(heroId) || heroId <= 0) continue;

    let matchCount = 0;
    let wins = 0;
    for (const b of buckets) {
      matchCount += finiteNonNegative(row[`${b}_pick`]);
      wins += finiteNonNegative(row[`${b}_win`]);
    }

    // Ausencia, nao zero (I-14). Sem amostra nao existe winrate para publicar.
    if (matchCount <= 0) continue;

    // Guarda de linha malformada: `_win` maior que `_pick` aconteceria por bug da fonte,
    // e deixar passar produziria winRate > 1, que a UI exibiria como "112%". Prender em
    // [0, matchCount] mantem `winRate` dentro de 0..1 sem inventar numero novo.
    const safeWins = Math.min(wins, matchCount);

    out.push({
      heroId,
      source: 'OPENDOTA_BRACKET',
      winRate: safeWins / matchCount,
      wins: safeWins,
      matchCount,
      bracket,
      bracketIsPlayerSpecific: playerSpecific,
      patch,
    });
  }

  return out;
}

/**
 * Busca (ou le do cache) os winrates de meta da OpenDota para um bracket.
 *
 * NUNCA lanca para quem chama. O retorno distingue os dois estados que o chamador precisa
 * separar para classificar `PARTIAL` vs `FAILURE` (contrato § 5):
 *
 * - `null`  => FONTE INDISPONIVEL. Nao houve resposta utilizavel (rede fora, HTTP != 200,
 *              JSON quebrado). `fetchOpenDotaHeroStats()` colapsa erro em `[]`, e como o
 *              endpoint real sempre devolve 127 herois, uma resposta sem NENHUMA linha só
 *              acontece quando a fonte falhou — entao `[]` cru é lido como indisponivel.
 * - `[]`    => FONTE RESPONDEU, SEM DADO NESTE BRACKET. Vieram linhas de heroi, mas nenhum
 *              tem pick no bracket pedido. É resultado valido: a fonte funcionou, o
 *              bracket é que esta vazio, e isso NAO conta como falha de fonte.
 *
 * Cache pelo `statsCache` com a chave do contrato `['gridmeta','od',bracket]`. O
 * `heroStats` é o maior payload da feature (~164 KB medidos, 127 herois x 60 campos) e é
 * a invalidacao por patch do `statsCache` que cumpre FR-021 — guardamos o `MetaWinrate[]`
 * ja reduzido, nao as linhas cruas, para nao pagar 164 KB de localStorage por bracket.
 */
export async function fetchOpenDotaMetaWinrates(
  bracket: RankBracketBasic,
): Promise<MetaWinrate[] | null> {
  const key = statsCacheKey(['gridmeta', 'od', bracket]);

  const cached = readStatsCache<MetaWinrate[]>(key);
  if (cached && Array.isArray(cached)) return cached;

  let rawRows: any[] = [];
  try {
    rawRows = await fetchOpenDotaHeroStats();
  } catch (err) {
    // `fetchOpenDotaHeroStats` ja engole erro, mas o try existe para a promessa desta
    // funcao: falha de rede nunca sobe para quem chama.
    console.warn('[heroGrid] OpenDota heroStats indisponivel:', err);
    return null;
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    // Fonte indisponivel — ver a distincao documentada acima. Nao escreve cache: cachear
    // ausencia por 7 dias impediria a proxima sincronizacao de tentar de novo.
    return null;
  }

  const patch = getCachedGamePatch();
  const winrates = mapHeroStatsToWinrates(rawRows, bracket, patch);
  writeStatsCache(key, winrates);
  return winrates;
}
