import { describe, it, expect } from 'vitest';
import { resolveMatchType } from './dotaFormatters';
import { ALL_TOWERS_STANDING, derivePartySize, deriveTeamShares } from '../services/stratzGql';

/**
 * As duas regras novas do contexto de partida. Ambas existem para NAO inventar
 * dado: a lista da home precisa poder dizer "nao sei" em vez de rotular uma
 * partida casual como ranqueada ou uma partida em grupo como solo.
 */

describe('resolveMatchType', () => {
  it('reconhece fila ranqueada e casual pelo lobby, cru ou numerico', () => {
    expect(resolveMatchType('ALL_PICK_RANKED', 'RANKED')).toBe('RANKED');
    expect(resolveMatchType(22, 7)).toBe('RANKED');
    expect(resolveMatchType('ALL_PICK', 'UNRANKED')).toBe('UNRANKED');
    expect(resolveMatchType(1, 0)).toBe('UNRANKED');
  });

  it('nao confunde UNRANKED com RANKED (UNRANKED contem RANKED)', () => {
    expect(resolveMatchType(undefined, 'UNRANKED')).toBe('UNRANKED');
    expect(resolveMatchType(undefined, 'LOBBY_TYPE_UNRANKED')).toBe('UNRANKED');
    expect(resolveMatchType('UNRANKED_ALL_PICK', undefined)).toBe('UNRANKED');
  });

  it('turbo ganha do lobby: turbo em lobby ranqueado continua turbo', () => {
    expect(resolveMatchType('TURBO', 'RANKED')).toBe('TURBO');
    expect(resolveMatchType(23, 7)).toBe('TURBO');
  });

  it('reconhece torneio, battle cup e bots', () => {
    expect(resolveMatchType(undefined, 'TOURNAMENT')).toBe('TOURNAMENT');
    expect(resolveMatchType(undefined, 9)).toBe('BATTLE_CUP');
    expect(resolveMatchType(undefined, 'COOP_BOT')).toBe('BOTS');
  });

  it('devolve null quando nao sabe, em vez de cair em ranqueada', () => {
    expect(resolveMatchType(undefined, undefined)).toBeNull();
    expect(resolveMatchType(null, null)).toBeNull();
    expect(resolveMatchType('', '')).toBeNull();
    expect(resolveMatchType('ALGO_DESCONHECIDO', 'LOBBY_ESQUISITO')).toBeNull();
  });
});

describe('derivePartySize', () => {
  const party = [
    { partyId: 900 },
    { partyId: 900 },
    { partyId: 900 },
    { partyId: 901 },
    { partyId: null },
    { partyId: null },
  ];

  it('conta quantos jogadores compartilham o mesmo partyId', () => {
    expect(derivePartySize(party, 900)).toBe(3);
    expect(derivePartySize(party, 901)).toBe(1);
  });

  it('partyId nulo no proprio jogador ja e resposta: entrou sozinho', () => {
    expect(derivePartySize(party, null)).toBe(1);
    expect(derivePartySize(undefined, null)).toBe(1);
    expect(derivePartySize(undefined, undefined)).toBe(1);
  });

  it('sem a lista de jogadores, devolve null em vez de fingir solo', () => {
    expect(derivePartySize(undefined, 900)).toBeNull();
    expect(derivePartySize([], 900)).toBeNull();
    expect(derivePartySize(null, 900)).toBeNull();
  });

  it('partyId que nao aparece em ninguem devolve null, nao zero', () => {
    expect(derivePartySize(party, 999)).toBeNull();
  });
});

/**
 * Participacao em abates e fatia de dano alimentam duas tags da lista. Sao RAZOES
 * sobre o total do time, e por isso nao envelhecem quando um patch infla a economia
 * do jogo — diferente de um limiar absoluto de GPM, que ja passou a disparar em 59%
 * das partidas sem ninguem notar.
 */
describe('deriveTeamShares', () => {
  const todos = [
    { isRadiant: true, kills: 10, assists: 5, heroDamage: 40000 },
    { isRadiant: true, kills: 5, assists: 10, heroDamage: 30000 },
    { isRadiant: true, kills: 5, assists: 5, heroDamage: 30000 },
    { isRadiant: false, kills: 100, assists: 100, heroDamage: 999000 },
  ];
  const eu = { kills: 10, assists: 5, heroDamage: 40000 };

  it('divide pelo total do PROPRIO time, ignorando o time inimigo', () => {
    const r = deriveTeamShares(todos, true, eu);
    // Abates do time = 20; (10 + 5) / 20 = 75%. Dano = 100k; 40k = 40%.
    expect(r.killParticipationPct).toBeCloseTo(75, 5);
    expect(r.damageSharePct).toBeCloseTo(40, 5);
  });

  it('o lado importa: o mesmo jogador contra o outro time da outra razao', () => {
    const r = deriveTeamShares(todos, false, eu);
    // Abates do lado Dire = 100; (10 + 5) / 100 = 15%.
    expect(r.killParticipationPct).toBeCloseTo(15, 5);
  });

  it('sem a lista de jogadores devolve null nos dois, nunca zero', () => {
    for (const vazio of [undefined, null, [], 'nao é lista']) {
      const r = deriveTeamShares(vazio, true, eu);
      expect(r.killParticipationPct).toBeNull();
      expect(r.damageSharePct).toBeNull();
    }
  });

  it('time sem abates: a razao nao existe, e isso e null e nao 0%', () => {
    const zerados = [
      { isRadiant: true, kills: 0, assists: 0, heroDamage: 0 },
      { isRadiant: true, kills: 0, assists: 0, heroDamage: 0 },
    ];
    const r = deriveTeamShares(zerados, true, { kills: 0, assists: 0, heroDamage: 0 });
    expect(r.killParticipationPct).toBeNull();
    expect(r.damageSharePct).toBeNull();
  });

  it('ninguem do lado pedido tambem e null', () => {
    const r = deriveTeamShares([{ isRadiant: false, kills: 5, assists: 0, heroDamage: 10 }], true, eu);
    expect(r.killParticipationPct).toBeNull();
  });
});

describe('ALL_TOWERS_STANDING', () => {
  it('e a mascara de 11 torres inteiras', () => {
    expect(ALL_TOWERS_STANDING).toBe(2047);
    expect(ALL_TOWERS_STANDING.toString(2)).toBe('11111111111');
  });
});
