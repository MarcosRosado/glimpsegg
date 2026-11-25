/**
 * GLINT EXPERIMENTAL — a nota de impacto do app desde que a STRATZ saiu (2026-11-19).
 *
 * O QUE ELA É (v5.1, no ar desde 2026-11-24; v5 de 2026-11-22). Uma regressao linear sobre oito
 * PERCENTIS da OpenDota — onde o jogador ficou, em cada estatistica, entre partidas do MESMO
 * HEROI (partida inteira, todos os ranques) — mais um termo de duracao e um deslocamento por
 * posicao. Desde a v5 o alvo NAO é mais o IMP da STRATZ (decisao D8): os pesos reproduzem a
 * referencia de CONTRIBUICAO PARA A VITORIA (probabilidade de vitoria atribuida por evento,
 * scripts/lib/impact.cjs), com a regua propria de docs/PROPOSTA-REGUA-GLINT.md. Escala de tela:
 * a mediana vai a 50 e o intervalo p10-p90 ocupa 48 pontos.
 *
 *  - Pesos NAO NEGATIVOS (R9): cada metrica so soma. Ainda assim nao ha composicao no tooltip:
 *    as oito andam juntas, e "puxado por farm" seria causa inventada.
 *  - Termo de DURACAO (pontos por minuto, teto de 60 min): o percentil é por heroi em qualquer
 *    duracao e partida longa infla taxa por minuto. Sem duracao valida, a nota é `null`.
 *  - DESLOCAMENTO POR POSICAO (v5.1): o alvo ja desconta a media da posicao, entao a nota tem a
 *    mesma media em toda posicao. Sem ele a v5 dava ~+2,5 ao meio e ~-3 a offlane.
 *  - SEM POSICAO (lista de partidas, partida nao parseada), a nota é o detalhe ESPERADO para o
 *    heroi pelas cinco posicoes (`heroPositionShare`, so herois com pelo menos 100 jogadores com
 *    posicao). Heroi fora da tabela usa os pesos sem papel mais `anyOffset`.
 *
 * O QUE ELA AINDA NAO É. Aprovada na regua em partidas nunca vistas. A v5 foi medida (2026-11-23,
 * 2.555 partidas novas): passou R1-R5 e R9 no detalhe e falhou R8 porque a lista falhou R1
 * (posicao 2 com mediana 56, faixa 45-55); o dono a manteve. A v5.1 corrige isso so com o
 * deslocamento por posicao (pesos da v5 intocados) e entrou por decisao do dono ANTES da medida
 * dela. A medida saiu no mesmo dia (2026-11-24, 2.416 partidas de 7.42 de 19/11, fora dos tres
 * congelamentos) e PASSOU R1-R5, R8 e R9 no detalhe e na lista: ela fica. Ainda nao medida em
 * 7.42a (a rotina diaria imprime a partir de 500 partidas). Defeito conhecido e de fora: na
 * lista, o suporte de heroi misto fica ~3 pontos abaixo do detalhe. Por isso o rotulo continua
 * "experimental"/"beta".
 *
 * CONFERENCIA (as 2.555 partidas da medida da v5, que o ajuste fino viu — so os cinco
 * deslocamentos e as fatias foram ajustados nelas):
 *   ordem dentro do time contra a referencia (Spearman): detalhe 0,529 | lista 0,479 | KDA 0,390
 *   lista x detalhe r 0,973 | correlacao com a duracao 0,00 | mediana por posicao 52 53 52 49 49
 *
 * REFAZER. `node scripts/fit-glint-experimental.cjs --target contrib --json <arquivo>` gera um
 * reajuste completo; `--refine` so o ajuste fino sobre um candidato travado. Novo candidato so
 * entra aqui depois de passar na regua em partidas novas (novo congelamento antes de olhar).
 * Nunca ajustar peso ou limiar no olho. O modelo ajustado ao IMP esta em
 * `.gabarito/glint-imp-fit-2026-11-19.json`; a v5, em `.gabarito/glint-candidate-2026-11-22-v5.json`.
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
 * Colado de `.gabarito/glint-candidate-2026-11-24-v5.1.json` (travado em 2026-11-24, ajuste fino
 * sobre a v5: `weights` e `duration` sao os dela).
 * `weights`: [intercepto, ...um peso por metrica, na ordem de GLINT_METRICS]; percentil em 0..1.
 */
