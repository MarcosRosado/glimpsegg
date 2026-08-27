import { HEROES_MAP } from '../../constants/heroes';
import type {
  HeroScore,
  HeroScoreBreakdown,
  MetaWinrate,
  NoDataReason,
  PersonalWinrate,
  RankingCriterion,
} from '../../types/heroGrid';
import { wilsonLowerBound } from '../insights/wilson';

/**
 * Nota combinada do layout espelho de herois (specs/001-meta-hero-grid,
 * `contracts/meta-sources.md § 4`).
 *
 * Modulo 100% PURO: sem rede, sem `Date.now()`, sem I/O, sem cache. Recebe os agregados
 * ja buscados e devolve `HeroScore[]`. É o que permite testar as invariantes I-15 a I-19
 * sem levantar nada — a busca mora em `services/heroGrid/`, o espelhamento em
 * `mirrorBuilder.ts`.
 *
 * A formula, literal do contrato:
 *
 * ```
 * metaComponent     = wilsonLowerBound(wins, matchCount)
 * personalComponent = wilsonLowerBound(playerWins, playerGames)
 * personalWeight    = playerGames / (playerGames + K)
 * score             = (1 - personalWeight) * metaComponent + personalWeight * personalComponent
 * ```
 *
 * `wilsonLowerBound` vem de `utils/insights/wilson.ts`, que JA existe e ja é testado —
 * zero dependencia nova. É a funcao que o projeto adotou justamente para amostra pequena
 * nao virar recomendacao confiante (FR-019, I-19): 3 vitorias em 3 partidas valem ~0,44,
 * nao 1,00, e por isso nao passam na frente de 730/1000 (~0,70).
 *
 * ## A doutrina: nunca inventar dado
 *
 * Amostra zero NAO é 0% de winrate. `wilsonLowerBound(0, 0)` devolve 0, que seria um
 * "0% de vitorias" fabricado e ordenaria o heroi como se fosse comprovadamente ruim. Por
 * isso `matchCount === 0` e `games === 0` sao tratados como AUSENCIA de dado aqui, antes
 * de qualquer calculo, e viram `null` no componente correspondente.
 */

/* ------------------------------------------------------------------ *
 * A constante de encolhimento
 * ------------------------------------------------------------------ */

/**
 * Constante de encolhimento do componente pessoal (`K` do contrato).
 *
 * A escolha: **20 jogos é onde o historico do jogador passa a pesar tanto quanto o meta.**
 * A curva que `games / (games + 20)` produz — e que
 * `contracts/meta-sources.md § 4` publica como contrato:
 *
 * | Jogos do jogador com o heroi | Peso do componente pessoal |
 * | --- | --- |
 * | 0   | 0,00 |
 * | 3   | 0,13 |
 * | 10  | 0,33 |
 * | 20  | 0,50 |
 * | 50  | 0,71 |
 * | 100 | 0,83 |
 *
 * Abaixo de uns 5 jogos o pessoal quase nao move a ordem, que é o comportamento que
 * FR-030a pede; acima de 50 o meta vira contexto e a experiencia do jogador domina, que é
 * o que faz a nota combinada valer a pena.
 *
 * **Ajustar `K` é ajustar uma constante documentada, nao reescrever a formula.** Mas a
 * tabela acima é o que `ranking.test.ts` ancora: mexer em `K` sem mexer na tabela do
 * contrato deixa o teste de monotonicidade vermelho de proposito.
 */
export const PERSONAL_WEIGHT_K = 20;

/* ------------------------------------------------------------------ *
 * Entrada
 * ------------------------------------------------------------------ */

export interface RankingInput {
  /**
   * Herois a pontuar, na ordem que o chamador quiser. A saida sai NA MESMA ORDEM — quem
   * ordena é o `mirrorBuilder`, porque a ordenacao estavel de "sem dado" ao fim do grupo
   * (I-9) depende da ordem que os ids tinham na origem, informacao que só ele tem.
   */
  heroIds: readonly number[];
  criterion: RankingCriterion;
  /** Agregado de meta por heroi. Heroi ausente da lista => sem meta. */
  meta: readonly MetaWinrate[];
  /** Historico do jogador. Ausente inteiro => `COMBINED` opera como `META_ONLY` (FR-030c). */
  personal?: readonly PersonalWinrate[];
}

/* ------------------------------------------------------------------ *
 * Peso pessoal
 * ------------------------------------------------------------------ */

/**
 * Peso do componente pessoal para `games` partidas. I-16: monotonico nao decrescente, e
 * exatamente `0` quando `games === 0`.
 *
 * Entrada invalida (negativa, `NaN`, `Infinity`) cai em `0`: aqui `0` significa "nao
 * aplicar o pessoal", que é a degradacao honesta. Sem essa guarda, `Infinity / Infinity`
 * viraria `NaN` e contaminaria a nota inteira.
 */
