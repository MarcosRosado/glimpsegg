import type { HeroScore } from '../../types/heroGrid';

/**
 * Formatacao pura da aba do layout espelho (specs/001-meta-hero-grid, T035/T047/T058/T064).
 *
 * Existe separado do `HeroGridTab.tsx` pelo mesmo motivo de `settingsOptions.ts`: o vitest
 * deste projeto roda em `environment: 'node'` e nao tem DOM, logo nenhum `.tsx` é testavel.
 * Toda decisao que um teste precisa exercitar — quantos dias se passaram, se a nota é
 * exibivel, em que ordem as linhas aparecem — mora aqui, e o componente fica so com o JSX.
 *
 * Nenhuma funcao daqui produz TEXTO traduzido: elas devolvem numero e discriminante, e a
 * escolha da chave i18n acontece na borda de render. É a mesma divisao do motor de coaching
 * (`insights/` emite valor cru, `ruleText.ts` mapeia para chave), e é o que permite testar
 * sem locale.
 */

/* ------------------------------------------------------------------ *
 * 1. "Quantos dias se passaram" (FR-024a)
 * ------------------------------------------------------------------ */

/**
 * `daysSinceLastSuccess` do `SyncFreshness` vem em FRACAO de dia — 0,5 é meio dia. A aba
 * precisa dizer "quantos dias", e arredondar para cima transformaria 20 minutos em "1 dia".
 *
 * - `NEVER` — nunca sincronizou com sucesso. NAO é "0 dias": zero dia soaria como
 *   "sincronizado hoje", que é exatamente a leitura errada que FR-024a existe para evitar;
 * - `TODAY` — menos de um dia inteiro;
 * - `ONE` / `MANY` — dias INTEIROS completos, por truncamento.
 */
export type DaysSinceKind = 'NEVER' | 'TODAY' | 'ONE' | 'MANY';

export interface DaysSinceLabel {
  kind: DaysSinceKind;
  /** Dias inteiros completos. `0` em `NEVER` e em `TODAY`. */
  days: number;
}

export function describeDaysSince(days: number | null | undefined): DaysSinceLabel {
  // Entrada nao finita cai em `NEVER` de proposito: `NaN` dias exibido como numero seria
  // pior que dizer que nao se sabe.
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
    return { kind: 'NEVER', days: 0 };
  }
  const whole = Math.floor(days);
  if (whole <= 0) return { kind: 'TODAY', days: 0 };
  if (whole === 1) return { kind: 'ONE', days: 1 };
  return { kind: 'MANY', days: whole };
}

/**
 * A partir de quantos dias o espelho merece aviso destacado.
 *
 * A sincronizacao é diaria (FR-022), entao 1 dia é o intervalo NORMAL e nao é noticia. Dois
 * dias inteiros ja significa que pelo menos um ciclo passou sem sucesso — tipicamente app
 * fechado (FR-023) —, que é o caso que FR-024a manda tornar visivel.
 */
export const STALE_DAYS_THRESHOLD = 2;

export function isMirrorStale(days: number | null | undefined): boolean {
  const label = describeDaysSince(days);
  return label.kind === 'NEVER' || label.days >= STALE_DAYS_THRESHOLD;
}

/* ------------------------------------------------------------------ *
 * 2. Exibibilidade da nota (FR-030b / I-15)
 * ------------------------------------------------------------------ */

/**
 * FR-030b: nota sem decomposicao NAO é exibivel.
 *
 * `HeroScore.breakdown` nao é opcional no tipo, mas o dado chega de `localStorage` e de
 * JSON, onde o tipo nao vale nada em runtime. Sem esta checagem a aba mostraria a nota
 * sozinha — um numero que ordena o layout do jogador sem nada que explique de onde veio, que
 * é precisamente o que a regra proibe. Nota nao exibivel virou linha marcada, nao linha
 * escondida: o heroi continua no espelho, e omitir a linha esconderia isso.
 */
export function isScoreDisplayable(score: HeroScore | null | undefined): boolean {
  if (!score) return false;
  if (score.score === null || !Number.isFinite(score.score)) return false;
  const breakdown = score.breakdown;
  if (!breakdown || typeof breakdown !== 'object') return false;
  return Number.isFinite(breakdown.personalWeight);
}

/**
 * FR-030c: o componente pessoal nao entrou na nota.
 *
 * Peso zero é a forma honesta de dizer "nao apliquei o pessoal", e a aba tem de rotular isso
 * em vez de deixar o jogador supor que o historico dele pesou.
 */
export function isPersonalApplied(score: HeroScore | null | undefined): boolean {
  if (!score?.breakdown) return false;
  return score.breakdown.personalWeight > 0 && score.breakdown.personalComponent !== null;
}

/* ------------------------------------------------------------------ *
 * 3. Ordem de exibicao (I-9)
 * ------------------------------------------------------------------ */

/**
 * Ordena para EXIBIR: nota maior primeiro, "sem dado" ao fim.
 *
 * `rankHeroes` devolve na ordem de ENTRADA de proposito (quem ordena é o `mirrorBuilder`,
 * que precisa da ordem original da origem para o desempate estavel de I-9). A aba, porem,
 * mostra um ranking, e ranking fora de ordem nao é ranking.
 *
 * `sort` do V8 é estavel desde o ES2019, entao empate — e o bloco inteiro de "sem dado" —
 * preserva a ordem que veio da origem, igual ao espelho gravado.
 */
export function sortScoresForDisplay(scores: readonly HeroScore[] | null | undefined): HeroScore[] {
  if (!Array.isArray(scores)) return [];
  return scores.slice().sort((a, b) => {
    const aHas = typeof a?.score === 'number' && Number.isFinite(a.score);
    const bHas = typeof b?.score === 'number' && Number.isFinite(b.score);
    if (aHas && bHas) return (b.score as number) - (a.score as number);
    if (aHas) return -1;
    if (bHas) return 1;
    return 0;
  });
}

/* ------------------------------------------------------------------ *
 * 4. Numeros na tela
 * ------------------------------------------------------------------ */

/**
 * Fracao 0..1 -> percentual com uma decimal.
 *
 * Nao reaproveita `formatPercent` de `dotaFormatters.ts` porque aquela arredonda para
 * inteiro, e aqui a diferenca entre 52,4% e 52,6% é o que separa duas posicoes do ranking.
 * Valor ausente devolve `null`, e quem chama exibe o rotulo de "sem dado" — nunca `0%`,
 * que seria um winrate fabricado.
 */
export function formatRatioPercent(value: number | null | undefined, digits = 1): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}

/** Nota 0..1 -> tres decimais. Ausente devolve `null`, nunca `0.000`. */
export function formatScoreValue(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value.toFixed(3);
}
