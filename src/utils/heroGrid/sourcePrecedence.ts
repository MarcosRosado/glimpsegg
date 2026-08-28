import type { MetaSource, MetaWinrate, SyncOutcome } from '../../types/heroGrid';
import { tierToBracket, type RankBracketBasic, type ResolvedBracket } from '../rankBracket';

/**
 * Resolucao de precedencia entre as duas fontes de meta da feature de layout espelho
 * (specs/001-meta-hero-grid, `contracts/meta-sources.md`). T055, T057 e T061.
 *
 * Modulo PURO: recebe as listas que `services/heroGrid/openDotaWinrates.ts` e
 * `services/heroGrid/stratzWinrates.ts` ja buscaram e devolve a resolucao. Nenhuma rede,
 * nenhum cache, nenhum acesso a config — é o que permite testar a degradacao inteira
 * (`SUCCESS`/`PARTIAL`/`FAILURE`) sem simular API.
 *
 * Ele tambem NAO decide texto de UI. Produz procedencia tipada (fonte, amostra, bracket e
 * a flag de honestidade) e a formatacao por locale acontece na UI, exatamente como
 * `insights/ruleText.ts` impede que uma regra de coaching carregue frase.
 *
 * ## Precedencia: OpenDota -> STRATZ (FR-015)
 *
 * FIXA, e nao escolhida pelo tamanho da amostra: a OpenDota vem primeiro porque é publica
 * e nao exige token, entao a feature funciona sem configuracao alguma (FR-015a). A STRATZ
 * PREENCHE heroi que a OpenDota nao devolveu. Cada linha que sai daqui carrega a fonte que
 * efetivamente prevaleceu — nenhuma camada acima infere fonte, mesma disciplina de
 * `BenchmarkSource` em `types/dota.ts`.
 *
 * ## Os tres estados de ausencia de uma fonte
 *
 * O envelope `MetaSourceInput` existe porque `MetaWinrate[] | null` juntaria situacoes que
 * a tabela de degradacao (contrato § 5) trata de forma diferente:
 *
 * - `OK`       — respondeu com linhas. Disponivel e contribuiu.
 * - `EMPTY`    — respondeu, sem linha nenhuma para o bracket. A fonte FUNCIONOU: nao é
 *                falha, nao entra em `sourcesFailed`, e nao dispara backoff. "Respondeu
 *                sem dados" nao é "nao respondeu".
 * - `NO_TOKEN` — I-21 / FR-015a: ausencia do token da STRATZ é fonte INDISPONIVEL, nao
 *                erro. Nunca sozinha causa `FAILURE`, e nao entra em `sourcesFailed`
 *                porque nao houve tentativa que pudesse falhar.
 * - `ERROR`    — rede/API falhou de fato. Esta, sim, entra em `sourcesFailed`.
 *
 * Sao os mesmos quatro literais de `StratzWinratesStatus`, de proposito: o envelope
 * daquele servico é estruturalmente aceito aqui sem adaptador e sem import de `services/`
 * para dentro de `utils/`. Para a convencao da OpenDota (`MetaWinrate[] | null`) existe
 * `openDotaSourceInput()`.
 */

/* ------------------------------------------------------------------ *
 * 1. Entrada
 * ------------------------------------------------------------------ */

export type MetaSourceStatus = 'OK' | 'EMPTY' | 'NO_TOKEN' | 'ERROR';

/**
 * O minimo que uma linha de fonte precisa trazer: heroi, vitorias e amostra.
 *
 * Sem `source`, sem `bracket` e sem flag de honestidade de proposito — esses tres sao
 * estampados AQUI, pela resolucao, nunca copiados do que a linha diz sobre si mesma. Uma
 * linha que chega pelo slot da STRATZ se autodeclarando `OPENDOTA_BRACKET` (bug de cache,
 * copiar/colar num mapper) faria a procedencia mentir, e procedencia que mente é pior que
 * procedencia ausente. `MetaWinrate` completo é estruturalmente aceito como entrada; os
 * campos extras sao simplesmente ignorados.
 */
export interface MetaSampleRow {
  heroId?: number | null;
  wins?: number | null;
  matchCount?: number | null;
  /** Ignorado: o winrate publicado é sempre recalculado de `wins / matchCount`. */
  winRate?: number | null;
  /** Preservado quando presente — reetiquetar patch seria falsear procedencia (I-12). */
  patch?: string | null;
}

