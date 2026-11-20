import { describe, it, expect } from 'vitest';
import {
  classifyMatchDynamic,
  filterRowsToPatch,
  mapHeroPerformance,
  mapMostPlayedHeroes,
  mapOpenDotaPeers,
  mapOpenDotaPlayerMatch,
  mapOpenDotaProfile,
  mapPatchCatalog,
  patchServerQuery,
  patchWindows,
  playerMatchesEndpoint,
} from '../../src/services/openDotaProfile';
import { GLINT_THRESHOLDS } from '../../src/utils/glint';
import { resolveMatchType } from '../../src/utils/dotaFormatters';
import { hasLaneVerdict } from '../../src/utils/laneResult';
import fixture from '../../src/services/__fixtures__/opendota-player.json';

/**
 * Mappers do perfil sobre respostas REAIS e anonimizadas da OpenDota. Os numeros
 * conferidos sao lidos da propria fixture crua, nao digitados.
 */
const fx = fixture as any;
const tables = Object.fromEntries(Object.entries(fx.benchmarks).map(([k, v]) => [Number(k), v])) as any;
const NOW = new Date(fx.matches[0].start_time * 1000 + 3600 * 1000);
const profile = mapOpenDotaProfile({ player: fx.player, wl: fx.wl, matches: fx.matches, heroMatches: fx.heroMatches }, tables, NOW)!;

