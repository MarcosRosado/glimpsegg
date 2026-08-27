import type { MetaSource, SyncFreshness, SyncOutcome, SyncPhase, SyncRecord, SyncState } from '../../types/heroGrid';
import { clampSyncHistory, SYNC_STATE_DEFAULTS } from './preferences';

/**
 * Agendador da sincronizacao do layout espelho de herois
 * (specs/001-meta-hero-grid, data-model.md § 6 — a maquina de estados é o contrato literal).
 *
 * ## Por que 100% puro, com `now` por parametro
 *
 * NENHUMA funcao deste modulo lê o relogio: `now` (epoch ms) sempre entra por argumento.
 * Nao é preciosismo — é o que torna testavel, em milissegundos, o comportamento que de
 * outra forma exigiria esperar 24h ou mexer no relogio da maquina: fronteira exata das 24h,
 * app reaberto depois de 3 dias fechado (FR-023), relogio recuado por fuso/NTP/VM suspensa
 * (FR-029) e o teto do backoff (FR-028). O `Date.now()` real mora no hook
 * (`useHeroGridSync.ts`), num unico ponto, e desce por aqui como numero.
 *
 * ## O que este modulo NAO faz
 *
 * Nao lê arquivo, nao faz rede, nao arma timer e nao escreve config. Ele só DECIDE. Quem
 * age é o hook (timer de 5 minutos, verificacao na montagem — timer de 24h nao sobrevive a
 * hibernacao) e o main process (escrita do grid). A consequencia importante: nenhuma
 * funcao daqui pode reescrever o marcador de sincronizacao como efeito colateral, porque
 * nao há efeito colateral nenhum — toda transicao devolve um `SyncState` NOVO.
 *
 * ## I-20 (FR-002 / SC-001) — a invariante que este modulo prova
 *
 * `enabled === false` curto-circuita ANTES de qualquer olhada no estado: `syncPhase`
 * devolve `'OFF'`, `shouldSyncNow` devolve `false` e `nextDueAt` devolve `null`. Como é o
 * agendador que diz ao hook se há timer para armar e se há sincronizacao para disparar,
 * responder `OFF` aqui é o que garante zero leitura de arquivo e zero requisicao com a
 * feature desmarcada. É por isso que a checagem de `enabled` é a PRIMEIRA linha, e nao
 * uma condicao no meio do calculo.
 *
 * ## RUNNING é exclusivo, e nao é estado persistido
 *
 * `RUNNING` entra como parametro, nao como campo de `SyncState`, de proposito: estado de
 * execucao gravado em config sobreviveria a um crash no meio da sincronizacao e travaria o
 * agendador em `RUNNING` para sempre, sem nada para destravar. Ele vive na memoria do
 * renderer (uma ref no hook). E a exclusao mutua de verdade NAO é essa: a trava do
 * renderer é conveniencia, a garantia de que duas escritas nao acontecem juntas é a trava
 * do main process em `electron/heroGrid/gridFile.cjs` (FR-012), que compara os bytes antes
 * de gravar. Este modulo nao implementa trava de arquivo — nao é o lugar dela.
 */

/* ------------------------------------------------------------------ *
 * 1. Constantes de tempo
 * ------------------------------------------------------------------ */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** FR-022: uma sincronizacao por dia. É o intervalo entre SUCESSOS, nao entre tentativas. */
export const SYNC_INTERVAL_MS = 24 * HOUR_MS;

/** Um dia em ms, para converter a idade do espelho em dias (FR-024a). */
export const DAY_MS = 24 * HOUR_MS;

/**
 * FR-028: primeira espera depois de uma falha. 30 minutos porque a causa tipica é rede
 * momentaneamente fora ou limite de taxa da fonte — retentar em segundos só multiplicaria
 * o problema, e esperar horas na PRIMEIRA falha deixaria o espelho velho sem motivo.
 */
export const BACKOFF_BASE_MS = 30 * MINUTE_MS;

/**
 * Teto da espera. Sem teto, `2^(n-1)` viraria dias e depois `Infinity`, e o app pararia de
 * tentar para sempre — falha permanente disfarcada de espera. 6h mantem no maximo quatro
 * tentativas por dia, o que é discreto para as fontes e ainda recupera sozinho.
 */
export const BACKOFF_MAX_MS = 6 * HOUR_MS;

