/**
 * GLINT EXPERIMENTAL — a nota de impacto do app desde que a STRATZ saiu (2026-11-19).
 *
 * O QUE ELA É (v5, no ar desde 2026-11-22). Uma regressao linear sobre oito PERCENTIS da
 * OpenDota — onde o jogador ficou, em cada estatistica, entre partidas do MESMO HEROI (partida
 * inteira, todos os ranques) — mais um termo de duracao. Desde a v5 o alvo NAO é mais o IMP da
 * STRATZ (decisao D8): os pesos reproduzem a referencia de CONTRIBUICAO PARA A VITORIA
 * (probabilidade de vitoria atribuida por evento, scripts/lib/impact.cjs), com a regua propria
 * de docs/PROPOSTA-REGUA-GLINT.md. Escala de tela: a mediana vai a 50 e o intervalo p10-p90
 * ocupa 48 pontos.
 *
 *  - Pesos NAO NEGATIVOS (R9): cada metrica so soma. Ainda assim nao ha composicao no tooltip:
 *    as oito andam juntas, e "puxado por farm" seria causa inventada.
 *  - Termo de DURACAO (pontos por minuto, teto de 60 min): o percentil é por heroi em qualquer
 *    duracao e partida longa infla taxa por minuto. Sem duracao valida, a nota é `null`.
 *  - SEM POSICAO (lista de partidas, partida nao parseada), a nota é o detalhe ESPERADO para o
 *    heroi: fatia de core x nota de core + o resto x nota de suporte (`heroCoreShare`, medida no
 *    treino, so herois com pelo menos 100 jogadores com posicao). Heroi fora da tabela
 *    usa os pesos sem papel.
 *
 * O QUE ELA AINDA NAO É. Aprovada na regua inteira: a v5 entrou por decisao do dono ANTES da
 * medida em partidas nunca vistas, e a medida (abaixo) reprovou a lista em R1. Os numeros da
 * conferencia interna, em 493 partidas separadas do ajuste mas lidas em todas as versoes do
 * reajuste, sao otimistas. Por isso o rotulo continua "experimental"/"beta".
 *
 * CONFERENCIA INTERNA (ajuste em 2572 partidas, 1.846 de 7.41 e 726 de 7.42):
 *   ordem dentro do time contra a referencia (Spearman): detalhe 0,548 | lista 0,509 | KDA 0,403
 *   lista x detalhe r 0,975 | correlacao com a duracao 0,003 | mediana por posicao 53 55 50 46 47
 *
 * MEDIDA OFICIAL (2026-11-23, 2.555 partidas novas): passa R1-R5 e R9 no detalhe; falha R8 so
 * porque a lista falha R1 (posicao 2 com mediana 56, faixa 45-55). O dono manteve a v5. O ajuste
 * fino v5.1 (deslocamento por posicao, `positionOffset`; lista pelas cinco posicoes,
 * `heroPositionShare`) esta travado e em medida; ate passar, `GLINT_MODEL` continua a v5 e os
 * campos novos de `GlintModelShape` ficam sem uso no app.
 *
 * REFAZER. `node scripts/fit-glint-experimental.cjs --target contrib --json <arquivo>` gera o
 * candidato; ele so entra aqui depois de passar na regua em partidas novas (novo congelamento
 * antes de olhar). Nunca ajustar peso ou limiar no olho. O modelo anterior, ajustado ao IMP,
 * esta em `.gabarito/glint-imp-fit-2026-11-19.json`.
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

/**
 * Colado de `.gabarito/glint-candidate-2026-11-22-v5.json` (travado as 01:28 de 2026-11-22).
 * `weights`: [intercepto, ...um peso por metrica, na ordem de GLINT_METRICS]; percentil em 0..1.
 */
