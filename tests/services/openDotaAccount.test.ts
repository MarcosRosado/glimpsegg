import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_RECORD_FIELDS,
  ACCOUNT_TOTAL_FIELDS,
  accountRecordEndpoint,
  mapAccountCounts,
  mapAccountRecord,
  mapAccountTotals,
} from '../../src/services/openDotaAccount';
import fixture from '../../src/services/__fixtures__/opendota-account.json';

/** Respostas REAIS (ver o `_note` da fixture). Os esperados sao lidos do cru, nao digitados. */
const fx = fixture as any;
const rawTotal = (field: string) => fx.totals.find((t: any) => t.field === field);

describe('mapAccountTotals', () => {
  const totals = mapAccountTotals(fx.totals);

  it('so os campos que somam, na ordem de ACCOUNT_TOTAL_FIELDS; kda e comeback/stomp/throw/loss ficam fora', () => {
    expect(totals.map((t) => t.field)).toEqual(ACCOUNT_TOTAL_FIELDS.filter((f) => rawTotal(f)));
    for (const fora of ['kda', 'comeback', 'stomp', 'throw', 'loss']) expect(totals.some((t) => (t.field as string) === fora)).toBe(false);
  });

  it('a media usa o `n` do PROPRIO campo, que muda de campo para campo', () => {
    const kills = totals.find((t) => t.field === 'kills')!;
    expect(kills).toEqual({ field: 'kills', matches: rawTotal('kills').n, sum: rawTotal('kills').sum, average: rawTotal('kills').sum / rawTotal('kills').n });
    // Na captura: abates em 6.445 partidas; eficiencia de rota so nas analisadas, bem menos.
    const lane = totals.find((t) => t.field === 'lane_efficiency_pct')!;
    expect(lane.matches).toBe(rawTotal('lane_efficiency_pct').n);
    expect(lane.matches).toBeLessThan(kills.matches);
  });

  it('amostra zero da media null, e entrada quebrada nao derruba', () => {
    expect(mapAccountTotals([{ field: 'kills', n: 0, sum: 0 }])).toEqual([{ field: 'kills', matches: 0, sum: 0, average: null }]);
    expect(mapAccountTotals(null)).toEqual([]);
    expect(mapAccountTotals([null, { field: 3 }])).toEqual([]);
  });
});

describe('mapAccountCounts', () => {
  const counts = mapAccountCounts(fx.counts);

  it('por categoria, mais jogado primeiro, com winrate do cru', () => {
    const patches = counts.patch;
    expect(patches.reduce((s, e) => s + e.games, 0)).toBe(Object.values(fx.counts.patch).reduce((s: number, v: any) => s + v.games, 0));
    for (let i = 1; i < patches.length; i++) expect(patches[i].games).toBeLessThanOrEqual(patches[i - 1].games);
    const radiant = counts.is_radiant.find((e) => e.key === '1')!;
    expect(radiant).toEqual({ key: '1', games: fx.counts.is_radiant['1'].games, wins: fx.counts.is_radiant['1'].win, winRate: parseFloat(((fx.counts.is_radiant['1'].win / fx.counts.is_radiant['1'].games) * 100).toFixed(1)) });
  });

  it('lane_role 0 nao é rota (partida nao analisada) e sai', () => {
    expect(fx.counts.lane_role['0'].games).toBeGreaterThan(0);
    expect(counts.lane_role.map((e) => e.key)).not.toContain('0');
    expect(counts.lane_role.map((e) => e.key).sort()).toEqual(Object.keys(fx.counts.lane_role).filter((k) => k !== '0').sort());
  });

  it('resposta vazia: todas as categorias vazias, nenhuma ausente', () => {
    const empty = mapAccountCounts(null);
    expect(Object.values(empty).every((v) => Array.isArray(v) && v.length === 0)).toBe(true);
  });
});

describe('recordes', () => {
  it('mapAccountRecord le o campo pedido, a partida e se venceu', () => {
    const r = mapAccountRecord('kills', fx.recordKills)!;
    const raw = fx.recordKills[0];
    expect(r).toEqual({ field: 'kills', value: raw.kills, matchId: raw.match_id, heroId: raw.hero_id, startTime: raw.start_time, won: (raw.player_slot < 128) === raw.radiant_win });
    expect(mapAccountRecord('gold_per_min', fx.recordGpm)!.value).toBe(fx.recordGpm[0].gold_per_min);
  });

  it('sem linha ou sem o campo: null', () => {
    expect(mapAccountRecord('kills', [])).toBeNull();
    expect(mapAccountRecord('hero_damage', fx.recordKills)).toBeNull();
  });

  it('o endpoint ordena pelo campo e projeta so o necessario; morte nao é recorde', () => {
    expect(accountRecordEndpoint(7, 'kills')).toBe(
      'players/7/matches?sort=kills&limit=1&project=kills&project=hero_id&project=start_time&project=player_slot&project=radiant_win',
    );
    expect(ACCOUNT_RECORD_FIELDS as readonly string[]).not.toContain('deaths');
  });
});
