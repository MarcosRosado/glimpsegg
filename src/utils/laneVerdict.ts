import { LaneId, LaneOutcome, PlayerLaneAdvantage, PlayerLaneResult } from '../types/dota';

export type { LaneId, PlayerLaneAdvantage };

/**
 * VEREDITO DE ROTA PROPRIO (docs/PLANO-OPENDOTA.md, Fase 3) — a regra que devolve o badge de
 * rota depois que a STRATZ saiu (2026-11-19).
 *
 * A REGRA. Patrimonio aos 10 minutos de quem estava na rota, MEDIA POR HEROI de cada lado,
 * em diferenca relativa: (Radiant - Dire) / media dos dois. Empate abaixo de
 * `tieThreshold`, atropelo a partir de `stompThreshold`. "Quem estava na rota" é o campo
 * GEOGRAFICO `lane` da OpenDota (1 = bot, 2 = mid, 3 = top) — nao `lane_role`, e o roaming
 * nao tira ninguem da rota: foi exatamente assim que o ajuste mediu.
 *
 * SO SINAL DA ROTA. Esta funcao recebe rota, lado e patrimonio aos 10 min, e nada mais — nem
 * vitoria, nem mortes, nem Glint. A dashboard antiga decidia rota por `deaths >= 7 &&
 * !isVictory`, e ganhar a rota e perder o jogo era impossivel de rotular. Nao reintroduzir.
 *
 * MEDIDO (`scripts/fit-lane-verdict.cjs`, ajuste em 7.41, teste em 7.42, 2026-11-19): direcao
 * igual a da STRATZ em 98,8% das rotas de 7.42 em que as duas dizem que alguem venceu
 * (423/428, IC95 97,3%–99,5%; cobertura 90,7%) e 99,2% em 7.41. Aceite da Fase 3 (90%, pelo
 * limite inferior do IC95, nos dois patches) atingido — por isso o app pode dizer "Rota
 * vencida". Os limiares sairam por TAXA DE DISPARO (empate = 25% das rotas, atropelo = 10%),
 * nao para reproduzir a STRATZ: classe exata igual a dela fica em ~74%, e tudo bem.
 *
 * ROTA DESIGUAL (2v1, 1v2, 3v2) NAO VIRA VEREDITO. Concorda so 84,5% no treino (n=58), abaixo
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
  trainLanes: 1790,
  testPatch: '7.42',
  testLanes: 639,
  minute: 10,
  variant: 'nw-head-rel',
  tieRate: 0.25,
  stompRate: 0.1,
  tieThreshold: 0.0751,
  stompThreshold: 0.4332,
  accepted: true,
  evenLaneOnly: true,
  test: {
    train: { agreement: 0.992, lo: 0.986, both: 1183, coverage: 0.897 },
    test: { agreement: 0.988, lo: 0.973, both: 428, coverage: 0.907 },
    evenTest: { agreement: 0.998, lo: 0.986, both: 406 },
    unevenTrain: { agreement: 0.845, lo: 0.731, both: 58 },
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

/**
 * Mede as tres rotas. Uma rota sai `null` quando um dos lados esta vazio ou quando algum
 * jogador dela nao tem patrimonio aos 10 min (partida curta ou nao parseada) — no ajuste,
 * essas rotas tambem ficaram de fora.
 */
export function measureLanes(players: LaneVerdictInput[]): LaneMeasures {
  const out: LaneMeasures = { bottom: null, mid: null, top: null };
  for (const id of LANE_IDS) {
    const inLane = players.filter((p) => laneIdFromOpenDota(p.lane) === id);
    if (inLane.some((p) => typeof p.networth10 !== 'number' || !Number.isFinite(p.networth10))) continue;
    const rad = inLane.filter((p) => p.isRadiant).map((p) => p.networth10 as number);
    const dire = inLane.filter((p) => !p.isRadiant).map((p) => p.networth10 as number);
    if (!rad.length || !dire.length) continue;
    const radSum = rad.reduce((s, v) => s + v, 0);
    const direSum = dire.reduce((s, v) => s + v, 0);
    const radHead = radSum / rad.length;
    const direHead = direSum / dire.length;
    const score = radHead + direHead > 0 ? (radHead - direHead) / ((radHead + direHead) / 2) : 0;
    const even = rad.length === dire.length;
    out[id] = {
      lane: id,
      radiantCount: rad.length,
      direCount: dire.length,
      even,
      radiantNetworth10: radSum,
      direNetworth10: direSum,
      perHeroDiff: radHead - direHead,
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
 * O que a tela mostra ao lado do badge, do ponto de vista do jogador. Em rota pareada a
 * diferenca é a da ROTA (soma de cada lado) — com o mesmo numero de herois, tem o mesmo sinal
 * da regra. Em rota desigual é POR HEROI: a soma poderia ter sinal contrario (dois contra um)
 * e desmentir o rotulo.
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
  const radiantDiff = Math.round(verdict ? measure.radiantNetworth10 - measure.direNetworth10 : measure.perHeroDiff);
  return {
    kind: verdict ? 'VERDICT' : 'ADVANTAGE',
    lane: measure.lane,
    networthDiff: sign * radiantDiff || 0,
    perHero: !verdict,
    allies: isRadiant ? measure.radiantCount : measure.direCount,
    enemies: isRadiant ? measure.direCount : measure.radiantCount,
  };
}