export interface MetaSourceInput {
  status: MetaSourceStatus;
  /** Só `status: 'OK'` contribui linha. Vazio/ausente em todo o resto. */
  rows?: readonly MetaSampleRow[] | null;
  /** S-2: mensagem curta para exibir/logar. NUNCA carrega token. */
  reason?: string;
}

export interface ResolveMetaWinratesInput {
  openDota: MetaSourceInput;
  stratz: MetaSourceInput;
  /** Patch de `gameVersionService`, usado quando a linha nao traz o proprio (I-12). */
  patch: string;
  /** `HeroGridPreferences.bracket`: escolha explicita do jogador. `null` => derivar. */
  preferredBracket?: RankBracketBasic | null;
  /** Medalha do perfil (`floor(rank_tier / 10)`), para `tierToBracket`. */
  profileTier?: number | null;
  /** Brackets que a fonte segmenta. Default: `SEGMENTED_BRACKETS`. */
  supportedBrackets?: readonly RankBracketBasic[];
}

/* ------------------------------------------------------------------ *
 * 2. Saida
 * ------------------------------------------------------------------ */

export type UnavailableReason = 'NO_TOKEN' | 'ERROR';

/** Por que a fonte nao entrou. É o que a UI rotula em FR-016 ("qual faltou"). */
export interface SourceUnavailability {
  source: MetaSource;
  reason: UnavailableReason;
  message?: string;
}

export interface OutcomeClassification {
  outcome: SyncOutcome;
  /** I-24 / FR-017: `FAILURE` NAO escreve, e nao avanca `lastSuccessfulSyncAt`. */
  shouldWrite: boolean;
  /** Fontes que contribuiram pelo menos uma linha. */
  sourcesUsed: MetaSource[];
  /** So fonte TENTADA que FALHOU. Sem token nao entra aqui — ver `unavailable`. */
  sourcesFailed: MetaSource[];
  /** Tudo que nao respondeu (falha + sem token). O rotulo de FR-016 sai daqui. */
  sourcesMissing: MetaSource[];
  /** `sourcesMissing` com o motivo, porque `SyncRecord.sourcesFailed` nao distingue. */
  unavailable: SourceUnavailability[];
}

export interface MetaWinrateResolution extends OutcomeClassification {
  /** Uma linha por heroi COM dado. Heroi sem dado nao aparece (I-14). */
  winrates: MetaWinrate[];
  /** Mesmo conteudo indexado, para o ranking nao varrer o array por heroi. */
  byHeroId: Map<number, MetaWinrate>;
  /** Bracket efetivo + I-13. Com `isPlayerSpecific: false` a UI diz "media geral". */
  bracket: ResolvedBracket;
  patch: string;
  /** Linhas recusadas por malformacao. Diagnostico — nunca virou numero na tela. */
  discarded: number;
}

/* ------------------------------------------------------------------ *
 * 3. Bracket: FR-020 e I-13
 * ------------------------------------------------------------------ */

/**
 * Brackets que as fontes de meta realmente segmentam, na particao de `tierToBracket()`.
 *
 * `UNCALIBRATED` esta FORA: `/api/heroStats` da OpenDota nao publica bucket de nao
 * calibrado (os buckets 1..8 sao as oito medalhas), entao pedir esse recorte é pedir a
 * media geral. A STRATZ segmenta `UNCALIBRATED`, mas o grid usa UM ranque de referencia
 * para as duas fontes, e o denominador honesto é a interseccao — o resultado sai como
 * `ALL` rotulado, que é literalmente o que o jogador vai ver de qualquer forma.
 *
 * `ALL` tambem esta fora porque nao é segmento: é o destino da degradacao de FR-020.
 */
export const SEGMENTED_BRACKETS: readonly RankBracketBasic[] = [
  'HERALD_GUARDIAN',
  'CRUSADER_ARCHON',
  'LEGEND_ANCIENT',
  'DIVINE_IMMORTAL',
];

export interface BracketResolutionInput {
  preferredBracket?: RankBracketBasic | null;
  profileTier?: number | null;
  supportedBrackets?: readonly RankBracketBasic[];
}

