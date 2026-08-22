import { describe, it, expect } from 'vitest';
import { resolveMatchType } from './dotaFormatters';
import { derivePartySize } from '../services/stratzGql';

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