export const GLINT_MODEL = {
  version: 5,
  fittedAt: '2026-11-22',
  target: 'contrib',
  trainMatches: 2572,
  /** Conferencia interna (ver o cabecalho). `teamRho*`: Spearman dentro do time contra a referencia. */
  check: {
    matches: 493,
    teamRhoDetail: 0.548,
    teamRhoList: 0.509,
    teamRhoKda: 0.403,
    listVsDetailR: 0.975,
    durationR: 0.003,
  },
  weights: {
    core: [17.79, 27.71, 22.03, 9.69, 22.97, 4.16, 0, 0, 3.49],
    support: [34.62, 9.62, 0, 22.75, 14.33, 17.34, 1.94, 1.63, 0],
    /** Sem papel e sem fatia do heroi. */
    any: [26.45, 15.24, 13.47, 17.5, 20.61, 10.29, 0, 0, 3.11],
  },
  /** Pontos por minuto de partida, minuto com teto. */
  duration: { core: -0.438, support: -0.438, any: -0.438, capMinutes: 60 },
  /** `hero_id` -> fatia das linhas de treino em que o heroi foi core (pos 1 a 3). */
  heroCoreShare: {
    1: 0.982, 2: 0.971, 4: 0.948, 5: 0.033, 6: 0.963, 7: 0.727, 8: 0.995, 9: 0.06, 10: 0.969, 11: 0.962,
    12: 0.996, 13: 0.952, 14: 0.347, 15: 0.904, 16: 0.949, 17: 0.987, 18: 0.993, 19: 0.769, 20: 0.332, 21: 0.48,
    22: 0.363, 23: 0.955, 25: 0.785, 26: 0.114, 27: 0.021, 28: 0.938, 29: 0.934, 30: 0.025, 31: 0.016, 32: 0.88,
    33: 0.69, 34: 0.962, 35: 0.817, 36: 0.958, 37: 0.033, 38: 0.992, 39: 0.85, 40: 0.108, 41: 0.966, 42: 0.976,
    43: 0.853, 44: 0.99, 45: 0.244, 46: 0.981, 47: 0.884, 48: 0.991, 49: 0.987, 50: 0.031, 52: 0.901, 53: 0.644,
    54: 0.991, 55: 0.923, 59: 0.934, 60: 0.967, 62: 0.048, 63: 0.489, 64: 0.06, 65: 0.593, 67: 0.973, 68: 0.078,
    69: 0.941, 70: 0.987, 71: 0.169, 74: 0.748, 75: 0.164, 76: 0.981, 81: 0.962, 82: 0.966, 84: 0.288, 85: 0.32,
    86: 0.162, 87: 0.005, 88: 0.199, 90: 0.72, 91: 0.298, 93: 0.939, 97: 0.715, 98: 0.965, 99: 0.933, 100: 0.216,
    101: 0.125, 102: 0.418, 104: 0.979, 105: 0.078, 106: 0.977, 107: 0.509, 109: 0.971, 110: 0.509, 111: 0.077, 112: 0.066,
    113: 0.879, 114: 0.921, 119: 0.056, 120: 0.985, 121: 0.033, 123: 0.027, 126: 0.97, 128: 0.382, 129: 0.951, 131: 0.032,
    135: 0.953, 136: 0.726, 137: 0.949,
  },
} as const;

/**
 * Mediana do Glint, o "centro" que o tooltip cita. Desde a v5 a escala de tela é ancorada nela
 * (mediana -> 50); no modelo ajustado ao IMP era 45.
 */
export const GLINT_MEDIAN = 50;

/**
 * Limiares na escala do Glint, por TAXA DE DISPARO (o reajuste escolhe o valor que dispara na
 * taxa-alvo nas linhas de treino; ao lado, a taxa medida). Nunca somar ou converter de outra
 * escala.
 */
export const GLINT_THRESHOLDS = {
  /** 1,2% ficam acima (alvo 1%). */
  extremeHigh: 85,
  /** 5,8% (alvo 5%). */
  elite: 78,
  /** 8,1% (alvo 8%) — o criterio de atropelo da lista. */
  stomp: 76,
  /** 13,2% (alvo 12%). */
  strong: 72,
  /** 22,3% (alvo 22%). */
  good: 66,
  /** 36,3% (alvo 35%) — o piso de "impacto alto" da lista. */
  impact: 58,
  /** 50,9% ficam acima (alvo 50%): a mediana. */
  neutral: 50,
  /** 41,4% ficam abaixo ou igual (alvo 40%). */
  poor: 45,
  /** 21,6% (alvo 20%). */
  weak: 34,
  /** 1,1% (alvo 1%). */
  extremeLow: 11,
} as const;

/**
 * O que `computeGlint` le de um modelo. `duration` e `heroCoreShare` sao opcionais: o modelo no
 * ar (v5) tem os dois, o antigo ajustado ao IMP nao tinha — o percentil é por heroi
 * em qualquer duracao, partida longa infla taxa por minuto, e o termo de duracao (pontos por
 * minuto, minuto com teto opcional) tira esse vies (criterio R3). Fica fora de `weights` de
 * proposito: nao é composicao da nota, é normalizacao.
 */