describe('mapOpenDotaProfile', () => {
  it('identidade, medalha e vitorias saem da resposta', () => {
    expect(profile.steamAccountId).toBe(String(fx.player.profile.account_id));
    expect(profile.steamId64).toBe(fx.player.profile.steamid);
    expect(profile.seasonRank).toBe(fx.player.rank_tier);
    expect(profile.leaderboardRank).toBe(fx.player.leaderboard_rank);
    expect(profile.totalMatches).toBe(fx.wl.win + fx.wl.lose);
    expect(profile.winCount).toBe(fx.wl.win);
    expect(profile.winRate).toBeCloseTo((100 * fx.wl.win) / (fx.wl.win + fx.wl.lose), 1);
  });

  it('conta sem `profile` (inexistente ou privada) nao vira perfil', () => {
    expect(mapOpenDotaProfile({ player: {}, wl: {}, matches: [], heroMatches: [] })).toBeNull();
    expect(mapOpenDotaProfile({ player: { profile: {} }, wl: {}, matches: [], heroMatches: [] })).toBeNull();
  });

  it('sem medalha e sem partidas: zero, nunca um default inventado', () => {
    const empty = mapOpenDotaProfile({ player: { profile: { account_id: 5 } }, wl: {}, matches: [], heroMatches: [] })!;
    expect(empty.seasonRank).toBe(0);
    expect(empty.totalMatches).toBe(0);
    expect(empty.winRate).toBe(0);
    expect(empty.recentMatches).toEqual([]);
    expect(empty.peers).toBeUndefined();
    // Lista vazia que VEIO não é falha: nenhum cartão mostra erro.
    expect(empty.recentMatchesFailed).toBeUndefined();
    expect(empty.peersFailed).toBeUndefined();
    expect(empty.activityDays).toHaveLength(30);
  });

  it('chamada que falhou (null) sai marcada, nunca como conta vazia', () => {
    const failed = mapOpenDotaProfile(
      { player: { profile: { account_id: 5 } }, wl: {}, matches: null, heroMatches: [], peers: null },
      {},
      NOW,
    )!;
    expect(failed.recentMatchesFailed).toBe(true);
    expect(failed.peersFailed).toBe(true);
    expect(failed.recentMatches).toEqual([]);
    expect(failed.peers).toBeUndefined();
    // 30 dias zerados afirmariam que a conta não jogou.
    expect(failed.activityDays).toBeUndefined();
  });

  it('companheiros vazios que vieram: sem cartão, sem erro', () => {
    const none = mapOpenDotaProfile({ player: { profile: { account_id: 5 } }, wl: {}, matches: [], heroMatches: [], peers: [] }, {}, NOW)!;
    expect(none.peers).toBeUndefined();
    expect(none.peersFailed).toBeUndefined();
  });

  it('herois mais jogados: contados na lista completa, com KDA do agregado', () => {
    const games: Record<number, number> = {};
    for (const m of fx.heroMatches) games[m.hero_id] = (games[m.hero_id] || 0) + 1;
    const counts = profile.mostPlayedHeroes.map((h) => h.matchCount);
    expect(profile.mostPlayedHeroes.length).toBe(8);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(counts[0]).toBe(Math.max(...Object.values(games)));
    const top = profile.mostPlayedHeroes[0];
    const rows = fx.heroMatches.filter((m: any) => m.hero_id === top.heroId);
    const sum = (k: string) => rows.reduce((s: number, m: any) => s + m[k], 0);
    expect(top.avgKda).toBeCloseTo((sum('kills') + sum('assists')) / sum('deaths'), 1);
    expect(top.winCount).toBe(rows.filter((m: any) => (m.player_slot < 128) === m.radiant_win).length);
    expect(profile.mostPlayedHeroes.every((h) => h.avgImp === null)).toBe(true);
  });

  it('a rota /heroes da fixture veio zerada: é por isso que ela nao é a fonte', () => {
    expect(fx.heroes.every((h: any) => h.games === 0)).toBe(true);
  });

  it('atividade cobre 30 dias e soma as partidas que caem na janela', () => {
    expect(profile.activityDays!.length).toBe(30);
    const cutoff = NOW.getTime() - 30 * 24 * 3600 * 1000;
    const total = profile.activityDays!.reduce((s, d) => s + d.count, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(fx.matches.filter((m: any) => m.start_time * 1000 >= cutoff).length);
    for (const d of profile.activityDays!) expect(d.wins + d.losses).toBe(d.count);
  });
});

describe('mapOpenDotaPlayerMatch', () => {
  it('uma linha por partida, com os totais da resposta', () => {
    expect(profile.recentMatches.length).toBe(fx.matches.length);
    profile.recentMatches.forEach((m, i) => {
      const r = fx.matches[i];
      expect(m.matchId).toBe(String(r.match_id));
      expect([m.kills, m.deaths, m.assists]).toEqual([r.kills, r.deaths, r.assists]);
      expect(m.goldPerMinute).toBe(r.gold_per_min);
      expect(m.numLastHits).toBe(r.last_hits);
      expect(m.isRadiant).toBe(r.player_slot < 128);
      expect(m.isVictory).toBe((r.player_slot < 128) === r.radiant_win);
      expect(m.items).toEqual([r.item_0, r.item_1, r.item_2, r.item_3, r.item_4, r.item_5]);
      expect(m.isParsed).toBe(r.version !== null && r.version !== undefined);
    });
  });

  it('o que a lista nao tem fica ausente: sem IMP, sem veredito de rota, sem posicao', () => {
    for (const m of profile.recentMatches) {
      expect(m.imp).toBeNull();
      expect(hasLaneVerdict(m.laneResult)).toBe(false);
      expect(m.role).toBe('UNKNOWN');
      expect(m.award).toBeUndefined();
      expect(m.killParticipationPct).toBeNull();
      expect(m.networth).toBeUndefined();
    }
  });

  it('modo e lobby numericos resolvem o tipo de partida', () => {
    const ranked = fx.matches.findIndex((r: any) => r.lobby_type === 7);
    const unranked = fx.matches.findIndex((r: any) => r.lobby_type === 0);
    expect(ranked).toBeGreaterThanOrEqual(0);
    expect(unranked).toBeGreaterThanOrEqual(0);
    const type = (i: number) => resolveMatchType(profile.recentMatches[i].gameMode, profile.recentMatches[i].lobbyType);
    expect(type(ranked)).toBe('RANKED');
    expect(type(unranked)).toBe('UNRANKED');
  });

  it('medalha media vira tier; grupo vem direto', () => {
    const r = fx.matches.find((x: any) => typeof x.average_rank === 'number');
    const m = mapOpenDotaPlayerMatch(r, tables);
    expect(m.bracket).toBe(Math.floor(r.average_rank / 10));
    expect(m.partySize).toBe(r.party_size ?? null);
  });

  it('Glint so onde ha tabela do heroi; sem tabela é null, nao zero', () => {
    const withTable = profile.recentMatches.filter((m) => tables[m.heroId]);
    const without = profile.recentMatches.filter((m) => !tables[m.heroId]);
    expect(withTable.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
    for (const m of withTable) {
      expect(typeof m.glint).toBe('number');
      expect(m.glint!).toBeGreaterThanOrEqual(0);
      expect(m.glint!).toBeLessThanOrEqual(100);
    }
    for (const m of without) {
      expect(m.glint).toBeNull();
      // Sem nota, o chip de dinamica so existe se decidido sem ela.
      expect([undefined, 'STOMP', 'COMEBACK']).toContain(m.dynamicType);
    }
  });
});

describe('classifyMatchDynamic', () => {
  const base = { isVictory: false, durationSeconds: 2400, kills: 3, deaths: 5, assists: 6, goldPerMinute: 400 };

  it('impacto nao depende de vitoria', () => {
    expect(classifyMatchDynamic(base, GLINT_THRESHOLDS.impact)).toBe('HIGH_IMPACT');
    expect(classifyMatchDynamic(base, GLINT_THRESHOLDS.poor)).toBe('LOW_IMPACT');
    expect(classifyMatchDynamic(base, GLINT_THRESHOLDS.neutral)).toBe('EVEN_MATCH');
  });

  it('sem nota, so o que nao depende dela', () => {
    expect(classifyMatchDynamic(base, null)).toBeUndefined();
    expect(classifyMatchDynamic({ ...base, isVictory: true, durationSeconds: 1500, goldPerMinute: 800 }, null)).toBe('STOMP');
    expect(classifyMatchDynamic({ ...base, isVictory: true, durationSeconds: 3000, deaths: 9 }, null)).toBe('COMEBACK');
  });
});

describe('mapOpenDotaPeers', () => {
  it('resposta que nao é lista vira lista vazia', () => {
    expect(mapOpenDotaPeers(null)).toEqual([]);
    expect(mapOpenDotaPeers({ error: 'x' })).toEqual([]);
  });

  it('descarta quem nunca jogou junto e nao inventa winrate', () => {
    const peers = mapOpenDotaPeers([
      { account_id: 1, with_games: 4, with_win: 3, personaname: 'a' },
      { account_id: 2, with_games: 0, with_win: 0 },
    ]);
    expect(peers.length).toBe(1);
    expect(peers[0].winRateWith).toBe(75);
  });
});

/**
 * Catalogo de patches com o formato REAL de `/constants/patch` (os tres ultimos itens, como a
 * OpenDota respondeu em 2026-11-19).
 */
const PATCH_RAW = [
  { name: '7.40', date: '2025-12-16T00:50:40.281Z', id: 59 },
  { name: '7.41', date: '2026-03-24T00:50:59.580Z', id: 60 },
  { name: '7.42', date: '2026-11-18T21:28:07.019Z', id: 61 },
];
const T742 = Math.floor(Date.parse('2026-11-18T21:28:07.019Z') / 1000);
const T741 = Math.floor(Date.parse('2026-03-24T00:50:59.580Z') / 1000);

describe('catalogo e janelas de patch', () => {
  it('mapPatchCatalog: mais recente primeiro, com a virada em segundos', () => {
    expect(mapPatchCatalog(PATCH_RAW).map((p) => [p.id, p.name, p.releasedAt])).toEqual([
      [61, '7.42', T742],
      [60, '7.41', T741],
      [59, '7.40', Math.floor(Date.parse('2025-12-16T00:50:40.281Z') / 1000)],
    ]);
    expect(mapPatchCatalog([{ name: '', id: 1, date: 'x' }, null, 'lixo'])).toEqual([]);
    expect(mapPatchCatalog(null)).toEqual([]);
  });

  it('patchWindows: cada patch vai ate a virada do seguinte; o atual fica aberto', () => {
    const w = patchWindows(mapPatchCatalog(PATCH_RAW));
    expect(w[0]).toEqual({ id: 61, name: '7.42', startsAt: T742, endsAt: null });
    expect(w[1]).toEqual({ id: 60, name: '7.41', startsAt: T741, endsAt: T742 });
  });
});

describe('filtro de patch: o servidor nao conhece o patch novo logo depois da virada', () => {
  const [w742, w741] = patchWindows(mapPatchCatalog(PATCH_RAW));
  const now = T742 + 20 * 3600; // 20 h depois da virada da 7.42

  it('patch atual vai por `?date=` (dias desde a virada, com folga), nao por `?patch=`', () => {
    // Em 2026-11-19 `?patch=61` voltava [] para uma conta com partidas de 7.42.
    expect(patchServerQuery(w742, now)).toEqual({ days: 2 });
  });

  it('patch anterior vai por `?patch=<id>`', () => {
    expect(patchServerQuery(w741, now)).toEqual({ patchId: 60 });
  });

  it('o endpoint pagina, filtra e projeta `start_time` quando ha patch', () => {
    expect(playerMatchesEndpoint(7, ['hero_id'], { limit: 40, offset: 80, patch: w741 }, now)).toBe(
      'players/7/matches?limit=40&offset=80&patch=60&project=hero_id&project=start_time',
    );
    expect(playerMatchesEndpoint(7, ['hero_id', 'start_time'], { patch: w742 }, now)).toBe(
      'players/7/matches?date=2&project=hero_id&project=start_time',
    );
    // Patch e periodo juntos: vale o menor periodo.
    expect(playerMatchesEndpoint(7, ['hero_id'], { patch: w742, days: 1 }, now)).toContain('date=1&');
    // Heroi no servidor, junto com o patch atual (que vai por `date`).
    expect(playerMatchesEndpoint(7, ['hero_id'], { limit: 40, heroId: 71, patch: w742 }, now)).toBe(
      'players/7/matches?limit=40&hero_id=71&date=2&project=hero_id&project=start_time',
    );
    // Sem filtro: so paginacao e campos, sem `offset=0`.
    expect(playerMatchesEndpoint(7, ['hero_id'], { limit: 40, offset: 0 }, now)).toBe('players/7/matches?limit=40&project=hero_id');
  });

  it('corte local: so a janela do patch, e linha sem `start_time` sai (nao da para afirmar o patch)', () => {
    const rows = [{ start_time: T742 + 10 }, { start_time: T742 - 10 }, { start_time: T741 - 1 }, {}];
    expect(filterRowsToPatch(rows, w742)).toEqual([{ start_time: T742 + 10 }]);
    expect(filterRowsToPatch(rows, w741)).toEqual([{ start_time: T742 - 10 }]);
    expect(filterRowsToPatch(rows, undefined)).toBe(rows);
  });
});

describe('mapHeroPerformance — a base da secao Herois', () => {
  it('conta todos os herois da lista completa, mais jogado primeiro', () => {
    const all = mapHeroPerformance(fx.heroMatches);
    const distinct = new Set(fx.heroMatches.map((m: any) => m.hero_id)).size;
    expect(all).toHaveLength(distinct);
    expect(all.reduce((s, h) => s + h.matchCount, 0)).toBe(fx.heroMatches.length);
    for (let i = 1; i < all.length; i++) expect(all[i].matchCount).toBeLessThanOrEqual(all[i - 1].matchCount);
  });

  it('os "mais jogados" sao o topo dela, com os mesmos numeros', () => {
    const all = mapHeroPerformance(fx.heroMatches);
    expect(mapMostPlayedHeroes(fx.heroMatches).map((h) => [h.heroId, h.matchCount, h.winRate, h.avgKda])).toEqual(
      all.slice(0, 8).map((h) => [h.heroId, h.matchCount, h.winRate, h.kda]),
    );
  });

  it('ultima vez jogado sai do `start_time`; sem o campo, null (a fixture antiga nao o projetava)', () => {
    expect(mapHeroPerformance(fx.heroMatches).every((h) => h.lastPlayed === null)).toBe(true);
    const comData = mapHeroPerformance(fx.matches);
    const top = comData[0];
    const max = Math.max(...fx.matches.filter((m: any) => m.hero_id === top.heroId).map((m: any) => m.start_time));
    expect(top.lastPlayed).toBe(max);
  });
});
