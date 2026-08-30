import { describe, it, expect } from 'vitest';
import { resolvePlayerLaneResult } from '../../src/services/stratzGql';
import { LANE_RESULT_KEY, hasLaneVerdict, isLaneWin, isLaneLoss } from '../../src/utils/laneResult';
import { PlayerLaneResult } from '../../src/types/dota';

const SEM_DADO = { top: null, mid: null, bottom: null };

/**
 * A partida 8973449942 em forma de teste.
 *
 * Drow Ranger, Radiant, safe lane: 11/10/10, 213 last hits, DERROTA em 34 minutos.
 * A STRATZ classificou a rota como atropelo do Radiant, com comeback do outro time
 * depois. O app dizia "Rota Dificil" — porque a dashboard decidia rota por
 * `deaths >= 7 && !isVictory`, ou seja, pelo resultado do jogo INTEIRO.
 *
 * Nenhum sinal de partida entra aqui: so os tres campos de lane e o lado do jogador.
 */
describe('REGRESSAO 8973449942: rota atropelada num jogo perdido', () => {
  it('safelane do Radiant le a bottom e devolve STOMP_WON, mesmo com o jogo perdido', () => {
    const r = resolvePlayerLaneResult('SAFE', true, {
      top: 'DIRE_VICTORY',
      mid: 'DIRE_VICTORY',
      bottom: 'RADIANT_STOMP',
    });
    expect(r).toBe('STOMP_WON');
    expect(isLaneWin(r)).toBe(true);
    expect(isLaneLoss(r)).toBe(false);
  });

  it('o veredito nao depende de vitoria, mortes nem IMP — eles nem sao parametros', () => {
    expect(resolvePlayerLaneResult.length).toBe(3);
  });
});

describe('resolvePlayerLaneResult — geometria do mapa', () => {
  const bottomRadiant = { top: 'DIRE_VICTORY' as const, mid: null, bottom: 'RADIANT_VICTORY' as const };

  it('a safelane do Radiant e a bottom; a do Dire e a top', () => {
    expect(resolvePlayerLaneResult('SAFE', true, bottomRadiant)).toBe('WON');
    // Dire safe = top, onde o Dire venceu.
    expect(resolvePlayerLaneResult('SAFE', false, bottomRadiant)).toBe('WON');
  });

  it('a offlane do Radiant e a top; a do Dire e a bottom', () => {
    expect(resolvePlayerLaneResult('OFF', true, bottomRadiant)).toBe('LOST');
    expect(resolvePlayerLaneResult('OFF', false, bottomRadiant)).toBe('LOST');
  });

  it('mid le a mid dos dois lados', () => {
    const mid = { top: null, mid: 'DIRE_STOMP' as const, bottom: null };
    expect(resolvePlayerLaneResult('MID', true, mid)).toBe('STOMP_LOST');
    expect(resolvePlayerLaneResult('MID', false, mid)).toBe('STOMP_WON');
  });

  it('TIE nao vira vitoria nem derrota', () => {
    expect(resolvePlayerLaneResult('MID', true, { top: null, mid: 'TIE', bottom: null })).toBe('TIE');
  });

  it('sem dado, ninguem recebe veredito', () => {
    expect(resolvePlayerLaneResult('SAFE', true, SEM_DADO)).toBe('UNKNOWN');
    expect(resolvePlayerLaneResult('MID', false, SEM_DADO)).toBe('UNKNOWN');
  });

  it('lane sem posicao no mapa (jungle, roaming, desconhecida) nao herda outcome', () => {
    const todas = { top: 'RADIANT_STOMP' as const, mid: 'RADIANT_STOMP' as const, bottom: 'RADIANT_STOMP' as const };
    expect(resolvePlayerLaneResult('JUNGLE', true, todas)).toBe('UNKNOWN');
    expect(resolvePlayerLaneResult('ROAMING', true, todas)).toBe('UNKNOWN');
    expect(resolvePlayerLaneResult('UNKNOWN', true, todas)).toBe('UNKNOWN');
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
