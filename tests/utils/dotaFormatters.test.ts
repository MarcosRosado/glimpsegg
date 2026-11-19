import { describe, it, expect } from 'vitest';
import { resolveMatchType } from '../../src/utils/dotaFormatters';

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
