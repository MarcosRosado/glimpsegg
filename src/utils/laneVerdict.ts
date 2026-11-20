import { LaneId, LaneOutcome, PlayerLaneAdvantage, PlayerLaneResult } from '../types/dota';

export type { LaneId, PlayerLaneAdvantage };

/**
 * VEREDITO DE ROTA PROPRIO (docs/PLANO-OPENDOTA.md, Fase 3) — a regra que devolve o badge de
 * rota depois que a STRATZ saiu (2026-11-19).
 *
 * A REGRA. Patrimonio E XP aos 10 minutos de quem estava na rota, MEDIA POR HEROI de cada
 * lado, cada um em diferenca relativa — (Radiant - Dire) / media dos dois — e o score é a
 * media das duas diferencas, com o MESMO PESO. Empate abaixo de `tieThreshold`, atropelo a
 * partir de `stompThreshold`. O xp entrou por DECISAO DO DONO (D1, 2026-11-19: "o XP é tao
 * importante quanto o patrimonio"), nao por ganhar no dado: so patrimonio dava 99,2% no
 * treino com cobertura 89,8%, contra 98,7% e 92,4% com xp, os dois dentro do aceite. "Quem estava na rota" é o campo
 * GEOGRAFICO `lane` da OpenDota (1 = bot, 2 = mid, 3 = top) — nao `lane_role`, e o roaming
 * nao tira ninguem da rota: foi exatamente assim que o ajuste mediu.
 *
 * SO SINAL DA ROTA. Esta funcao recebe rota, lado, patrimonio e xp aos 10 min, e nada mais — nem
 * vitoria, nem mortes, nem Glint. A dashboard antiga decidia rota por `deaths >= 7 &&
 * !isVictory`, e ganhar a rota e perder o jogo era impossivel de rotular. Nao reintroduzir.
 *
 * MEDIDO (`scripts/fit-lane-verdict.cjs`, ajuste em 7.41, teste em 7.42, 2026-11-19, retrato
 * congelado de 1.383 partidas, refeito depois da coleta das 15h): direcao igual a da STRATZ
 * em 98,8% das rotas de 7.42 em que as duas dizem que alguem venceu (999/1011, IC95
 * 97,9%–99,3%; cobertura 91,5%) e 98,7% em 7.41 (1775/1799, IC95 98,0%–99,1%; cobertura
 * 92,4%). O primeiro ajuste com xp, com 435 rotas de teste, dava 99,1%. Aceite da Fase 3 (90%, pelo
 * limite inferior do IC95, nos dois patches) atingido — por isso o app pode dizer "Rota
 * vencida". Os limiares sairam por TAXA DE DISPARO (empate = 25% das rotas, atropelo = 10%),
 * nao para reproduzir a STRATZ: classe exata igual a dela fica em ~74%, e tudo bem.
 *
 * ROTA DESIGUAL (2v1, 1v2, 3v2) NAO VIRA VEREDITO. Concorda so 74,4% no treino (n=82), abaixo
 * do aceite; sai como "Vantagem aos 10 min" com a diferenca por heroi ao lado
 * (`kind: 'ADVANTAGE'`), e `laneResult` fica `UNKNOWN` — assim o badge, o coaching e qualquer
 * outro consumidor de veredito a ignoram sem precisar saber da regra.
 *
 * REFAZER. Rodar o script a cada lote grande de pares e colar o bloco em `LANE_VERDICT_MODEL`.
 * Limiar nunca no olho; e se o aceite cair, o rotulo muda (§5 do plano), o limiar nao.
 */
export const LANE_VERDICT_MODEL = {
  fittedAt: '2026-11-19',
  trainPatch: '7.41',
  trainLanes: 2635,
  testPatch: '7.42',
  testLanes: 1512,
  minute: 10,
  variant: 'nwxp-head-rel',
  usesXp: true,
  aggregation: 'head',
  difference: 'rel',
  tieRate: 0.25,
  stompRate: 0.1,
  tieThreshold: 0.0665,
  stompThreshold: 0.3745,
  accepted: true,
  evenLaneOnly: true,
  test: {
    train: { agreement: 0.987, lo: 0.98, both: 1799, coverage: 0.924 },
    test: { agreement: 0.988, lo: 0.979, both: 1011, coverage: 0.915 },
    evenTest: { agreement: 1, lo: 0.996, both: 964 },
    unevenTrain: { agreement: 0.744, lo: 0.64, both: 82 },
  },
} as const;

