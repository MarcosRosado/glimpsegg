import { describe, it, expect } from 'vitest';
import { lobbyTypeKey, matchModeKey, resolveMatchType } from '../../src/utils/dotaFormatters';
import { translations } from '../../src/i18n/translations';
import { referenceMatch } from '../support/fixtureMatches';

/**
 * `resolveMatchType` existe para NAO inventar dado: a lista da home precisa poder dizer
 * "nao sei" em vez de rotular uma partida casual como ranqueada.
 *
 * Ate 2026-11-19 estes testes moravam em `matchContext.test.ts`, nomeado por tema, junto com
 * `derivePartySize`, `deriveTeamShares` e `ALL_TOWERS_STANDING` — funcoes do mapper da
 * STRATZ, que saiu com ele (etapa 2 da D4). Os formatadores de IMP que este arquivo testava
 * sairam junto: o IMP nao existe mais na tela, e o ultimo consumidor era o caminho legado.
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

describe('matchModeKey / lobbyTypeKey — o motor escolhe a chave, a tela traduz', () => {
  it('a partida de referencia (game_mode 22, lobby 7) sai "Ranked All Pick" em en-US', () => {
    const m = referenceMatch();
    expect(m.gameModeId).toBe(22);
    expect(m.lobbyTypeId).toBe(7);
    const mode = matchModeKey(m.gameModeId, m.lobbyTypeId)!;
    expect(translations['en-US'][mode.key]).toBe('Ranked All Pick');
    expect(translations['pt-BR'][mode.key]).toBe('All Pick Ranqueado');
    expect(translations['en-US'][lobbyTypeKey(m.lobbyTypeId)!.key]).toBe('Ranked');
  });

  it('All Pick (1) so é ranqueado com a fila 7; sem fila, nao afirma nem ranqueado nem casual', () => {
    expect(matchModeKey(1, 7)!.key).toBe('gameModeAllPickRanked');
    expect(matchModeKey(1, 0)!.key).toBe('gameModeAllPick');
    expect(matchModeKey(1)!.key).toBe('gameModeAllPick');
  });

  it('entrada vazia é null (a tela omite), nunca o palpite "All Pick Ranqueado"', () => {
    expect(matchModeKey(null)).toBeNull();
    expect(matchModeKey(undefined, 7)).toBeNull();
    expect(lobbyTypeKey(null)).toBeNull();
  });

  it('modo ou fila desconhecida sai com o proprio id, nunca chutada', () => {
    expect(matchModeKey(99)).toEqual({ key: 'gameModeOther', params: { id: '99' } });
    expect(lobbyTypeKey(42)).toEqual({ key: 'lobbyOther', params: { id: '42' } });
  });

  it('aceita o enum em texto, como a lista de partidas guarda', () => {
    expect(matchModeKey('TURBO')!.key).toBe('gameModeTurbo');
    expect(matchModeKey('23')!.key).toBe('gameModeTurbo');
  });
});