/**
 * Ranque de referencia efetivo. Ordem: escolha do jogador -> medalha do perfil -> `ALL`.
 *
 * Nao usa `resolveBracket()` de `rankBracket.ts` de proposito: aquela funcao recebe
 * `MatchDetails`/`MatchPlayer`, e esta feature nao tem partida nenhuma. O que se reusa é
 * `tierToBracket()` — a MESMA particao — e a disciplina de `ResolvedBracket`.
 *
 * FR-020: ranque pedido que a fonte nao segmenta cai em `ALL`, ROTULADO. Nunca silencioso.
 */
export function resolveMetaBracket(input: BracketResolutionInput = {}): ResolvedBracket {
  const supported = input.supportedBrackets ?? SEGMENTED_BRACKETS;

  // I-13 mora nesta funcao, e no unico lugar em que `isPlayerSpecific: true` é escrito:
  // a flag só pode ser `true` quando o bracket é um recorte REAL do ranque do jogador. Com
  // `false` a UI tem de dizer "media geral" e NUNCA "no seu ranque" — é regra de
  // honestidade, nao cosmetica, e é por isso que a degradacao de FR-020 devolve as duas
  // coisas juntas: cair em 'ALL' sem baixar a flag deixaria a tela chamando a media do
  // servidor inteiro de "seu ranque".
  const specific = (bracket: RankBracketBasic): ResolvedBracket =>
    bracket !== 'ALL' && supported.includes(bracket)
      ? { bracket, isPlayerSpecific: true }
      : { bracket: 'ALL', isPlayerSpecific: false };

  if (input.preferredBracket) return specific(input.preferredBracket);

  const tier = input.profileTier;
  if (typeof tier === 'number' && Number.isFinite(tier) && tier > 0) {
    return specific(tierToBracket(tier));
  }

  return { bracket: 'ALL', isPlayerSpecific: false };
}

/**
 * Tier da conta CONFIGURADA — o unico que pode derivar bracket.
 *
 * O `App` guarda DOIS steam ids: o configurado (a conta do dono) e o atualmente
 * visualizado, que a busca de jogadores pode apontar para qualquer um. O perfil carregado
 * segue o segundo. Passar o `seasonRank` dele para `resolveMetaBracket` fazia o espelho da
 * SUA conta ser ordenado pelo ranque de referencia de OUTRA pessoa, e gravado assim em
 * silencio: o winrate pessoal continuava certo (vem de `prefs.steamId3`), so o recorte de
 * meta trocava de dono.
 *
 * Devolver `null` quando o perfil nao é o da conta configurada é a degradacao honesta —
 * `resolveMetaBracket` cai em `{ bracket: 'ALL', isPlayerSpecific: false }` e a UI diz
 * "media geral", nunca "no seu ranque". A alternativa seria adivinhar a medalha do dono a
 * partir de quem esta na tela, que é exatamente o tipo de preenchimento que a doutrina
 * proibe.
 *
 * Fica aqui, e nao no `App.tsx`, porque `.tsx` nao tem teste neste projeto (vitest em
 * `environment: 'node'`) — e este é o calculo que ja errou uma vez.
 */
export interface ConfiguredTierInput {
  /** Steam id do perfil que esta carregado na tela. */
  profileSteamId?: string | null;
  /** Steam id da conta configurada, dona do layout espelho. */
  configuredSteamId?: string | null;
  /** `seasonRank` do perfil carregado: medalha*10 + estrelas. */
  seasonRank?: number | null;
}

export function configuredProfileTier(input: ConfiguredTierInput): number | null {
  const profileId = (input.profileSteamId ?? '').trim();
  const configuredId = (input.configuredSteamId ?? '').trim();

  // Id ausente dos dois lados nao é "iguais": sem conta configurada nao ha dono de espelho,
  // e comparar '' com '' daria o tier de qualquer perfil que estivesse aberto.
  if (!profileId || !configuredId || profileId !== configuredId) return null;

  const rank = input.seasonRank;
  if (typeof rank !== 'number' || !Number.isFinite(rank) || rank <= 0) return null;

  // `seasonRank` é medalha*10 + estrelas; o bracket vem de floor(rank/10).
  return Math.floor(rank / 10);
}

/* ------------------------------------------------------------------ *
 * 4. Degradacao (contrato § 5, I-21, I-24)
 * ------------------------------------------------------------------ */

/** Disponivel = RESPONDEU. `EMPTY` responde; sem token e erro nao. */
export function sourceAvailable(status: MetaSourceStatus): boolean {
  return status === 'OK' || status === 'EMPTY';
}

export interface ClassifyOutcomeInput {
  openDota: MetaSourceStatus;
  stratz: MetaSourceStatus;
  openDotaReason?: string;
  stratzReason?: string;
}

