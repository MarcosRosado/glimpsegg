import { describe, it, expect } from 'vitest';
import { playerDeathCosts } from '../../../src/utils/matchMetrics/deathCost';
import { referenceMatch, referenceRaw, unevenLaneMatch, unevenLaneRaw } from '../../support/fixtureMatches';

/**
 * Oraculo do CRU, independente do dominio: mortes distintas por instante do `deaths_log`,
 * janela ate `time_dead` ou o primeiro buyback dentro dela, e objetivo perdido lido direto de
 * `objectives` (construcao do proprio lado pelo nome; Roshan/Tormentor pelo `team` adversario).
 */
function rawDeathCosts(raw: any, slot: number): Array<{ time: number; out: number; lost: number[] }> {
  const p = raw.players.find((x: any) => x.player_slot === slot);
  const radiant = slot < 128;
  const lostObjs = raw.objectives.filter((o: any) => {
    if (o.type === 'building_kill') return /goodguys/.test(o.key) === radiant;
    if (o.type === 'CHAT_MESSAGE_ROSHAN_KILL' || o.type === 'CHAT_MESSAGE_MINIBOSS_KILL') return o.team === (radiant ? 3 : 2);
    return false;
  });
  const byTime = new Map<number, number>();
  for (const d of p.deaths_log ?? []) if (!byTime.has(d.time)) byTime.set(d.time, d.time_dead);
  const bb: number[] = (p.buyback_log ?? []).map((b: any) => b.time);
  return [...byTime]
    .sort((a, b) => a[0] - b[0])
    .map(([t, td]) => {
      // `time_dead` nulo: o parser nao viu o respawn, a partida acabou antes.
      const end = typeof td === 'number' ? t + td : Infinity;
      const buy = bb.find((x) => x >= t && x < end);
      const back = buy ?? end;
      const out = Number.isFinite(back) ? back - t : Math.max(0, raw.duration - t);
      return { time: t, out, lost: lostObjs.filter((o: any) => o.time >= t && o.time <= back).map((o: any) => o.time) };
    });
}

describe.each([
  ['referencia', referenceMatch, referenceRaw],
  ['rota desigual', unevenLaneMatch, unevenLaneRaw],
] as const)('playerDeathCosts sobre a partida real (%s)', (_n, build, buildRaw) => {
  const match = build();
  const raw = buildRaw();

  it('cada jogador: mesmas mortes, mesmo tempo fora e mesmos objetivos perdidos do oraculo cru', () => {
    for (const p of match.players) {
      const got = playerDeathCosts(match, p.playerSlot)!;
      const want = rawDeathCosts(raw, p.playerSlot);
      expect(got.deaths.map((d) => ({ time: d.time, out: d.secondsOut, lost: d.objectivesLost.map((o) => o.time) })), `slot ${p.playerSlot}`).toEqual(want);
      expect(got.deaths).toHaveLength(p.deaths);
    }
  });
});

describe('playerDeathCosts — conta a mao na partida de referencia', () => {
  const match = referenceMatch();

  it('slot 0: a pior morte é a de 2279 s, 100 s fora, com oito construcoes caindo', () => {
    const r = playerDeathCosts(match, 0)!;
    const worst = r.deaths[r.worst!];
    expect(worst.time).toBe(2279);
    expect(worst.secondsOut).toBe(100);
    expect(worst.objectivesLost.map((o) => o.time)).toEqual([2296, 2310, 2315, 2327, 2337, 2338, 2354, 2362]);
    expect(worst.objectivesLost.every((o) => o.takenBy === 'DIRE')).toBe(true);
  });

  it('slot 130 (Dire): morreu aos 655 s e o Radiant derrubou a torre 1 top aos 658 s', () => {
    const r = playerDeathCosts(match, 130)!;
    expect(r.deaths[r.worst!].objectivesLost).toEqual([
      { time: 658, kind: 'TOWER', takenBy: 'RADIANT', key: 'npc_dota_badguys_tower1_top', denied: false },
    ]);
  });

  it('morte sem tempo morto conhecido (2377 s, partida de 2382 s) vai ate o fim, com o ancient', () => {
    const d = playerDeathCosts(match, 1)!.deaths.find((x) => x.time === 2377)!;
    expect(d).toMatchObject({ secondsOut: 2382 - 2377, untilMatchEnd: true });
    // O ancient Radiant tem carimbo de 2383 s, depois da duracao: a janela aberta o pega.
    expect(d.objectivesLost.map((o) => [o.time, o.kind])).toEqual([[2383, 'ANCIENT']]);
  });

  it('quem nao perdeu objetivo morto tem worst null, e as mortes continuam listadas', () => {
    const r = playerDeathCosts(match, 128)!;
    expect(r.worst).toBeNull();
    expect(r.deaths.length).toBe(6);
  });

  it('buyback corta a janela: morte de 100 s com buyback aos 40 s conta so 40 s', () => {
    const p = match.players.find((x) => x.playerSlot === 0)!;
    const custom = {
      ...match,
      players: match.players.map((x) => (x === p ? { ...p, buybackTimes: [2279 + 40] } : x)),
    };
    const r = playerDeathCosts(custom, 0)!;
    const d = r.deaths.find((x) => x.time === 2279)!;
    expect(d).toMatchObject({ secondsOut: 40, boughtBack: true });
    // 2279 + 40 = 2319: so as tres primeiras construcoes (2296, 2310, 2315) cairam com ele fora.
    expect(d.objectivesLost.map((o) => o.time)).toEqual([2296, 2310, 2315]);
  });
});

describe('playerDeathCosts — sem dado', () => {
  it('sem objetivos ou sem eventos de morte: null', () => {
    const m = referenceMatch();
    expect(playerDeathCosts({ ...m, objectives: null, availability: { ...m.availability, objectives: false } }, 0)).toBeNull();
    expect(playerDeathCosts({ ...m, availability: { ...m.availability, deathEvents: false } }, 0)).toBeNull();
    expect(playerDeathCosts(m, 999)).toBeNull();
  });
});
