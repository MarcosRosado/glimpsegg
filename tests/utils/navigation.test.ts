import { describe, expect, it } from 'vitest';
import { classifySearchInput, initialMatchView } from '../../src/utils/navigation';
import { referenceMatch } from '../support/fixtureMatches';

/** A mesma partida real, como se a OpenDota ainda nao tivesse analisado o replay. */
const unparsed = () => {
  const m = referenceMatch();
  return { ...m, availability: { ...m.availability, parsed: false, parsePending: true } };
};

describe('initialMatchView', () => {
  it('abre em Meu jogo quando a partida analisada é da conta configurada', () => {
    const m = referenceMatch();
    expect(initialMatchView(m, '100000008', '100000008')).toEqual({ slot: 130, tab: 'MY_GAME' });
  });

  it('abre em Resumo quando a conta visualizada é outra', () => {
    const m = referenceMatch();
    // Vendo o perfil de 100000003, a partida foca nele e nao é "meu jogo".
    expect(initialMatchView(m, '100000008', '100000003')).toEqual({ slot: 2, tab: 'SUMMARY' });
  });

  it('cai na conta configurada quando a visualizada nao jogou a partida', () => {
    const m = referenceMatch();
    expect(initialMatchView(m, '100000008', '999')).toEqual({ slot: 130, tab: 'MY_GAME' });
  });

  it('nunca abre Meu jogo no fallback do primeiro jogador', () => {
    const m = referenceMatch();
    // Nenhuma das duas contas jogou: o slot cai no primeiro, mas a aba NAO é "Meu jogo" —
    // seria o jogo de um desconhecido com o rotulo de "meu".
    expect(initialMatchView(m, '42', '43')).toEqual({ slot: 0, tab: 'SUMMARY' });
    expect(initialMatchView(m, '', '')).toEqual({ slot: 0, tab: 'SUMMARY' });
  });

  it('partida nao analisada nunca abre em Meu jogo (modo placar nao tem abas)', () => {
    expect(initialMatchView(unparsed(), '100000008', '100000008')).toEqual({ slot: 130, tab: 'SUMMARY' });
  });
});

describe('classifySearchInput', () => {
  it('id de partida atual (acima de 32 bits) é partida', () => {
    expect(classifySearchInput('9096704970')).toEqual({ kind: 'MATCH', matchId: '9096704970' });
    expect(classifySearchInput('  9096704970 ')).toEqual({ kind: 'MATCH', matchId: '9096704970' });
  });

  it('link de partida é partida, venha de onde vier', () => {
    expect(classifySearchInput('https://www.opendota.com/matches/9096704970')).toEqual({
      kind: 'MATCH',
      matchId: '9096704970',
    });
    expect(classifySearchInput('https://www.dotabuff.com/matches/9096704970/builds')).toEqual({
      kind: 'MATCH',
      matchId: '9096704970',
    });
    expect(classifySearchInput('https://stratz.com/matches/123')).toEqual({ kind: 'MATCH', matchId: '123' });
  });

  it('numero que cabe em 32 bits é ambiguo: conta, com a partida oferecida', () => {
    expect(classifySearchInput('395519036')).toEqual({ kind: 'AMBIGUOUS', matchId: '395519036' });
    expect(classifySearchInput('4294967295')).toEqual({ kind: 'AMBIGUOUS', matchId: '4294967295' });
    expect(classifySearchInput('4294967296')).toEqual({ kind: 'MATCH', matchId: '4294967296' });
  });

  it('SteamID64, perfil, vanity e nome sao conta', () => {
    expect(classifySearchInput('76561198355784764')).toEqual({ kind: 'ACCOUNT' });
    expect(classifySearchInput('https://steamcommunity.com/profiles/76561198355784764')).toEqual({
      kind: 'ACCOUNT',
    });
    expect(classifySearchInput('https://steamcommunity.com/id/arteezy')).toEqual({ kind: 'ACCOUNT' });
    expect(classifySearchInput('Miracle-')).toEqual({ kind: 'ACCOUNT' });
    expect(classifySearchInput('0')).toEqual({ kind: 'ACCOUNT' });
    expect(classifySearchInput('')).toEqual({ kind: 'ACCOUNT' });
  });
});
