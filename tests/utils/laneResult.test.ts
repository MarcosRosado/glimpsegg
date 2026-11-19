import { describe, it, expect } from 'vitest';
import { resolvePlayerLaneResult } from '../../src/utils/laneVerdict';
import { LANE_RESULT_KEY, hasLaneVerdict, isLaneWin, isLaneLoss, laneVerdictView } from '../../src/utils/laneResult';
import { LaningStats, PlayerLaneResult } from '../../src/types/dota';

const SEM_DADO = { top: null, mid: null, bottom: null };

/**
 * A partida 8973449942 em forma de teste.
 *
 * Drow Ranger, Radiant, safe lane (a bottom): 11/10/10, 213 last hits, DERROTA em 34
 * minutos. A rota foi atropelo do Radiant, com comeback do outro time depois. O app dizia
 * "Rota Dificil" — porque a dashboard decidia rota por `deaths >= 7 && !isVictory`, ou seja,
 * pelo resultado do jogo INTEIRO.
 *
 * Nenhum sinal de partida entra aqui: so a rota, o lado do jogador e os outcomes. Desde
 * 2026-11-19 os outcomes saem da regra propria (`utils/laneVerdict.ts`), e a rota é a
 * GEOGRAFICA — a conversao safe/off por lado, que invertia metade dos jogadores quando
 * trocada, deixou de existir.
 */
describe('REGRESSAO 8973449942: rota atropelada num jogo perdido', () => {
  it('Radiant na bottom com atropelo do Radiant devolve STOMP_WON, mesmo com o jogo perdido', () => {
    const r = resolvePlayerLaneResult('bottom', true, {
      top: 'DIRE_VICTORY',
      mid: 'DIRE_VICTORY',
      bottom: 'RADIANT_STOMP',
    });
    expect(r).toBe('STOMP_WON');
    expect(isLaneWin(r)).toBe(true);
    expect(isLaneLoss(r)).toBe(false);
  });

  it('o veredito nao depende de vitoria, mortes nem nota — eles nem sao parametros', () => {
    expect(resolvePlayerLaneResult.length).toBe(3);
  });
});

describe('resolvePlayerLaneResult — rota geografica', () => {
  const outcomes = { top: 'DIRE_VICTORY' as const, mid: null, bottom: 'RADIANT_VICTORY' as const };

  it('cada jogador le a propria rota; os dois lados da mesma rota recebem resultados opostos', () => {
    expect(resolvePlayerLaneResult('bottom', true, outcomes)).toBe('WON');
    expect(resolvePlayerLaneResult('bottom', false, outcomes)).toBe('LOST');
    expect(resolvePlayerLaneResult('top', false, outcomes)).toBe('WON');
    expect(resolvePlayerLaneResult('top', true, outcomes)).toBe('LOST');
  });

  it('mid le a mid dos dois lados', () => {
    const mid = { top: null, mid: 'DIRE_STOMP' as const, bottom: null };
    expect(resolvePlayerLaneResult('mid', true, mid)).toBe('STOMP_LOST');
    expect(resolvePlayerLaneResult('mid', false, mid)).toBe('STOMP_WON');
  });

  it('TIE nao vira vitoria nem derrota', () => {
    expect(resolvePlayerLaneResult('mid', true, { top: null, mid: 'TIE', bottom: null })).toBe('TIE');
  });

  it('sem dado, ninguem recebe veredito', () => {
    expect(resolvePlayerLaneResult('bottom', true, SEM_DADO)).toBe('UNKNOWN');
    expect(resolvePlayerLaneResult('mid', false, SEM_DADO)).toBe('UNKNOWN');
  });

  it('jogador fora das tres rotas nao herda outcome', () => {
    const todas = { top: 'RADIANT_STOMP' as const, mid: 'RADIANT_STOMP' as const, bottom: 'RADIANT_STOMP' as const };
    expect(resolvePlayerLaneResult(null, true, todas)).toBe('UNKNOWN');
  });
});

describe('helpers de exibicao', () => {
  const TODOS: PlayerLaneResult[] = ['STOMP_WON', 'WON', 'TIE', 'LOST', 'STOMP_LOST', 'UNKNOWN'];

  it('UNKNOWN e ausencia nunca sao exibiveis — a UI omite em vez de estimar', () => {
    expect(hasLaneVerdict('UNKNOWN')).toBe(false);
    expect(hasLaneVerdict(undefined)).toBe(false);
    expect(hasLaneVerdict(null)).toBe(false);
    expect(hasLaneVerdict('LOST')).toBe(true);
  });

  it('todo veredito tem chave i18n, e vitoria e derrota sao disjuntas', () => {
    for (const r of TODOS) {
      expect(LANE_RESULT_KEY[r]).toBeTruthy();
      expect(isLaneWin(r) && isLaneLoss(r)).toBe(false);
    }
    expect(TODOS.filter(isLaneWin)).toEqual(['STOMP_WON', 'WON']);
    expect(TODOS.filter(isLaneLoss)).toEqual(['LOST', 'STOMP_LOST']);
  });
});

describe('laneVerdictView — o que a tela mostra para a rota', () => {
  const stats = (laneResult: PlayerLaneResult, laneAdvantage: LaningStats['laneAdvantage']): LaningStats => ({
    lastHits10: 0,
    denies10: 0,
    gold10: 0,
    exp10: 0,
    laneResult,
    laneAdvantage,
    firstCoreItemTimingSec: null,
    firstCoreItemId: null,
    kills10: null,
    deaths10: null,
  });
  const verdictAdv = (networthDiff: number) => ({ kind: 'VERDICT' as const, lane: 'bottom' as const, networthDiff, perHero: false, allies: 2, enemies: 2 });
  const unevenAdv = (networthDiff: number) => ({ kind: 'ADVANTAGE' as const, lane: 'top' as const, networthDiff, perHero: true, allies: 2, enemies: 1 });

  it('rota pareada: rotulo do veredito e a diferenca da rota ao lado', () => {
    const v = laneVerdictView(stats('WON', verdictAdv(1200)))!;
    expect(v).toMatchObject({ kind: 'VERDICT', labelKey: 'laneResultWon', detailKey: 'laneVerdictDetail', networthDiff: 1200, tone: 'positive' });
    expect(laneVerdictView(stats('STOMP_LOST', verdictAdv(-3000)))!.tone).toBe('negative');
    expect(laneVerdictView(stats('TIE', verdictAdv(150)))!.tone).toBe('neutral');
  });

  it('rota desigual nunca vira "Rota vencida"', () => {
    const v = laneVerdictView(stats('UNKNOWN', unevenAdv(400)))!;
    expect(v.kind).toBe('ADVANTAGE');
    expect(v.labelKey).toBe('laneAdvantageAhead');
    expect(Object.values(LANE_RESULT_KEY)).not.toContain(v.labelKey);
    expect(laneVerdictView(stats('UNKNOWN', unevenAdv(-400)))!.labelKey).toBe('laneAdvantageBehind');
    expect(laneVerdictView(stats('UNKNOWN', unevenAdv(0)))!.labelKey).toBe('laneAdvantageEven');
  });

  it('sem medida a secao some — nada de "Rota indefinida" no lugar do badge', () => {
    expect(laneVerdictView(undefined)).toBeNull();
    expect(laneVerdictView(stats('UNKNOWN', null))).toBeNull();
    expect(laneVerdictView(stats('UNKNOWN', undefined))).toBeNull();
    // Base de veredito sem veredito (nao deveria acontecer): omite em vez de inventar rotulo.
    expect(laneVerdictView(stats('UNKNOWN', verdictAdv(500)))).toBeNull();
  });
});