/**
 * A partir deste expoente a espera crua já passou de `BACKOFF_MAX_MS`, então nao há motivo
 * para continuar dobrando. Derivado das duas constantes acima em vez de escrito a mao para
 * nao virar numero magico que mente se alguem mudar o teto.
 *
 * É este limite que impede o overflow que a FR-028 esconde: `2 ** 49` multiplicado por
 * 30min daria 1e21, e com `n` maior, `Infinity` — e `Infinity` passaria pelo `Math.min`
 * como "espera infinita" apenas se o `min` fosse na ordem errada, mas nem chega a ser
 * calculado aqui.
 */
const BACKOFF_MAX_EXPONENT = Math.ceil(Math.log2(BACKOFF_MAX_MS / BACKOFF_BASE_MS));

/* ------------------------------------------------------------------ *
 * 2. Normalizacao do estado
 * ------------------------------------------------------------------ */

/**
 * `state` ausente lê como "nunca sincronizou".
 *
 * O hook chama o agendador antes de a config terminar de carregar (primeiro render), e
 * lancar ali deixaria a aba em branco em vez de mostrar "nunca sincronizado". Timestamp
 * invalido (`0`, negativo, `NaN`) e contador negativo tambem caem no neutro — a coercao
 * canonica é a de `preferences.ts`, aqui só se repete a rede de seguranca porque com
 * `strict: false` um `SyncState` montado a mao em outro modulo passa pelo compilador.
 */
