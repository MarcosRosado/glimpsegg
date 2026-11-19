import { describe, it, expect } from 'vitest';
import {
  LANE_VERDICT_MODEL,
  laneIdFromOpenDota,
  laneOutcomesFrom,
  measureLanes,
  playerLaneAdvantage,
  resolvePlayerLaneResult,
  type LaneVerdictInput,
} from '../../src/utils/laneVerdict';

/**
 * A regra em si, com entradas minimas. O caminho de ponta a ponta (fixture real da OpenDota)
 * mora em `tests/services/openDotaMatch.test.ts`; aqui ficam as bordas que a fixture nao tem:
 * rota desigual, lado vazio, serie curta, xp ausente e os dois limiares.
 *
 * `xp` padrao = o proprio patrimonio: as duas diferencas relativas ficam iguais, e o score
 * (media das duas) é exatamente a de cada uma — é o que permite mirar um limiar com `direFor`.
 */
const R = (lane: number, nw: number | null, xp: number | null | undefined = nw): LaneVerdictInput => ({ lane, isRadiant: true, networth10: nw, xp10: xp });
const D = (lane: number, nw: number | null, xp: number | null | undefined = nw): LaneVerdictInput => ({ lane, isRadiant: false, networth10: nw, xp10: xp });

/** Valor Dire que da exatamente o score pedido contra um Radiant de 4000 (1v1). */
const direFor = (score: number) => (4000 * (2 - score)) / (2 + score);

describe('laneIdFromOpenDota — o campo geografico `lane`', () => {
  it('1 bot, 2 mid, 3 top; o resto nao é rota', () => {
    expect(laneIdFromOpenDota(1)).toBe('bottom');
    expect(laneIdFromOpenDota(2)).toBe('mid');
    expect(laneIdFromOpenDota(3)).toBe('top');
    for (const v of [0, 4, 5, null, undefined, '1']) expect(laneIdFromOpenDota(v)).toBeNull();
  });
});

describe('measureLanes — limiares', () => {
  it('abaixo do empate é TIE; entre os limiares, vitoria; a partir do atropelo, STOMP', () => {
    const at = (score: number) => measureLanes([R(2, 4000), D(2, direFor(score))]).mid!.outcome;
    expect(at(LANE_VERDICT_MODEL.tieThreshold - 0.001)).toBe('TIE');
    expect(at(-(LANE_VERDICT_MODEL.tieThreshold - 0.001))).toBe('TIE');
    expect(at(LANE_VERDICT_MODEL.tieThreshold + 0.001)).toBe('RADIANT_VICTORY');
    expect(at(-(LANE_VERDICT_MODEL.tieThreshold + 0.001))).toBe('DIRE_VICTORY');
    expect(at(LANE_VERDICT_MODEL.stompThreshold + 0.001)).toBe('RADIANT_STOMP');
    expect(at(-(LANE_VERDICT_MODEL.stompThreshold + 0.001))).toBe('DIRE_STOMP');
  });

  it('compara MEDIA por heroi, nao soma', () => {
    const m = measureLanes([R(1, 3000), R(1, 1000), D(1, 2000), D(1, 2000)]).bottom!;
    expect(m.perHeroDiff).toBe(0);
    expect(m.outcome).toBe('TIE');
  });

  it('xp pesa igual ao patrimonio: score é a media das duas diferencas relativas', () => {
    // patrimonio empatado (0), xp com o dobro do limiar de empate => score = o limiar + folga
    const xpScore = 2 * (LANE_VERDICT_MODEL.tieThreshold + 0.002);
    const m = measureLanes([R(2, 4000, 4000), D(2, 4000, direFor(xpScore))]).mid!;
    expect(m.perHeroDiff).toBe(0);
    expect(m.score).toBeCloseTo(LANE_VERDICT_MODEL.tieThreshold + 0.002, 10);
    expect(m.outcome).toBe('RADIANT_VICTORY');
  });

  it('ouro e xp em lados opostos se anulam', () => {
    const m = measureLanes([R(2, 4000, direFor(0.3)), D(2, direFor(0.3), 4000)]).mid!;
    expect(m.score).toBeCloseTo(0, 10);
    expect(m.outcome).toBe('TIE');
  });
});