/**
 * Tabela de degradacao do contrato, como funcao pura:
 *
 * | Situacao                | outcome   | escreve |
 * | ---                     | ---       | ---     |
 * | as duas responderam     | `SUCCESS` | sim     |
 * | só uma respondeu        | `PARTIAL` | sim     |
 * | nenhuma respondeu       | `FAILURE` | NAO     |
 *
 * I-21: `NO_TOKEN` na STRATZ com a OpenDota de pé é `PARTIAL`, jamais `FAILURE` — a
 * feature conclui inteira só com a OpenDota e rotula.
 *
 * Duas fontes `EMPTY` dao `SUCCESS` com zero linhas, e isso é deliberado: as duas APIs
 * responderam, entao chamar isso de `FAILURE` zeraria `lastSuccessfulSyncAt` e ligaria o
 * backoff por causa de fonte saudavel. A escrita resultante é um no-op (todo heroi fica
 * "sem dado" e mantem a ordem relativa da origem, I-9), nao um layout inventado.
 */
export function classifyOutcome(input: ClassifyOutcomeInput): OutcomeClassification {
  const slots: { source: MetaSource; status: MetaSourceStatus; reason?: string }[] = [
    { source: 'OPENDOTA_BRACKET', status: input.openDota, reason: input.openDotaReason },
    { source: 'STRATZ_BRACKET', status: input.stratz, reason: input.stratzReason },
  ];

  const sourcesUsed: MetaSource[] = [];
  const sourcesFailed: MetaSource[] = [];
  const sourcesMissing: MetaSource[] = [];
  const unavailable: SourceUnavailability[] = [];
  let available = 0;

  for (const slot of slots) {
    if (sourceAvailable(slot.status)) {
      available += 1;
      // `EMPTY` fica fora de TODAS as listas: nao contribuiu (nao é "usada") e nao falhou
      // (nao é "faltou"). É o estado que o resto do app nao precisa rotular.
      if (slot.status === 'OK') sourcesUsed.push(slot.source);
      continue;
    }

    sourcesMissing.push(slot.source);
    const reason: UnavailableReason = slot.status === 'NO_TOKEN' ? 'NO_TOKEN' : 'ERROR';
    if (reason === 'ERROR') sourcesFailed.push(slot.source);
    unavailable.push(slot.reason ? { source: slot.source, reason, message: slot.reason } : { source: slot.source, reason });
  }

  const outcome: SyncOutcome = available === 2 ? 'SUCCESS' : available === 1 ? 'PARTIAL' : 'FAILURE';

  return {
    outcome,
    shouldWrite: outcome !== 'FAILURE',
    sourcesUsed,
    sourcesFailed,
    sourcesMissing,
    unavailable,
  };
}

/**
 * Adaptador da convencao de `fetchOpenDotaMetaWinrates()`: `null` => a fonte nao
 * respondeu; `[]` => respondeu e o bracket é que esta vazio. Sem isso o chamador colapsaria
 * os dois em "sem dado" e a classificacao de `PARTIAL` vs `FAILURE` ficaria errada.
 */
export function openDotaSourceInput(
  result: readonly MetaSampleRow[] | null | undefined,
  reason?: string,
): MetaSourceInput {
  if (!result) return { status: 'ERROR', rows: [], reason };
  if (result.length === 0) return { status: 'EMPTY', rows: [] };
  return { status: 'OK', rows: result };
}

/* ------------------------------------------------------------------ *
 * 5. Validacao de linha: I-11, I-12, I-14
 * ------------------------------------------------------------------ */

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Linha crua -> `MetaWinrate`, ou `null` para DESCARTAR.
 *
 * Descarte, nao conserto. Cada recusa abaixo é uma invariante:
 *
 * - `matchCount <= 0` / ausente é AUSENCIA de dado, nao 0% (I-11 + I-14). Completar com
 *   zero mandaria o heroi para o fim do ranking como se tivesse sido medido e fosse ruim.
 * - `wins` ausente derruba a linha: winrate sem vitorias contadas viola I-11.
 * - `wins > matchCount` é dado impossivel. Fica FORA em vez de ser truncado, porque
 *   truncar produziria um `winRate` de 100% que nunca foi medido.
 * - sem `patch` (nem na linha, nem na resolucao) a linha nao é publicavel (I-12): é o
 *   patch que faz o dado vencer em FR-021, e um numero sem patch nunca vence.
 *
 * `winRate` é sempre recalculado de `wins / matchCount`. O campo que a entrada trouxer é
 * ignorado — o que a fonte mediu sao os dois contadores; a razao é derivada deles.
 */