/** Campo `lane` da OpenDota -> rota geografica. Qualquer outra coisa nao é rota. */
export function laneIdFromOpenDota(lane: unknown): LaneId | null {
  if (lane === 1) return 'bottom';
  if (lane === 2) return 'mid';
  if (lane === 3) return 'top';
  return null;
}

export interface LaneVerdictInput {
  /** Campo `lane` da OpenDota (1, 2, 3). */
  lane: unknown;
  isRadiant: boolean;
  /** `networth_t[10]`. `null`/ausente = serie curta: a rota inteira fica sem medida. */
  networth10: number | null | undefined;
  /** `xp_t[10]`. Mesma regra: faltando em qualquer jogador da rota, a rota fica sem medida. */
  xp10: number | null | undefined;
}

export interface LaneMeasure {
  lane: LaneId;
  radiantCount: number;
  direCount: number;
  /** Mesmo numero de herois dos dois lados. So rota pareada vira veredito. */
  even: boolean;
  radiantNetworth10: number;
  direNetworth10: number;
  /** Media por heroi Radiant - media por heroi Dire, em ouro. */
  perHeroDiff: number;
  radiantXp10: number;
  direXp10: number;
  /** Media por heroi Radiant - media por heroi Dire, em xp. */
  perHeroXpDiff: number;
  /** A diferenca relativa que a regra compara com os limiares. Positivo = Radiant. */
  score: number;
  /** `null` = rota desigual: medida, mas sem veredito. */
  outcome: LaneOutcome | null;
}

export type LaneMeasures = Record<LaneId, LaneMeasure | null>;

const LANE_IDS: LaneId[] = ['bottom', 'mid', 'top'];

function outcomeOf(score: number): LaneOutcome {
  const a = Math.abs(score);
  if (a < LANE_VERDICT_MODEL.tieThreshold) return 'TIE';
  const stomp = a >= LANE_VERDICT_MODEL.stompThreshold;
  if (score > 0) return stomp ? 'RADIANT_STOMP' : 'RADIANT_VICTORY';
  return stomp ? 'DIRE_STOMP' : 'DIRE_VICTORY';
}

const isMeasured = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sumOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
/** Diferenca relativa: (a - b) / media dos dois. Igual a do script de ajuste. */
const relDiff = (a: number, b: number) => (a + b > 0 ? (a - b) / ((a + b) / 2) : 0);

/**
 * Mede as tres rotas. Uma rota sai `null` quando um dos lados esta vazio ou quando algum
 * jogador dela nao tem patrimonio ou xp aos 10 min (partida curta ou nao parseada) — no
 * ajuste, essas rotas tambem ficaram de fora.
 */
export function measureLanes(players: LaneVerdictInput[]): LaneMeasures {
  const out: LaneMeasures = { bottom: null, mid: null, top: null };
  for (const id of LANE_IDS) {
    const inLane = players.filter((p) => laneIdFromOpenDota(p.lane) === id);
    if (inLane.some((p) => !isMeasured(p.networth10) || !isMeasured(p.xp10))) continue;
    const rad = inLane.filter((p) => p.isRadiant);
    const dire = inLane.filter((p) => !p.isRadiant);
    if (!rad.length || !dire.length) continue;
    const radNw = sumOf(rad.map((p) => p.networth10 as number));
    const direNw = sumOf(dire.map((p) => p.networth10 as number));
    const radXp = sumOf(rad.map((p) => p.xp10 as number));
    const direXp = sumOf(dire.map((p) => p.xp10 as number));
    const radNwHead = radNw / rad.length;
    const direNwHead = direNw / dire.length;
    const radXpHead = radXp / rad.length;
    const direXpHead = direXp / dire.length;
    const score = (relDiff(radNwHead, direNwHead) + relDiff(radXpHead, direXpHead)) / 2;
    const even = rad.length === dire.length;
    out[id] = {
      lane: id,
      radiantCount: rad.length,
      direCount: dire.length,
      even,
      radiantNetworth10: radNw,
      direNetworth10: direNw,
      perHeroDiff: radNwHead - direNwHead,
      radiantXp10: radXp,
      direXp10: direXp,
      perHeroXpDiff: radXpHead - direXpHead,
      score,
      outcome: even || !LANE_VERDICT_MODEL.evenLaneOnly ? outcomeOf(score) : null,
    };
  }
  return out;
}