describe('measureLanes — rota sem veredito', () => {
  it('rota desigual é medida, mas sai sem outcome (nao passou no aceite)', () => {
    // 2v1: a soma favorece o Radiant (5000 x 3000), a media por heroi favorece o Dire.
    const m = measureLanes([R(3, 2500), R(3, 2500), D(3, 3000)]).top!;
    expect(m.even).toBe(false);
    expect(m.outcome).toBeNull();
    expect(laneOutcomesFrom({ top: m, mid: null, bottom: null }).top).toBeNull();
  });

  it('lado vazio: a rota nao existe para a regra', () => {
    expect(measureLanes([R(1, 3000), R(1, 2000)]).bottom).toBeNull();
  });

  it('um jogador sem patrimonio aos 10 min derruba a rota inteira (nunca vira zero)', () => {
    expect(measureLanes([R(2, 4000), D(2, null)]).mid).toBeNull();
    expect(measureLanes([R(2, 4000), D(2, undefined)]).mid).toBeNull();
  });

  it('um jogador sem xp aos 10 min tambem derruba a rota inteira', () => {
    expect(measureLanes([R(2, 4000, 4000), D(2, 3000, null)]).mid).toBeNull();
    // `undefined` direto no objeto: no helper ele cairia no padrao (xp = patrimonio).
    expect(measureLanes([{ lane: 2, isRadiant: true, networth10: 4000, xp10: undefined }, D(2, 3000, 3000)]).mid).toBeNull();
    expect(measureLanes([R(2, 4000, Number.NaN), D(2, 3000, 3000)]).mid).toBeNull();
  });

  it('partida nao parseada: nenhuma rota medida', () => {
    const m = measureLanes([R(1, null), D(1, null), R(2, null), D(2, null)]);
    expect(laneOutcomesFrom(m)).toEqual({ top: null, mid: null, bottom: null });
  });
});

describe('resolvePlayerLaneResult — ponto de vista do jogador', () => {
  const outcomes = { top: 'DIRE_STOMP', mid: 'TIE', bottom: 'RADIANT_VICTORY' } as const;

  it('mesma rota, lados opostos, resultados opostos', () => {
    expect(resolvePlayerLaneResult('bottom', true, outcomes)).toBe('WON');
    expect(resolvePlayerLaneResult('bottom', false, outcomes)).toBe('LOST');
    expect(resolvePlayerLaneResult('top', false, outcomes)).toBe('STOMP_WON');
    expect(resolvePlayerLaneResult('top', true, outcomes)).toBe('STOMP_LOST');
    expect(resolvePlayerLaneResult('mid', true, outcomes)).toBe('TIE');
  });

  it('sem rota ou sem outcome: UNKNOWN', () => {
    expect(resolvePlayerLaneResult(null, true, outcomes)).toBe('UNKNOWN');
    expect(resolvePlayerLaneResult('mid', true, { top: null, mid: null, bottom: null })).toBe('UNKNOWN');
  });

  it('recebe so rota, lado e outcomes — nenhum sinal da partida inteira', () => {
    expect(resolvePlayerLaneResult.length).toBe(3);
  });
});

describe('playerLaneAdvantage — o numero ao lado do badge', () => {
  it('rota pareada: diferenca da ROTA, com o sinal do lado do jogador', () => {
    const m = measureLanes([R(1, 3000), R(1, 1500), D(1, 2000), D(1, 1000)]);
    expect(playerLaneAdvantage(m, 1, true)).toMatchObject({ kind: 'VERDICT', lane: 'bottom', networthDiff: 1500, xpDiff: 1500, perHero: false, allies: 2, enemies: 2 });
    expect(playerLaneAdvantage(m, 1, false)).toMatchObject({ networthDiff: -1500, xpDiff: -1500 });
    expect(playerLaneAdvantage(m, 1, false)!.score).toBe(-playerLaneAdvantage(m, 1, true)!.score);
  });

  it('mostra as DUAS diferencas, mesmo quando apontam para lados opostos', () => {
    const m = measureLanes([R(2, 3000, 5000), D(2, 3400, 4000)]);
    expect(playerLaneAdvantage(m, 2, true)).toMatchObject({ networthDiff: -400, xpDiff: 1000 });
  });

  it('meio exato arredonda igual dos dois lados (ouro e xp)', () => {
    // 2v1 por heroi: patrimonio (1001 + 1000) / 2 - 1000 = +0,5; xp (2001 + 2000) / 2 - 2000 = +0,5
    const m = measureLanes([R(3, 1001, 2001), R(3, 1000, 2000), D(3, 1000, 2000)]);
    const rad = playerLaneAdvantage(m, 3, true)!;
    const dire = playerLaneAdvantage(m, 3, false)!;
    expect([rad.networthDiff, rad.xpDiff]).toEqual([1, 1]);
    expect([dire.networthDiff, dire.xpDiff]).toEqual([-1, -1]);
  });

  it('rota desigual: diferenca POR HEROI, que nunca desmente o rotulo', () => {
    const m = measureLanes([R(3, 2500), R(3, 2500), D(3, 3000)]);
    const adv = playerLaneAdvantage(m, 3, true)!;
    expect(adv.kind).toBe('ADVANTAGE');
    expect(adv.perHero).toBe(true);
    // A soma daria +2000 para o Radiant; por heroi ele esta 500 atras.
    expect(adv.networthDiff).toBe(-500);
    expect(adv).toMatchObject({ allies: 2, enemies: 1 });
  });

  it('jogador fora das tres rotas ou rota sem medida: null', () => {
    const m = measureLanes([R(1, 3000), D(1, 2000)]);
    expect(playerLaneAdvantage(m, 4, true)).toBeNull();
    expect(playerLaneAdvantage(m, 2, true)).toBeNull();
  });
});
