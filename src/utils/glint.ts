/**
 * GLINT EXPERIMENTAL — a nota de impacto do app desde que a STRATZ saiu (2026-11-19).
 *
 * O QUE ELA É. Uma regressao linear sobre oito PERCENTIS da OpenDota: onde o jogador ficou,
 * em cada estatistica, entre partidas do MESMO HEROI (partida inteira, todos os ranques).
 * Os pesos foram ajustados para reproduzir o IMP da STRATZ + 50 em partidas de 7.41 e
 * testados em partidas de 7.42 que nao entraram no ajuste.
 *
 * O QUE ELA NAO É. Nao é a nota do plano (docs/PLANO-OPENDOTA.md, Fase 4), que compara por
 * minuto e por posicao contra benchmark proprio. Por isso:
 *  - o rotulo na tela é sempre "Glint (experimental)", com as metricas de teste no tooltip;
 *  - NAO se diz "50 = esperado para heroi e posicao": o centro medido é ~45 (a mediana do
 *    IMP é negativa) e o percentil é por heroi, nao por posicao nem por ranque;
 *  - NAO ha composicao no tooltip ("puxado por farm"): ouro e dano sairam com peso negativo
 *    por colinearidade com abates, e explicar a nota por eles seria inventar causa.
 *
 * MEDIDO NO TESTE (469 partidas de 7.42, ajuste em 823 de 7.41, 2026-11-19 — terceiro ajuste
 * do dia, depois da coleta das 15h; os anteriores, com 326 e 566 de treino e 197 de teste,
 * deram r 0,82 e 49% a 51% em "mesmo melhor"):
 *   por papel   r 0,81 | erro medio 10,4 | mesmo lado do 50: 81% | mesmo melhor da partida: 50%
 *   sem papel   r 0,79 | erro medio 10,9 | mesmo lado do 50: 80% | mesmo melhor da partida: 46%
 * O aceite da nota definitiva (r >= 0,85, erro <= 9, lado >= 88%, melhor >= 60%) NAO foi
 * atingido — é exatamente o que "experimental" quer dizer aqui. A escolha das oito metricas
 * foi feita olhando o conjunto de teste, entao os numeros acima sao um pouco otimistas.
 *
 * REFAZER. `node scripts/fit-glint-experimental.cjs` reajusta com os pares que houver em
 * `.gabarito/pairs/` e imprime o bloco para colar em `GLINT_MODEL`, mais a tabela de
 * limiares. Nunca ajustar peso ou limiar no olho.
 */

/** As oito estatisticas do modelo, com o nome que a OpenDota usa em `benchmarks`. */
export const GLINT_METRICS = [
  'gold_per_min',
  'xp_per_min',
  'kills_per_min',
  'deaths_per_min',
  'assists_per_min',
  'last_hits_per_min',
  'denies_per_min',
  'hero_damage_per_min',
] as const;
export type GlintMetric = (typeof GLINT_METRICS)[number];
export type GlintRole = 'core' | 'support';

/** [intercepto, ...um peso por metrica, na ordem de GLINT_METRICS]. Percentil em 0..1. */
export const GLINT_MODEL = {
  fittedAt: '2026-11-19',
  trainPatch: '7.41',
  trainMatches: 823,
  testPatch: '7.42',
  testMatches: 469,
  test: {
    byRole: { r: 0.81, meanAbsError: 10.4, sameSidePct: 81, sameBestPct: 50 },
    noRole: { r: 0.79, meanAbsError: 10.9, sameSidePct: 80, sameBestPct: 46 },
  },
  weights: {
    core: [-2.66, -16.94, 8.11, 33.17, 34.96, 23.99, 2.5, 6.76, -3.32],
    support: [6.34, -0.9, -1.4, 19.16, 32.2, 35.13, 3.43, 2.71, -3.77],
    /** Sem papel: partida nao parseada nao tem `position_est`. */
    any: [3.85, -8.85, 5.54, 25.26, 33.74, 29.62, -2.43, 4.18, -4.11],
  },
} as const;