export const GLINT_MODEL = {
  version: 5.1,
  fittedAt: '2026-11-24',
  target: 'contrib',
  trainMatches: 5199,
  /** Conferencia (ver o cabecalho). `teamRho*`: Spearman dentro do time contra a referencia. */
  check: {
    matches: 2555,
    teamRhoDetail: 0.529,
    teamRhoList: 0.479,
    teamRhoKda: 0.39,
    listVsDetailR: 0.973,
    durationR: 0,
  },
  weights: {
    core: [17.79, 27.71, 22.03, 9.69, 22.97, 4.16, 0, 0, 3.49],
    support: [34.62, 9.62, 0, 22.75, 14.33, 17.34, 1.94, 1.63, 0],
    /** Sem papel e sem fatia do heroi. */
    any: [26.45, 15.24, 13.47, 17.5, 20.61, 10.29, 0, 0, 3.11],
  },
  /** Pontos por minuto de partida, minuto com teto. */
  duration: { core: -0.438, support: -0.438, any: -0.438, capMinutes: 60 },
  /** Pontos somados a nota do detalhe, por posicao (1 a 5). */
  positionOffset: { 1: -0.98, 2: -3.29, 3: 1.65, 4: 0.32, 5: -0.05 },
  /** Somado aos pesos sem papel (heroi sem fatia). */
  anyOffset: -0.03,
  /** `hero_id` -> fatia das linhas de treino em cada posicao, 1 a 5. */
  heroPositionShare: {
    1: [0.938, 0.024, 0.021, 0.006, 0.011], 2: [0.009, 0.025, 0.933, 0.02, 0.013], 3: [0.008, 0.074, 0.008, 0.306, 0.603], 4: [0.683, 0.143, 0.124, 0.019, 0.031],
    5: [0.005, 0.022, 0.009, 0.206, 0.759], 6: [0.898, 0.06, 0.011, 0.019, 0.011], 7: [0.007, 0.432, 0.278, 0.231, 0.051], 8: [0.967, 0.016, 0.012, 0.002, 0.003],
    9: [0.009, 0.035, 0.022, 0.612, 0.322], 10: [0.822, 0.139, 0.003, 0.018, 0.018], 11: [0.131, 0.819, 0.017, 0.01, 0.022], 12: [0.956, 0.011, 0.023, 0.004, 0.006],
    13: [0, 0.944, 0.014, 0.028, 0.014], 14: [0.015, 0.094, 0.222, 0.404, 0.265], 15: [0.12, 0.227, 0.571, 0.056, 0.026], 16: [0, 0.331, 0.621, 0.039, 0.01],
    17: [0.022, 0.949, 0.009, 0.013, 0.006], 18: [0.94, 0.011, 0.045, 0.003, 0], 19: [0.266, 0.301, 0.183, 0.205, 0.044], 20: [0.165, 0.066, 0.12, 0.305, 0.345],
    21: [0.126, 0.216, 0.14, 0.384, 0.135], 22: [0.006, 0.291, 0.019, 0.486, 0.197], 23: [0.022, 0.335, 0.586, 0.057, 0], 25: [0.026, 0.741, 0.013, 0.15, 0.069],
    26: [0.003, 0.097, 0.003, 0.342, 0.556], 27: [0.002, 0.008, 0.013, 0.278, 0.699], 28: [0.013, 0.125, 0.813, 0.046, 0.004], 29: [0.01, 0.023, 0.918, 0.044, 0.005],
    30: [0.001, 0.01, 0.006, 0.267, 0.715], 31: [0.003, 0.005, 0.006, 0.253, 0.733], 32: [0.395, 0.341, 0.138, 0.087, 0.039], 33: [0.005, 0.066, 0.566, 0.247, 0.116],
    34: [0.012, 0.936, 0.02, 0.024, 0.008], 35: [0.119, 0.621, 0.049, 0.155, 0.055], 36: [0.103, 0.494, 0.372, 0.022, 0.01], 37: [0.007, 0.007, 0.015, 0.276, 0.694],
    38: [0.009, 0.086, 0.893, 0.006, 0.006], 39: [0.01, 0.829, 0.027, 0.097, 0.037], 40: [0.017, 0.021, 0.073, 0.409, 0.48], 41: [0.889, 0.017, 0.06, 0.017, 0.017],
    42: [0.332, 0.019, 0.627, 0.017, 0.005], 43: [0.074, 0.424, 0.346, 0.083, 0.072], 44: [0.934, 0.027, 0.024, 0.008, 0.007], 45: [0.002, 0.198, 0.025, 0.398, 0.378],
    46: [0.681, 0.303, 0, 0.011, 0.005], 47: [0.047, 0.514, 0.29, 0.106, 0.043], 48: [0.963, 0.025, 0.003, 0.004, 0.006], 49: [0.117, 0.3, 0.57, 0.01, 0.002],
    50: [0, 0.029, 0.01, 0.186, 0.775], 51: [0.013, 0.039, 0.116, 0.484, 0.348], 52: [0.114, 0.742, 0.066, 0.057, 0.022], 53: [0.282, 0.267, 0.067, 0.272, 0.111],
    54: [0.936, 0.003, 0.051, 0.006, 0.004], 55: [0.004, 0.04, 0.888, 0.04, 0.028], 56: [0.604, 0.297, 0.042, 0.047, 0.01], 57: [0.024, 0.048, 0.387, 0.194, 0.347],
    58: [0, 0.089, 0.12, 0.272, 0.519], 59: [0.049, 0.642, 0.24, 0.049, 0.02], 60: [0.009, 0.022, 0.948, 0.019, 0.002], 61: [0.115, 0.683, 0.181, 0.022, 0],
    62: [0.006, 0.011, 0.017, 0.818, 0.148], 63: [0.308, 0.095, 0.075, 0.379, 0.142], 64: [0.006, 0.039, 0.018, 0.389, 0.548], 65: [0.004, 0.448, 0.222, 0.194, 0.133],
    66: [0.006, 0.056, 0.006, 0.173, 0.759], 67: [0.938, 0.016, 0.019, 0.003, 0.025], 68: [0, 0.059, 0.007, 0.298, 0.636], 69: [0.007, 0.022, 0.905, 0.036, 0.029],
    70: [0.86, 0.055, 0.063, 0, 0.022], 71: [0.003, 0.03, 0.112, 0.701, 0.154], 72: [0.482, 0.04, 0.031, 0.237, 0.21], 73: [0.461, 0.261, 0.096, 0.139, 0.043],
    74: [0.002, 0.752, 0.005, 0.173, 0.068], 75: [0.012, 0.092, 0.017, 0.431, 0.448], 76: [0.066, 0.886, 0.032, 0.012, 0.004], 77: [0.061, 0.158, 0.772, 0.009, 0],
    78: [0.012, 0.078, 0.808, 0.084, 0.018], 79: [0, 0.023, 0.028, 0.373, 0.576], 80: [0.443, 0.41, 0.082, 0.033, 0.033], 81: [0.276, 0.105, 0.56, 0.039, 0.02],
    82: [0.162, 0.748, 0.062, 0.01, 0.019], 83: [0, 0.01, 0.02, 0.382, 0.588], 84: [0.004, 0.066, 0.199, 0.328, 0.403], 85: [0.017, 0.029, 0.272, 0.294, 0.387],
    86: [0.001, 0.136, 0.021, 0.581, 0.262], 87: [0, 0.013, 0.004, 0.242, 0.74], 88: [0.002, 0.12, 0.036, 0.668, 0.173], 89: [0.92, 0.057, 0.011, 0, 0.011],
    90: [0.015, 0.619, 0.03, 0.239, 0.096], 91: [0.032, 0.199, 0.053, 0.199, 0.518], 92: [0.006, 0.313, 0.559, 0.073, 0.05], 93: [0.688, 0.178, 0.071, 0.031, 0.032],
    94: [0.832, 0.09, 0.052, 0.019, 0.006], 95: [0.823, 0.069, 0.092, 0, 0.015], 96: [0.007, 0.027, 0.947, 0.02, 0], 97: [0.012, 0.245, 0.472, 0.154, 0.117],
    98: [0.004, 0.127, 0.833, 0.018, 0.018], 99: [0.032, 0.049, 0.88, 0.025, 0.014], 100: [0, 0.071, 0.098, 0.361, 0.47], 101: [0.004, 0.12, 0, 0.575, 0.301],
    102: [0.148, 0.025, 0.252, 0.164, 0.412], 103: [0.117, 0.041, 0.556, 0.146, 0.14], 104: [0.018, 0.031, 0.93, 0.021, 0], 105: [0.001, 0.048, 0.019, 0.534, 0.397],
    106: [0.014, 0.956, 0.007, 0.01, 0.014], 107: [0.004, 0.407, 0.131, 0.364, 0.093], 108: [0.016, 0.032, 0.872, 0.056, 0.024], 109: [0.972, 0.003, 0.003, 0.01, 0.01],
    110: [0.007, 0.203, 0.238, 0.324, 0.228], 111: [0, 0.04, 0.007, 0.193, 0.76], 112: [0.003, 0.021, 0.047, 0.244, 0.686], 113: [0.051, 0.801, 0.01, 0.096, 0.042],
    114: [0.495, 0.387, 0.031, 0.063, 0.024], 119: [0.015, 0.018, 0.01, 0.497, 0.46], 120: [0.008, 0.687, 0.293, 0.008, 0.004], 121: [0, 0.028, 0.002, 0.439, 0.531],
    123: [0, 0.011, 0.014, 0.58, 0.395], 126: [0.022, 0.863, 0.089, 0.022, 0.005], 128: [0.01, 0.264, 0.073, 0.397, 0.256], 129: [0.009, 0.038, 0.916, 0.029, 0.009],
    131: [0, 0.008, 0.008, 0.404, 0.581], 135: [0.007, 0.072, 0.867, 0.035, 0.02], 136: [0.044, 0.456, 0.195, 0.188, 0.118], 137: [0.003, 0.284, 0.677, 0.03, 0.006],
    138: [0.593, 0.119, 0.034, 0.186, 0.068], 145: [0.569, 0.391, 0.036, 0.005, 0], 155: [0, 0.068, 0.49, 0.265, 0.177],
  },
} as const;