export interface GlintModelShape {
  weights: Record<GlintRole | 'any', readonly number[]>;
  duration?: { core: number; support: number; any: number; capMinutes?: number | null };
  /**
   * Fatia de core de cada heroi (`hero_id` -> 0..1), medida nas partidas de treino. Sem posicao
   * (lista de partidas, partida nao parseada), a nota vira o detalhe ESPERADO para o heroi:
   * p x nota de core + (1 - p) x nota de suporte. Heroi fora da tabela usa os pesos sem papel.
   */
  heroCoreShare?: Readonly<Record<number, number>>;
  /**
   * Pontos somados a nota do detalhe por posicao (1 a 5). O alvo ja desconta a media da posicao,
   * entao a nota deve ter a mesma media em toda posicao; sem isto a v5 dava +2 ao meio e -3 a
   * offlane. So pesa quando quem chama informa a posicao.
   */
  positionOffset?: Readonly<Record<number, number>>;
  /**
   * Fatia de cada posicao (1 a 5, nessa ordem) por heroi. Sem posicao, a nota vira o detalhe
   * ESPERADO pelas cinco posicoes. Tem precedencia sobre `heroCoreShare`.
   */
  heroPositionShare?: Readonly<Record<number, readonly number[]>>;
  /** Pontos somados aos pesos sem papel (heroi sem fatia), para essa perna centrar em 50. */
  anyOffset?: number;
}

/**
 * A nota, de 0 a 100, ou `null` se faltar QUALQUER um dos oito percentis — nota com metrica
 * faltando seria outro modelo com o mesmo nome. `role` nulo usa os pesos sem papel (ou, se o
 * modelo tiver `heroCoreShare` e o heroi estiver nela, a mistura core/suporte pela fatia).
 * `durationSeconds` so pesa se o modelo tiver termo de duracao; ai, sem duracao valida, `null`
 * pelo mesmo motivo. `model` existe para o script de medida e os testes medirem um candidato
 * com ESTA funcao, em vez de uma copia da formula.
 */
export function computeGlint(
  pct: Partial<Record<GlintMetric, number | null | undefined>> | null | undefined,
  role: GlintRole | null,
  durationSeconds?: number | null,
  model: GlintModelShape = GLINT_MODEL,
  heroId?: number | null,
  position?: number | null,
): number | null {
  if (!pct) return null;
  for (const m of GLINT_METRICS) {
    const v = pct[m];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  }
  let minutes = 0;
  if (model.duration) {
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
    const cap = model.duration.capMinutes;
    minutes = cap ? Math.min(cap, durationSeconds / 60) : durationSeconds / 60;
  }
  /** Soma antes do corte em 0..100, para um conjunto de pesos. */
  const raw = (set: GlintRole | 'any'): number => {
    const w = model.weights[set];
    let sum = w[0];
    for (let i = 0; i < GLINT_METRICS.length; i++) sum += (pct[GLINT_METRICS[i]] as number) * w[i + 1];
    return model.duration ? sum + minutes * model.duration[set] : sum;
  };
  const offset = (pos: number): number => model.positionOffset?.[pos] ?? 0;
  let sum: number;
  if (role) {
    const pos = typeof position === 'number' && position >= 1 && position <= 5 ? position : null;
    sum = raw(role) + (pos ? offset(pos) : 0);
  } else {
    const dist = heroId != null ? model.heroPositionShare?.[heroId] : undefined;
    const share = heroId != null ? model.heroCoreShare?.[heroId] : undefined;
    if (dist) {
      // O detalhe esperado pelas cinco posicoes: o papel e o deslocamento de cada uma.
      sum = 0;
      for (let i = 0; i < 5; i++) sum += (dist[i] ?? 0) * (raw(i < 3 ? 'core' : 'support') + offset(i + 1));
    } else if (share !== undefined) {
      sum = share * raw('core') + (1 - share) * raw('support');
    } else {
      sum = raw('any') + (model.anyOffset ?? 0);
    }
  }
  return Math.round(Math.max(0, Math.min(100, sum)));
}

/** Posicao 1 a 3 = core, 4 e 5 = suporte. Sem posicao conhecida, `null` (fatia do heroi ou pesos sem papel). */
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