/**
 * Limiares na escala do Glint, cada um com a taxa de disparo medida no teste (linhas de
 * jogador de 7.42). Sairam por QUANTIL: o Glint que dispara na mesma taxa do limiar de IMP
 * que o app usava — coluna "por papel" do script, a do modelo principal. Somar 50 ao limiar
 * antigo estaria errado — a regressao comprime a escala (p10/p50/p90 do Glint: 22/45/69), e
 * os extremos nunca disparariam.
 */
/**
 * Mediana medida do Glint, o "centro" que o tooltip cita. Não é `GLINT_THRESHOLDS.neutral`
 * (49, o equivalente a IMP 0): a mediana do IMP é negativa, e o tooltip usava o 49 como centro.
 */
export const GLINT_MEDIAN = 45;

export const GLINT_THRESHOLDS = {
  /** 0,4% — era IMP >= 50. */
  extremeHigh: 85,
  /** 4,3% — era IMP >= 35. */
  elite: 75,
  /** 7,6% — era IMP >= 30 (o criterio de atropelo da lista). */
  stomp: 72,
  /** 11,2% — era IMP >= 25. */
  strong: 68,
  /** 22,3% — era IMP >= 15. */
  good: 61,
  /** 35,1% — era IMP >= 5 (o piso de "impacto alto" da lista). */
  impact: 54,
  /** 43,8% ficam acima — era IMP >= 0. Nao é 50: a mediana medida é 45. */
  neutral: 49,
  /** 42,4% — era IMP <= -10. */
  poor: 41,
  /** 19,7% — era IMP <= -25. */
  weak: 29,
  /** 0,9% — era IMP <= -50. */
  extremeLow: 8,
} as const;

/**
 * A nota, de 0 a 100, ou `null` se faltar QUALQUER um dos oito percentis — nota com metrica
 * faltando seria outro modelo com o mesmo nome. `role` nulo usa os pesos sem papel.
 */
export function computeGlint(
  pct: Partial<Record<GlintMetric, number | null | undefined>> | null | undefined,
  role: GlintRole | null,
): number | null {
  if (!pct) return null;
  const w: readonly number[] = role ? GLINT_MODEL.weights[role] : GLINT_MODEL.weights.any;
  let sum = w[0];
  for (let i = 0; i < GLINT_METRICS.length; i++) {
    const v = pct[GLINT_METRICS[i]];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    sum += v * w[i + 1];
  }
  return Math.round(Math.max(0, Math.min(100, sum)));
}

/** Posicao 1 a 3 = core, 4 e 5 = suporte. Sem posicao conhecida, `null` (pesos sem papel). */
export function glintRoleOf(position: string | null | undefined): GlintRole | null {
  if (position === 'POSITION_1' || position === 'POSITION_2' || position === 'POSITION_3') return 'core';
  if (position === 'POSITION_4' || position === 'POSITION_5') return 'support';
  return null;
}

/** `players[].benchmarks` da partida -> os oito percentis. Chave ausente fica `undefined`. */
export function glintPercentilesFromMatch(benchmarks: any): Partial<Record<GlintMetric, number>> {
  const out: Partial<Record<GlintMetric, number>> = {};
  for (const m of GLINT_METRICS) {
    const v = benchmarks?.[m]?.pct;
    if (typeof v === 'number') out[m] = v;
  }
  return out;
}

/** Uma linha da tabela publica `GET /benchmarks?hero_id=`: percentil (0..1) -> valor. */
export interface BenchmarkPoint {
  percentile: number;
  value: number;
}
export type HeroBenchmarkTable = Partial<Record<GlintMetric, BenchmarkPoint[]>>;

/**
 * Percentil de um valor cru, por interpolacao linear na tabela publica do heroi. É como a
 * lista de partidas chega aos mesmos percentis que o detalhe recebe prontos: medido em 585
 * linhas de cinco herois, a diferenca mediana para o `pct` da partida é de 0,002 a 0,003
 * nas oito metricas do modelo.
 *
 * Abaixo do primeiro ponto (percentil 0,1) interpola ate zero; acima do ultimo (0,99) fica
 * em 0,995. `null` se a tabela nao serve.
 */