function normalize(state?: SyncState | null): SyncState {
  const raw = state && typeof state === 'object' ? state : SYNC_STATE_DEFAULTS;
  return {
    lastSuccessfulSyncAt: asInstant(raw.lastSuccessfulSyncAt),
    lastAttemptAt: asInstant(raw.lastAttemptAt),
    consecutiveFailures: asFailureCount(raw.consecutiveFailures),
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function asInstant(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asFailureCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/* ------------------------------------------------------------------ *
 * 3. Backoff (FR-028)
 * ------------------------------------------------------------------ */

/**
 * Espera antes da proxima tentativa: `min(30min * 2^(n-1), 6h)`.
 *
 * `failures <= 0` devolve 0 — sem falha nao há espera, e é isso que faz o sucesso tirar o
 * estado do backoff imediatamente. O expoente é limitado por `BACKOFF_MAX_EXPONENT` ANTES
 * da potenciacao, nao depois: `2 ** (failures - 1)` com `failures` grande estoura para
 * `Infinity`, e um `Infinity` que escapasse daqui viraria "nunca mais tentar".
 */
export function backoffMs(failures: number): number {
  const count = asFailureCount(failures);
  if (count <= 0) return 0;
  const exponent = Math.min(count - 1, BACKOFF_MAX_EXPONENT);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
}

/* ------------------------------------------------------------------ *
 * 4. A maquina de estados (data-model.md § 6)
 * ------------------------------------------------------------------ */

/**
 * Em qual estado o agendamento esta, agora.
 *
 * ```text
 * qualquer  --(feature desligada)------------------> OFF      (nenhum timer, nenhuma requisicao)
 * qualquer  --(sincronizacao em curso)-------------> RUNNING  (exclusivo)
 * BACKOFF   --(now - lastAttempt >= espera)-------> DUE
 * IDLE      --(nunca sincronizou)-----------------> DUE
 * IDLE      --(now - last >= 24h)-----------------> DUE
 * IDLE      --(now < last, relogio recuou)--------> IDLE      (nao sincroniza, nao reescreve)
 * ```
 *
 * A ordem das checagens é o contrato: `OFF` vence tudo (I-20), `RUNNING` vence o resto
 * (exclusividade), e o backoff é avaliado antes do intervalo diario — enquanto há falha
 * pendente, quem manda no proximo horario é a espera crescente, nao as 24h.
 */
export function syncPhase(
  state: SyncState | null | undefined,
  now: number,
  enabled: boolean,
  running = false
): SyncPhase {
  // I-20 / FR-002 / SC-001: primeira linha, e sem olhar o estado. Feature desmarcada nao
  // arma timer, nao lê arquivo e nao faz requisicao.
  if (!enabled) return 'OFF';
  if (running) return 'RUNNING';

  const s = normalize(state);

  if (s.consecutiveFailures > 0 && s.lastAttemptAt !== null) {
    const waited = now - s.lastAttemptAt;
    // Relogio recuado com falha pendente (`lastAttemptAt` no futuro): a espera nunca
    // venceria e o agendador ficaria congelado em BACKOFF indefinidamente, o que a
    // segunda metade da FR-029 proibe. Libera UMA tentativa, que reescreve
    // `lastAttemptAt` com o instante atual e conserta a janela sozinha. A assimetria com
    // o marcador de sucesso logo abaixo é deliberada: `lastAttemptAt` é operacional e
    // descartavel, `lastSuccessfulSyncAt` é historico e nao se joga fora.
    if (waited < 0) return 'DUE';
    return waited >= backoffMs(s.consecutiveFailures) ? 'DUE' : 'BACKOFF';
  }

  if (s.lastSuccessfulSyncAt === null) return 'DUE';

  // FR-029 — relogio recuado: NAO é devido, e o marcador NAO é reescrito.
  //
  // Reescrever seria pior que o sintoma que corrige: um relogio que voltou (fuso trocado,
  // NTP corrigindo deriva, VM retomada de snapshot) transformaria um salto de relogio em
  // perda PERMANENTE do historico de sincronizacao — o app passaria a acreditar que
  // sincronizou num instante em que nao sincronizou, e "quantos dias desde a ultima"
  // (FR-024a) mentiria para sempre. Preferir nao sincronizar por uma janela é reversivel;
  // corromper o marcador nao é. Quando o relogio voltar ao normal, ou numa sincronizacao
  // manual, o fluxo se restabelece sem nenhuma intervencao.
  if (now < s.lastSuccessfulSyncAt) return 'IDLE';

  // FR-023: a comparacao é com o ULTIMO sucesso, nao com uma agenda de horarios previstos.
  // É isso que faz 3 dias fechado virar UMA sincronizacao devida, e nao tres acumuladas:
  // nao existe fila de execucoes pendentes para acumular, existe um unico marcador.
  //
  // `>=` e nao `>`: data-model.md § 6 escreve `now - last >= 24h` literalmente, e o lado
  // inclusivo evita o buraco em que um tique caindo exatamente na fronteira adiaria a
  // sincronizacao para a verificacao seguinte.
  return now - s.lastSuccessfulSyncAt >= SYNC_INTERVAL_MS ? 'DUE' : 'IDLE';
}

/** Atalho de leitura: só `DUE` autoriza disparar. `OFF`, `RUNNING` e `BACKOFF` nao. */
export function shouldSyncNow(
  state: SyncState | null | undefined,
  now: number,
  enabled: boolean,
  running = false
): boolean {
  return syncPhase(state, now, enabled, running) === 'DUE';
}

/**
 * Instante previsto para a proxima sincronizacao, ou `null`.
 *
 * `null` tem dois significados, os dois honestos na tela: feature desligada (I-20 — nao há
 * proxima, e a UI nao deve prometer uma) e nunca sincronizou (nao há de onde projetar; é
 * devido agora). Com falha pendente, a previsao sai do backoff, porque é ele que governa a
 * proxima tentativa. O valor pode estar no PASSADO quando o app ficou fechado — e é
 * proposital: a tela mostrar "previsto para 3 dias atras" é a forma visivel da FR-024a.
 */
export function nextDueAt(state: SyncState | null | undefined, enabled = true): number | null {
  if (!enabled) return null;
  const s = normalize(state);
  if (s.consecutiveFailures > 0 && s.lastAttemptAt !== null) {
    return s.lastAttemptAt + backoffMs(s.consecutiveFailures);
  }
  if (s.lastSuccessfulSyncAt === null) return null;
  return s.lastSuccessfulSyncAt + SYNC_INTERVAL_MS;
}

/**
 * Dias (com fracao) desde o ultimo sucesso. `null` = nunca sincronizou.
 *
 * Alimenta a FR-024a: espelho velho porque o app passou dias fechado tem de ser VISIVEL,
 * nao silencioso. Devolve fracao em vez de inteiro para a UI poder dizer "hoje" / "12h"
 * sem inventar arredondamento; quem formata decide o texto.
 *
 * Recorte em 0 com relogio recuado: a tela dizendo "-5 dias desde a ultima sincronizacao"
 * seria pior que nao dizer nada, e o marcador (que segue intacto, FR-029) continua correto.
 */
export function daysSinceLastSuccess(state: SyncState | null | undefined, now: number): number | null {
  const s = normalize(state);
  if (s.lastSuccessfulSyncAt === null) return null;
  const elapsed = now - s.lastSuccessfulSyncAt;
  return elapsed <= 0 ? 0 : elapsed / DAY_MS;
}

/** O cabecalho de frescor da aba (FR-024a / FR-026), num objeto só. */
export function syncFreshness(
  state: SyncState | null | undefined,
  now: number,
  enabled: boolean
): SyncFreshness {
  return {
    daysSinceLastSuccess: daysSinceLastSuccess(state, now),
    nextDueAt: nextDueAt(state, enabled),
  };
}

/* ------------------------------------------------------------------ *
 * 5. Transicoes: desfecho -> estado novo
 * ------------------------------------------------------------------ */

/** O que a sincronizacao apurou. Tudo opcional: falha tipica só tem `error`. */
export interface SyncAttemptDetails {
  sourcesUsed?: MetaSource[];
  sourcesFailed?: MetaSource[];
  heroesOrdered?: number;
  structureChanged?: boolean;
  /** S-2: mensagem, NUNCA token nem objeto de erro cru (header vaza na serializacao). */
  error?: string;
}

function asSourceList(value: unknown): MetaSource[] {
  return Array.isArray(value) ? (value.slice() as MetaSource[]) : [];
}

/**
 * Monta o `SyncRecord` do desfecho.
 *
 * I-23 (`outcome === 'FAILURE'` => o arquivo de grids NAO foi escrito) é uma garantia de
 * I/O, e a metade dura dela mora em `electron/heroGrid/gridFile.cjs` e no hook, que só
 * chama a escrita no caminho de sucesso/parcial. A metade que é do agendador é esta: o
 * registro de falha sai com `heroesOrdered: 0`, `structureChanged: false` e nenhuma fonte
 * em `sourcesUsed`, mesmo que quem chama passe numeros por engano. Assim nenhuma tela
 * consegue reportar escrita a partir de um desfecho de falha — o registro nao carrega
 * material para isso.
 */
export function buildSyncRecord(
  outcome: SyncOutcome,
  at: number,
  details: SyncAttemptDetails = {}
): SyncRecord {
  const failed = outcome === 'FAILURE';
  const record: SyncRecord = {
    at,
    outcome,
    sourcesUsed: failed ? [] : asSourceList(details.sourcesUsed),
    sourcesFailed: asSourceList(details.sourcesFailed),
    heroesOrdered: failed ? 0 : Math.max(0, Math.floor(details.heroesOrdered ?? 0)),
    structureChanged: failed ? false : details.structureChanged === true,
  };
  if (typeof details.error === 'string' && details.error.length > 0) {
    record.error = details.error;
  }
  return record;
}

/**
 * A transicao central: dado um `SyncOutcome`, devolve o `SyncState` NOVO.
 *
 * Nao muta o estado de entrada — o hook compara antes/depois para decidir o que persistir,
 * e mutar em silencio faria essa comparacao dar sempre "nada mudou".
 *
 * As tres regras, todas com requisito nomeado:
 *
 * - `lastAttemptAt := now` em TODO desfecho, falha inclusive. É ele que alimenta o backoff;
 *   sem avancar na falha, a espera seria medida de um instante velho e a retentativa sairia
 *   em rajada, contra FR-028.
 * - I-22 / FR-017: `lastSuccessfulSyncAt` só avanca em `outcome !== 'FAILURE'`. `PARTIAL` é
 *   sucesso para efeito de marcador porque o arquivo FOI escrito (tabela de degradacao de
 *   `contracts/meta-sources.md § 5`: só a OpenDota, sem token da STRATZ, é `PARTIAL` e
 *   grava). Tratar `PARTIAL` como falha faria o jogador sem token nunca ver o marcador
 *   avancar e o deixaria em backoff eterno.
 * - `consecutiveFailures`: zera em `SUCCESS`/`PARTIAL`, incrementa em `FAILURE`.
 *
 * C-5 (FR-036): o historico passa pelo `clampSyncHistory` de `preferences.ts` — mesmo corte
 * na leitura, na escrita e aqui, num unico lugar. O registro novo entra no FIM, porque a
 * ordem gravada é cronologica crescente e o corte é da cauda antiga.
 */
export function recordSyncOutcome(
  state: SyncState | null | undefined,
  outcome: SyncOutcome,
  now: number,
  details: SyncAttemptDetails = {}
): SyncState {
  const s = normalize(state);
  const failed = outcome === 'FAILURE';
  return {
    lastSuccessfulSyncAt: failed ? s.lastSuccessfulSyncAt : now,
    lastAttemptAt: now,
    consecutiveFailures: failed ? s.consecutiveFailures + 1 : 0,
    history: clampSyncHistory([...s.history, buildSyncRecord(outcome, now, details)]),
  };
}