export function personalWeight(games: number): number {
  if (!Number.isFinite(games) || games <= 0) return 0;
  return games / (games + PERSONAL_WEIGHT_K);
}

/* ------------------------------------------------------------------ *
 * Coerencia do breakdown (I-15)
 * ------------------------------------------------------------------ */

/**
 * Reaplica a formula sobre o `breakdown` e devolve a nota.
 *
 * Existe para que I-15 ("`breakdown` completo e COERENTE com `score`") seja verificavel de
 * verdade, e nao só "o campo esta presente": o teste recalcula a nota a partir do
 * breakdown exibido e compara com a nota devolvida. Componente `null` entra como 0 porque
 * o peso do lado ausente é sempre 0 — nenhum caminho deste modulo produz peso > 0 com
 * `personalComponent === null`, nem peso < 1 com `metaComponent === null`.
 */
export function recomputeScoreFromBreakdown(breakdown: HeroScoreBreakdown): number {
  const w = breakdown.personalWeight;
  return (1 - w) * (breakdown.metaComponent ?? 0) + w * (breakdown.personalComponent ?? 0);
}

/* ------------------------------------------------------------------ *
 * Ordenacao
 * ------------------------------------------------------------------ */

/**
 * Comparador para o `mirrorBuilder`: nota maior primeiro, "sem dado" ao fim.
 *
 * Dois "sem dado" devolvem `0` DE PROPOSITO. Com `Array.prototype.sort` (estavel desde
 * ES2019) empate preserva a ordem de entrada, que é exatamente o que I-9 exige: heroi sem
 * dado vai para o fim do grupo mantendo a ordem relativa que tinha na origem. Desempatar
 * por `heroId` aqui embaralharia o grid do jogador sem motivo.
 */
export function compareHeroScores(a: HeroScore, b: HeroScore): number {
  if (a.score === null && b.score === null) return 0;
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return b.score - a.score;
}

/* ------------------------------------------------------------------ *
 * Nota por heroi
 * ------------------------------------------------------------------ */

/** `null` quando a amostra nao sustenta nenhuma afirmacao. Nunca 0% fabricado. */
function metaComponentOf(meta: MetaWinrate | undefined): number | null {
  if (!meta) return null;
  if (!Number.isFinite(meta.matchCount) || meta.matchCount <= 0) return null;
  if (!Number.isFinite(meta.wins)) return null;
  return wilsonLowerBound(meta.wins, meta.matchCount);
}

/** Idem para o pessoal: `games === 0` é "nunca jogou", nao "perdeu todas". */
function personalComponentOf(personal: PersonalWinrate | undefined): number | null {
  if (!personal) return null;
  if (!Number.isFinite(personal.games) || personal.games <= 0) return null;
  if (!Number.isFinite(personal.wins)) return null;
  return wilsonLowerBound(personal.wins, personal.games);
}

function noData(
  heroId: number,
  criterion: RankingCriterion,
  reason: NoDataReason,
  breakdown: HeroScoreBreakdown,
  meta?: MetaWinrate,
  personal?: PersonalWinrate,
): HeroScore {
  // FR-030b / I-15: `breakdown` sai em TODO caminho, inclusive no de nota nula — nota sem
  // breakdown nao é exibivel, e um `HeroScore` sem ele obrigaria a UI a se defender.
  const out: HeroScore = { heroId, score: null, breakdown, criterion, noDataReason: reason };
  if (meta) out.meta = meta;
  if (personal) out.personal = personal;
  return out;
}

/**
 * Pontua um heroi. Exportada porque é a unidade que os testes e a UI de detalhe usam.
 *
 * As tres decisoes de criterio, e por que sao diferentes entre si:
 *
 * - `COMBINED` sem pessoal utilizavel => nota é o **meta puro**, `personalWeight === 0`,
 *   `personalComponent === null`. NAO vira `null` (I-17): o app opera como `META_ONLY`,
 *   rotulado (FR-030c), e é o `personalWeight === 0` junto do `personalComponent === null`
 *   que permite a UI dizer "sem seu historico neste heroi".
 * - `PERSONAL_ONLY` sem pessoal => `score === null` com
 *   `noDataReason: 'NO_PERSONAL_IN_PERSONAL_ONLY'` (I-18). **Nunca** cai para o meta em
 *   silencio: o jogador pediu explicitamente o proprio desempenho, e devolver o meta com
 *   cara de nota pessoal seria inventar dado. É a diferenca deliberada em relacao a I-17.
 * - `META_ONLY` ignora o pessoal: `personalWeight === 0` sempre, entao o pessoal **nao
 *   entra na nota**. O `personalComponent` continua PREENCHIDO quando ha historico, porque
 *   FR-032 manda exibir a amostra pessoal por heroi e esconder o numero que o app tem em
 *   maos nao ajuda ninguem — a garantia de que ele nao contamina a ordem é o peso zero, e
 *   `recomputeScoreFromBreakdown` a torna verificavel.
 *
 * Simetricamente, em `PERSONAL_ONLY` o peso é `1` e o `metaComponent` fica preenchido para
 * exibicao sem entrar na nota. Assim a mesma formula do contrato descreve os tres
 * criterios, e I-15 vale nos tres sem caso especial.
 *
 * Sem meta em `COMBINED`/`META_ONLY` => `null` com `'NO_META'`, mesmo havendo pessoal: os
 * dois criterios prometem uma nota ancorada no meta, e trocar a ancora por baixo dos panos
 * mudaria o significado da coluna sem avisar.
 */