function normalizeRow(
  raw: MetaSampleRow | null | undefined,
  source: MetaSource,
  bracket: ResolvedBracket,
  fallbackPatch: string,
): MetaWinrate | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!isPositiveInt(raw.heroId)) return null;
  if (!isPositiveInt(raw.matchCount)) return null;

  const wins = raw.wins;
  if (typeof wins !== 'number' || !Number.isFinite(wins) || wins < 0) return null;
  if (wins > raw.matchCount) return null;

  const patch = typeof raw.patch === 'string' && raw.patch.length > 0 ? raw.patch : fallbackPatch;
  if (typeof patch !== 'string' || patch.length === 0) return null;

  return {
    heroId: raw.heroId,
    source,
    winRate: wins / raw.matchCount,
    wins,
    matchCount: raw.matchCount,
    bracket: bracket.bracket,
    bracketIsPlayerSpecific: bracket.isPlayerSpecific,
    patch,
  };
}

/* ------------------------------------------------------------------ *
 * 6. A resolucao
 * ------------------------------------------------------------------ */

/**
 * Aplica a precedencia OpenDota -> STRATZ e classifica o desfecho.
 *
 * `status: 'OK'` sem NENHUMA linha aproveitavel é rebaixado para `EMPTY` antes da
 * classificacao: a fonte respondeu (nao falhou), mas nao pode entrar em `sourcesUsed`
 * porque nao sustentou uma unica linha. O rebaixamento é derivado das linhas, nunca
 * declarado pelo chamador — é assim que "respondeu sem dados" e "nao respondeu" continuam
 * sendo estados diferentes sem depender de quem chama acertar o rotulo.
 */
export function resolveMetaWinrates(input: ResolveMetaWinratesInput): MetaWinrateResolution {
  const bracket = resolveMetaBracket(input);
  const patch = input.patch;

  const byHeroId = new Map<number, MetaWinrate>();
  const winrates: MetaWinrate[] = [];
  let discarded = 0;

  // A ordem deste array É a precedencia (FR-015). A OpenDota vem primeiro porque nao
  // exige token; a STRATZ só ocupa heroi que ficou vago.
  const slots: { source: MetaSource; input: MetaSourceInput }[] = [
    { source: 'OPENDOTA_BRACKET', input: input.openDota },
    { source: 'STRATZ_BRACKET', input: input.stratz },
  ];

  const contributed: Record<string, boolean> = {};

  for (const slot of slots) {
    contributed[slot.source] = false;
    // Fonte que nao respondeu nao contribui linha, mesmo que o envelope traga sobra de
    // payload: dado de uma tentativa que falhou nao tem procedencia defensavel.
    if (slot.input?.status !== 'OK') continue;

    for (const raw of slot.input.rows ?? []) {
      const line = normalizeRow(raw, slot.source, bracket, patch);
      if (!line) {
        discarded += 1;
        continue;
      }
      // Precedencia: quem chegou primeiro fica. Vale tanto entre fontes quanto para
      // heroId repetido dentro da mesma fonte.
      if (byHeroId.has(line.heroId)) continue;
      byHeroId.set(line.heroId, line);
      winrates.push(line);
      contributed[slot.source] = true;
    }
  }

  const effective = (slot: MetaSourceInput, source: MetaSource): MetaSourceStatus => {
    const status = slot?.status ?? 'ERROR';
    return status === 'OK' && !contributed[source] ? 'EMPTY' : status;
  };

  const classification = classifyOutcome({
    openDota: effective(input.openDota, 'OPENDOTA_BRACKET'),
    stratz: effective(input.stratz, 'STRATZ_BRACKET'),
    openDotaReason: input.openDota?.reason,
    stratzReason: input.stratz?.reason,
  });

  // I-24 / FR-017: sem nenhuma fonte, nada é publicado. Devolver as linhas aqui deixaria
  // um chamador distraido escrever o arquivo a partir de um `FAILURE`.
  if (classification.outcome === 'FAILURE') {
    byHeroId.clear();
    winrates.length = 0;
  }

  return { ...classification, winrates, byHeroId, bracket, patch, discarded };
}