/**
 * Mediana do Glint, o "centro" que o tooltip cita. Desde a v5 (e na v5.1) a escala de tela é ancorada nela
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
  extremeHigh: 84,
  /** 5,1% (alvo 5%). */
  elite: 78,
  /** 8,2% (alvo 8%) — o criterio de atropelo da lista. */
  stomp: 75,
  /** 12,1% (alvo 12%). */
  strong: 72,
  /** 23,2% (alvo 22%). */
  good: 65,
  /** 35,8% (alvo 35%) — o piso de "impacto alto" da lista. */
  impact: 58,
  /** 51% ficam acima (alvo 50%): a mediana. */
  neutral: 50,
  /** 41,3% ficam abaixo ou igual (alvo 40%). */
  poor: 45,
  /** 20,8% (alvo 20%). */
  weak: 34,
  /** 1,0% (alvo 1%). */
  extremeLow: 11,
} as const;

/**
 * O que `computeGlint` le de um modelo. Tudo alem de `weights` é opcional: a v5 tinha `duration`
 * e `heroCoreShare`, a v5.1 (no ar) tem `duration`, `positionOffset`, `heroPositionShare` e
 * `anyOffset`, e o antigo ajustado ao IMP so os pesos — o percentil é por heroi
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

/** `POSITION_1`..`POSITION_5` -> 1..5, para o deslocamento por posicao; o resto, `null`. */
export function glintPositionOf(position: string | null | undefined): number | null {
  const m = /^POSITION_([1-5])$/.exec(position ?? '');
  return m ? Number(m[1]) : null;
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