/** O formato de `MatchDetails.laneOutcomes`. */
export function laneOutcomesFrom(m: LaneMeasures): { top: LaneOutcome | null; mid: LaneOutcome | null; bottom: LaneOutcome | null } {
  return { top: m.top?.outcome ?? null, mid: m.mid?.outcome ?? null, bottom: m.bottom?.outcome ?? null };
}

/**
 * Veredito do ponto de vista do jogador. Recebe exatamente rota, lado e outcomes — nenhum
 * sinal de resultado da partida, de proposito. A rota é a GEOGRAFICA, entao nao ha a conversao
 * safe/off por lado que a versao da STRATZ precisava (e que invertia metade dos jogadores
 * quando trocada).
 */
export function resolvePlayerLaneResult(
  lane: LaneId | null,
  isRadiant: boolean,
  outcomes: { top: LaneOutcome | null; mid: LaneOutcome | null; bottom: LaneOutcome | null },
): PlayerLaneResult {
  const outcome = lane ? outcomes[lane] : null;
  if (!outcome) return 'UNKNOWN';
  if (outcome === 'TIE') return 'TIE';
  const radiantWon = outcome === 'RADIANT_VICTORY' || outcome === 'RADIANT_STOMP';
  const stomp = outcome === 'RADIANT_STOMP' || outcome === 'DIRE_STOMP';
  if (radiantWon === isRadiant) return stomp ? 'STOMP_WON' : 'WON';
  return stomp ? 'STOMP_LOST' : 'LOST';
}

/**
 * O que a tela mostra ao lado do badge, do ponto de vista do jogador: as DUAS diferencas que
 * a regra compara, patrimonio e xp. Mostrar so o ouro deixaria "ouro à frente" ao lado de
 * "Lane perdida" quando o xp decidiu. Em rota pareada a diferenca é a da ROTA (soma de cada
 * lado). Em rota desigual é POR HEROI: a soma poderia ter sinal contrario (dois contra um) e
 * desmentir o rotulo. `score` é o da regra, do lado do jogador — o sinal que decide
 * "a frente/atras" quando nao ha veredito.
 */
export function playerLaneAdvantage(m: LaneMeasures, lane: unknown, isRadiant: boolean): PlayerLaneAdvantage | null {
  const id = laneIdFromOpenDota(lane);
  const measure = id ? m[id] : null;
  if (!measure) return null;
  const sign = isRadiant ? 1 : -1;
  const verdict = measure.outcome !== null;
  // Arredonda do ponto de vista Radiant e SO DEPOIS aplica o lado: `Math.round` do JS nao é
  // simetrico (499,5 -> 500, -499,5 -> -499), e os dois lados da mesma rota mostrariam
  // numeros diferentes. `|| 0` tira o -0 do lado Dire numa rota exatamente empatada.
  const radiantNw = Math.round(verdict ? measure.radiantNetworth10 - measure.direNetworth10 : measure.perHeroDiff);
  const radiantXp = Math.round(verdict ? measure.radiantXp10 - measure.direXp10 : measure.perHeroXpDiff);
  return {
    kind: verdict ? 'VERDICT' : 'ADVANTAGE',
    lane: measure.lane,
    networthDiff: sign * radiantNw || 0,
    xpDiff: sign * radiantXp || 0,
    score: sign * measure.score || 0,
    perHero: !verdict,
    allies: isRadiant ? measure.radiantCount : measure.direCount,
    enemies: isRadiant ? measure.direCount : measure.radiantCount,
  };
}