export function percentileFromTable(table: BenchmarkPoint[] | undefined, value: number): number | null {
  if (!Array.isArray(table) || table.length < 2 || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const first = table[0];
  if (value <= first.value) return first.value > 0 ? first.percentile * Math.max(0, value / first.value) : first.percentile;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (value <= b.value) {
      const span = b.value - a.value;
      return a.percentile + (b.percentile - a.percentile) * (span > 0 ? (value - a.value) / span : 1);
    }
  }
  return 0.995;
}

/** Totais da partida de um jogador, como vem em `/players/{id}/matches`. */
export interface GlintRawStats {
  durationSeconds: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  heroDamage: number;
}

/**
 * Os oito percentis a partir dos totais crus e da tabela do heroi.
 *
 * MORTES SAO INVERTIDAS. Na tabela o percentil cresce com mortes por minuto; o `pct` que
 * vem na partida ja é "menos morte = melhor" (medido: correlacao de -0,92 entre mortes por
 * minuto cruas e o `pct`, e erro mediano de 0,002 so depois de inverter). Os pesos foram
 * ajustados sobre o `pct` da partida, entao aqui a tabela entra como 1 - percentil.
 */
export function glintPercentilesFromRaw(
  raw: GlintRawStats,
  table: HeroBenchmarkTable | null | undefined,
): Partial<Record<GlintMetric, number>> {
  const out: Partial<Record<GlintMetric, number>> = {};
  const minutes = raw.durationSeconds / 60;
  if (!table || !(minutes > 0)) return out;
  const values: Record<GlintMetric, number> = {
    gold_per_min: raw.goldPerMinute,
    xp_per_min: raw.experiencePerMinute,
    kills_per_min: raw.kills / minutes,
    deaths_per_min: raw.deaths / minutes,
    assists_per_min: raw.assists / minutes,
    last_hits_per_min: raw.lastHits / minutes,
    denies_per_min: raw.denies / minutes,
    hero_damage_per_min: raw.heroDamage / minutes,
  };
  for (const m of GLINT_METRICS) {
    const p = percentileFromTable(table[m], values[m]);
    if (p === null) continue;
    out[m] = m === 'deaths_per_min' ? 1 - p : p;
  }
  return out;
}

// --- apresentacao ---------------------------------------------------------------------

export type GlintIconKind = 'STAR' | 'SKULL' | 'ZAP';

export function getGlintIconKind(glint: number): GlintIconKind {
  if (glint >= GLINT_THRESHOLDS.extremeHigh) return 'STAR';
  if (glint <= GLINT_THRESHOLDS.extremeLow) return 'SKULL';
  return 'ZAP';
}

/** "72". Sem sinal: a escala é 0 a 100, nao um delta. */
export function formatGlint(glint: number): string {
  return String(Math.round(glint));
}

export function getGlintColor(glint: number): string {
  if (glint >= GLINT_THRESHOLDS.extremeHigh) return 'text-fuchsia-300 font-black';
  if (glint <= GLINT_THRESHOLDS.extremeLow) return 'text-fuchsia-400 font-black';
  if (glint >= GLINT_THRESHOLDS.strong) return 'text-emerald-400 font-bold';
  if (glint >= GLINT_THRESHOLDS.neutral) return 'text-emerald-400';
  if (glint > GLINT_THRESHOLDS.weak) return 'text-amber-400';
  return 'text-rose-400 font-bold';
}

export function getGlintBadgeStyle(glint: number): { bg: string; text: string; border: string } {
  // Mesma paleta do chip de IMP que este substitui: magenta nos dois extremos (fora da
  // escala verde/vermelho de proposito), translucido como os outros chips.
  if (glint >= GLINT_THRESHOLDS.extremeHigh) {
    return { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-200', border: 'border-fuchsia-400/60' };
  }
  if (glint <= GLINT_THRESHOLDS.extremeLow) {
    return { bg: 'bg-fuchsia-900/40', text: 'text-fuchsia-300', border: 'border-fuchsia-500/50' };
  }
  if (glint >= GLINT_THRESHOLDS.strong) return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  if (glint >= GLINT_THRESHOLDS.neutral) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (glint > GLINT_THRESHOLDS.weak) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
  return { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' };
}
