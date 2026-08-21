import { describe, it, expect } from 'vitest';
import { resolveBracket, tierToBracket, effectivePosition } from './rankBracket';
import { MatchDetails, MatchPlayer } from '../types/dota';

const match = (over: Partial<MatchDetails> = {}) => ({ bracket: null, actualRank: null, ...over } as MatchDetails);
const player = (over: Partial<MatchPlayer> = {}) => ({ seasonRank: 0, role: 'POSITION_1', ...over } as MatchPlayer);

describe('tierToBracket', () => {
  it.each([
    [0, 'UNCALIBRATED'],
    [1, 'HERALD_GUARDIAN'],
    [2, 'HERALD_GUARDIAN'],
    [3, 'CRUSADER_ARCHON'],
    [4, 'CRUSADER_ARCHON'],
    [5, 'LEGEND_ANCIENT'],
    [6, 'LEGEND_ANCIENT'],
    [7, 'DIVINE_IMMORTAL'],
    [8, 'DIVINE_IMMORTAL'],
  ])('tier %i -> %s', (tier, expected) => {
    expect(tierToBracket(tier)).toBe(expected);
  });

  it('trata entrada invalida como nao calibrado', () => {
    expect(tierToBracket(NaN)).toBe('UNCALIBRATED');
    expect(tierToBracket(-3)).toBe('UNCALIBRATED');
  });
});

describe('resolveBracket — cascata', () => {
  it('prefere match.bracket', () => {
    const r = resolveBracket(match({ bracket: 6, actualRank: 12 }), player());
    expect(r).toEqual({ bracket: 'LEGEND_ANCIENT', isPlayerSpecific: true });
  });

  it('cai para actualRank / 10 — conferido na amostra real (bracket 6, rank 62)', () => {
    const r = resolveBracket(match({ actualRank: 62 }), player());
    expect(r.bracket).toBe('LEGEND_ANCIENT');
    expect(r.isPlayerSpecific).toBe(true);
    // Consistente com o caminho de match.bracket para a mesma partida.
    expect(r.bracket).toBe(resolveBracket(match({ bracket: 6 }), player()).bracket);
  });

  it('cai para o seasonRank do jogador', () => {
    const r = resolveBracket(match(), player({ seasonRank: 74 }));
    expect(r).toEqual({ bracket: 'DIVINE_IMMORTAL', isPlayerSpecific: true });
  });

  it('HONESTIDADE: sem nenhuma fonte, usa ALL e marca como NAO especifico', () => {
    const r = resolveBracket(match(), player());
    expect(r).toEqual({ bracket: 'ALL', isPlayerSpecific: false });
  });
});

describe('effectivePosition', () => {
  it('prefere o enum position da STRATZ ao role derivado', () => {
    expect(effectivePosition(player({ position: 'POSITION_4', role: 'POSITION_5' }))).toBe('POSITION_4');
  });

  it('cai para o role quando position esta ausente', () => {
    expect(effectivePosition(player({ role: 'POSITION_3' }))).toBe('POSITION_3');
  });
});
