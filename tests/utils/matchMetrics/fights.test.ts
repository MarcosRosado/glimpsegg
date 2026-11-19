import { describe, it, expect } from 'vitest';
import { summarizeFights } from '../../../src/utils/matchMetrics/fights';
import { referenceMatch, referenceRaw, unevenLaneMatch, unevenLaneRaw } from '../../support/fixtureMatches';

/**
 * Os esperados saem da resposta CRUA (`teamfights` por indice de `players`, `objectives`), e
 * nao do dominio que a funcao le — o mapper que fez a ponte é testado a parte.
 */
const OBJECTIVE_TYPES = ['building_kill', 'CHAT_MESSAGE_ROSHAN_KILL', 'CHAT_MESSAGE_MINIBOSS_KILL'];

describe.each([
  ['referencia', referenceMatch, referenceRaw],
  ['rota desigual', unevenLaneMatch, unevenLaneRaw],
] as const)('summarizeFights sobre a partida real (%s)', (_n, build, buildRaw) => {
  const match = build();
  const raw = buildRaw();
  const fights = summarizeFights(match)!;

  it('uma linha por luta, na ordem, numeradas a partir de 1', () => {
    expect(fights).toHaveLength(raw.teamfights.length);
    expect(fights.map((f) => f.index)).toEqual(raw.teamfights.map((_: unknown, i: number) => i + 1));
  });

  it('somas por lado batem com o cru (slot < 128 é Radiant)', () => {
    raw.teamfights.forEach((f: any, i: number) => {
      const sum = (radiant: boolean, field: string) =>
        f.players.reduce((s: number, p: any, j: number) => s + ((raw.players[j].player_slot < 128) === radiant ? p[field] : 0), 0);
      expect(fights[i].radiant.deaths).toBe(sum(true, 'deaths'));
      expect(fights[i].dire.deaths).toBe(sum(false, 'deaths'));
      expect(fights[i].radiant.goldDelta).toBe(sum(true, 'gold_delta'));
      expect(fights[i].dire.goldDelta).toBe(sum(false, 'gold_delta'));
      expect(fights[i].radiant.xpDelta).toBe(sum(true, 'xp_delta'));
      expect(fights[i].dire.buybacks).toBe(sum(false, 'buybacks'));
    });
  });

  it('objetivos depois da luta: do inicio dela ao inicio da proxima, cada um uma vez', () => {
    const brutos = raw.objectives.filter((o: any) => OBJECTIVE_TYPES.includes(o.type));
    const primeiraLuta = Math.min(...raw.teamfights.map((f: any) => f.start));
    const depoisDaPrimeira = brutos.filter((o: any) => o.time >= primeiraLuta);
    const atribuidos = fights.flatMap((f) => f.objectivesAfter);
    expect(atribuidos).toHaveLength(depoisDaPrimeira.length);
    for (const f of fights) {
      for (const o of f.objectivesAfter) {
        expect(o.objective.time).toBeGreaterThanOrEqual(f.start);
        expect(o.secondsAfterEnd).toBe(o.objective.time - f.end);
      }
    }
  });
});

describe('summarizeFights — conta a mao na partida de referencia', () => {
  const fights = summarizeFights(referenceMatch(), 0)!;

  it('primeira luta (173 a 213 s): Radiant 1 morte e +1.276 de ouro; Dire 2 mortes e +456', () => {
    expect(fights[0]).toMatchObject({
      start: 173,
      end: 213,
      radiant: { deaths: 1, goldDelta: 1276, xpDelta: 1582 },
      dire: { deaths: 2, goldDelta: 456, xpDelta: 697 },
    });
    // O jogador pedido (slot 0) nesta luta: +288 de ouro, +334 de xp, sem morrer.
    expect(fights[0].player).toMatchObject({ deaths: 0, goldDelta: 288, xpDelta: 334 });
  });

  it('quarta luta (640 a 686 s): torre durante a luta e duas logo depois, ate a proxima luta (804 s)', () => {
    const quarta = fights[3];
    expect([quarta.start, quarta.end]).toEqual([640, 686]);
    expect(quarta.objectivesAfter.map((o) => [o.objective.time, o.secondsAfterEnd])).toEqual([
      [658, -28],
      [730, 44],
      [748, 62],
    ]);
  });

  it('a ultima luta leva ate o fim da partida (Roshan aos 2238 s e o ancient aos 2383 s)', () => {
    const ultima = fights[fights.length - 1];
    const tempos = ultima.objectivesAfter.map((o) => o.objective.time);
    expect(tempos[0]).toBe(2238);
    expect(tempos[tempos.length - 1]).toBe(2383);
  });

  it('sem jogador pedido, `player` é null', () => {
    expect(summarizeFights(referenceMatch())![0].player).toBeNull();
  });
});

describe('summarizeFights — sem lutas', () => {
  it('partida sem a flag devolve null, nunca lista vazia', () => {
    const m = referenceMatch();
    expect(summarizeFights({ ...m, teamfights: null, availability: { ...m.availability, teamfights: false } })).toBeNull();
  });

  it('sem objetivos, as lutas saem com a lista de objetivos vazia', () => {
    const m = referenceMatch();
    const fights = summarizeFights({ ...m, objectives: null, availability: { ...m.availability, objectives: false } })!;
    expect(fights.every((f) => f.objectivesAfter.length === 0)).toBe(true);
  });
});