export function scoreHero(
  heroId: number,
  criterion: RankingCriterion,
  meta: MetaWinrate | undefined,
  personal: PersonalWinrate | undefined,
): HeroScore {
  const empty: HeroScoreBreakdown = { metaComponent: null, personalComponent: null, personalWeight: 0 };

  // L-5: id que o catalogo do app nao conhece é PRESERVADO e tratado como "sem dado".
  // A deteccao é pela ausencia em `HEROES_MAP`, e nao pelo retorno de `getHero()`, porque
  // `getHero()` SEMPRE devolve um fallback sintetico ("Hero #N") — usa-lo aqui faria todo
  // id desconhecido parecer conhecido.
  if (!Number.isFinite(heroId) || !HEROES_MAP[heroId]) {
    return noData(heroId, criterion, 'HERO_UNKNOWN', empty, meta, personal);
  }

  const metaComponent = metaComponentOf(meta);
  const personalComponent = personalComponentOf(personal);

  if (criterion === 'PERSONAL_ONLY') {
    if (personalComponent === null) {
      return noData(
        heroId,
        criterion,
        'NO_PERSONAL_IN_PERSONAL_ONLY',
        { metaComponent, personalComponent: null, personalWeight: 0 },
        meta,
        personal,
      );
    }
    const breakdown: HeroScoreBreakdown = { metaComponent, personalComponent, personalWeight: 1 };
    return build(heroId, criterion, breakdown, meta, personal);
  }

  if (metaComponent === null) {
    return noData(
      heroId,
      criterion,
      'NO_META',
      { metaComponent: null, personalComponent, personalWeight: 0 },
      meta,
      personal,
    );
  }

  // `META_ONLY` => peso zero. `COMBINED` sem pessoal utilizavel => peso zero tambem, e é
  // isso que faz a nota virar o meta puro (I-17) usando a formula, sem ramo separado.
  const weight =
    criterion === 'META_ONLY' || personalComponent === null ? 0 : personalWeight(personal?.games ?? 0);

  const breakdown: HeroScoreBreakdown = { metaComponent, personalComponent, personalWeight: weight };
  return build(heroId, criterion, breakdown, meta, personal);
}

function build(
  heroId: number,
  criterion: RankingCriterion,
  breakdown: HeroScoreBreakdown,
  meta?: MetaWinrate,
  personal?: PersonalWinrate,
): HeroScore {
  // A nota SAI do breakdown, e nao de um calculo paralelo: é assim que I-15 fica verdadeira
  // por construcao em vez de por disciplina de quem edita o arquivo depois.
  const out: HeroScore = { heroId, score: recomputeScoreFromBreakdown(breakdown), breakdown, criterion };
  if (meta) out.meta = meta;
  if (personal) out.personal = personal;
  return out;
}

/* ------------------------------------------------------------------ *
 * Ranking
 * ------------------------------------------------------------------ */

function firstByHeroId<T extends { heroId: number }>(rows: readonly T[] | undefined): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows ?? []) {
    // Primeira ocorrencia ganha: a precedencia de fontes ja foi resolvida antes
    // (`sourcePrecedence.ts`), então sobrescrever aqui inverteria silenciosamente a
    // decisao de FR-015.
    if (row && Number.isFinite(row.heroId) && !map.has(row.heroId)) map.set(row.heroId, row);
  }
  return map;
}

/**
 * Pontua a lista inteira. Devolve `HeroScore[]` NA ORDEM DE ENTRADA — o espelhamento e a
 * ordenacao final sao do `mirrorBuilder`, que consome esta saida e o `compareHeroScores`.
 */
export function rankHeroes(input: RankingInput): HeroScore[] {
  const metaByHero = firstByHeroId(input.meta);
  const personalByHero = firstByHeroId(input.personal);
  return (input.heroIds ?? []).map((heroId) =>
    scoreHero(heroId, input.criterion, metaByHero.get(heroId), personalByHero.get(heroId)),
  );
}
