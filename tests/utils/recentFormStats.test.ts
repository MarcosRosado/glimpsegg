import { describe, it, expect } from 'vitest';
import { computeRecentFormStats } from '../../src/utils/recentFormStats';
import { PlayerMatchSummary } from '../../src/types/dota';

/**
 * So os campos que `computeRecentFormStats` le. O resto do `PlayerMatchSummary` nao
 * participa do agregado, entao nao é inventado aqui.
 */
function match(over: Partial<PlayerMatchSummary>): PlayerMatchSummary {
  return {
    isVictory: true,
    kills: 5,
    deaths: 5,
    assists: 10,
    goldPerMinute: 500,
    experiencePerMinute: 600,
    imp: null,
    glint: null,
    ...over,
  } as PlayerMatchSummary;
}

describe('computeRecentFormStats', () => {
  it('lista vazia ou ausente: sem partidas e sem nota', () => {
    for (const input of [undefined, []]) {
      const s = computeRecentFormStats(input);
      expect(s.count).toBe(0);
      expect(s.avgGlint).toBeNull();
      expect(s.glintCount).toBe(0);
    }
  });

  it('a media do Glint sai SO das partidas com nota, e a contagem diz quantas foram', () => {
    const s = computeRecentFormStats([
      match({ glint: 70 }),
      match({ glint: null }),
      match({ glint: 50 }),
      match({ glint: undefined }),
    ]);
    // (70 + 50) / 2 — dividir por 4 daria 30, uma nota que ninguem tirou.
    expect(s.avgGlint).toBe(60);
    expect(s.glintCount).toBe(2);
    expect(s.count).toBe(4);
  });

  it('nenhuma partida com nota: a media é null, nunca 0', () => {
    const s = computeRecentFormStats([match({}), match({}), match({})]);
    expect(s.avgGlint).toBeNull();
    expect(s.glintCount).toBe(0);
    // O resto do agregado nao depende da nota.
    expect(s.count).toBe(3);
    expect(s.winRate).toBe(100);
  });

  it('Glint 0 é nota de verdade e entra na media', () => {
    const s = computeRecentFormStats([match({ glint: 0 }), match({ glint: 40 })]);
    expect(s.avgGlint).toBe(20);
    expect(s.glintCount).toBe(2);
  });

  it('o IMP nulo do caminho OpenDota nao aparece em campo nenhum', () => {
    const s = computeRecentFormStats([match({ imp: null, glint: 55 })]);
    expect(s).not.toHaveProperty('avgImp');
    expect(s.avgGlint).toBe(55);
  });

  it('respeita o tamanho da amostra e calcula vitorias, KDA e farm sobre ela', () => {
    const matches = [
      match({ isVictory: true, kills: 10, deaths: 2, assists: 6, goldPerMinute: 700, glint: 80 }),
      match({ isVictory: false, kills: 2, deaths: 6, assists: 4, goldPerMinute: 400, glint: 30 }),
      match({ isVictory: true, glint: 99 }), // fora da amostra de 2
    ];
    const s = computeRecentFormStats(matches, 2);
    expect(s.count).toBe(2);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(50);
    expect(s.avgKills).toBe(6);
    expect(s.kdaRatio).toBeCloseTo(22 / 8);
    expect(s.avgGpm).toBe(550);
    expect(s.avgGlint).toBe(55);
  });

  it('sem mortes na amostra, o KDA usa piso de 1 em vez de estourar', () => {
    const s = computeRecentFormStats([match({ kills: 8, deaths: 0, assists: 4 })]);
    expect(s.kdaRatio).toBe(12);
  });
});
