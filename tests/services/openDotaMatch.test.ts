import { describe, it, expect } from 'vitest';
import { isOpenDotaMatchParsed, mapOpenDotaMatch } from '../../src/services/openDotaMatch';
import fixture from '../../src/services/__fixtures__/match-parsed-opendota.json';
import unevenFixture from '../../src/services/__fixtures__/match-uneven-lane-opendota.json';
import { cumulativeLast, sumAll, sumDeltas } from '../../src/utils/insights/timeSeries';
import { stratzCellToMap } from '../../src/utils/minimapCoords';
import { WARD_DURATION_SEC } from '../../src/constants/mapGeometry';
import { generateMatchInsights, evaluateRules } from '../../src/utils/insights';
import { buildInsightContext } from '../../src/utils/insights/context';

/**
 * Mapper da OpenDota contra uma resposta 200 REAL e anonimizada de
 * `GET /api/matches/{id}`. Os numeros conferidos aqui sao lidos da propria fixture crua,
 * ao lado do mapeado: o teste afirma a TRADUCAO, nao o valor da captura.
 */
const raw = fixture as any;
const match = mapOpenDotaMatch(raw);
const rawBySlot = new Map<number, any>(raw.players.map((p: any) => [p.player_slot, p]));

describe('mapOpenDotaMatch — campos de partida', () => {
  it('mapeia os campos basicos', () => {
    expect(match.id).toBe(String(raw.match_id));
    expect(match.players).toHaveLength(10);
    expect(match.durationSeconds).toBe(raw.duration);
    expect(match.didRadiantWin).toBe(raw.radiant_win);
    expect(match.radiantScore).toBe(raw.radiant_score);
    expect(match.direScore).toBe(raw.dire_score);
    expect(match.firstBloodTime).toBe(raw.first_blood_time);
  });

  it('modo e lobby numericos viram os mesmos rotulos do caminho STRATZ', () => {
    expect(raw.game_mode).toBe(22);
    expect(raw.lobby_type).toBe(7);
    expect(match.gameMode).toBe('All Pick Ranqueado');
    expect(match.lobbyType).toBe('Ranqueada');
  });

  it('a curva de vantagem vem de radiant_gold_adv / radiant_xp_adv', () => {
    expect(match.advantageTimeline).toHaveLength(raw.radiant_gold_adv.length);
    expect(match.advantageTimeline[10].goldAdvantage).toBe(raw.radiant_gold_adv[10]);
    expect(match.advantageTimeline[10].experienceAdvantage).toBe(raw.radiant_xp_adv[10]);
  });
});

describe('mapOpenDotaMatch — jogadores', () => {
  it('KDA, itens, patrimonio e totais sao os da resposta', () => {
    for (const p of match.players) {
      const r = rawBySlot.get(p.playerSlot);
      expect([p.kills, p.deaths, p.assists]).toEqual([r.kills, r.deaths, r.assists]);
      expect(p.items).toEqual([r.item_0, r.item_1, r.item_2, r.item_3, r.item_4, r.item_5]);
      expect(p.neutralItem).toBe(r.item_neutral);
      expect(p.networth).toBe(r.net_worth);
      expect(p.numLastHits).toBe(r.last_hits);
      expect(p.heroDamage).toBe(r.hero_damage);
      expect(p.isRadiant).toBe(r.player_slot < 128);
    }
  });

  it('posicao sai de position_est e cada time tem as cinco', () => {
    for (const radiant of [true, false]) {
      const positions = match.players.filter((p) => p.isRadiant === radiant).map((p) => p.role).sort();
      expect(positions).toEqual(['POSITION_1', 'POSITION_2', 'POSITION_3', 'POSITION_4', 'POSITION_5']);
    }
  });

  it('rota sai de lane_role, e is_roaming vence', () => {
    const roamer = raw.players.find((p: any) => p.is_roaming);
    expect(roamer).toBeDefined();
    expect(match.players.find((p) => p.playerSlot === roamer.player_slot)!.lane).toBe('ROAMING');
    const mid = raw.players.find((p: any) => p.lane_role === 2 && !p.is_roaming);
    expect(match.players.find((p) => p.playerSlot === mid.player_slot)!.lane).toBe('MID');
  });

  it('sem position_est a posicao é UNKNOWN, nao palpite por rota', () => {
    const semPosicao = mapOpenDotaMatch({
      ...raw,
      players: raw.players.map((p: any) => ({ ...p, position_est: null })),
    });
    expect(semPosicao.players.every((p) => p.role === 'UNKNOWN' && p.position === undefined)).toBe(true);
  });
});

describe('mapOpenDotaMatch — series por minuto', () => {
  const p = match.players[0];
  const r = rawBySlot.get(p.playerSlot);

  it('cs vira DELTA: a soma é o cumulativo do ultimo minuto', () => {
    expect(sumAll(p.series!.lastHitsPerMinute)).toBe(r.lh_t[r.lh_t.length - 1] - r.lh_t[0]);
    expect(sumDeltas(p.series!.lastHitsPerMinute, 0, 10)).toBe(r.lh_t[10]);
  });

  it('patrimonio continua CUMULATIVO, como veio', () => {
    expect(p.series!.networthPerMinute).toEqual(r.networth_t);
    expect(cumulativeLast(p.series!.networthPerMinute)).toBe(r.networth_t[r.networth_t.length - 1]);
  });

  it('laningStats le os 10 primeiros minutos', () => {
    expect(p.laningStats!.lastHits10).toBe(r.lh_t[10]);
    expect(p.laningStats!.denies10).toBe(r.dn_t[10]);
    expect(p.laningStats!.gold10).toBe(r.networth_t[10]);
    expect(p.laningStats!.exp10).toBe(r.xp_t[10] - r.xp_t[0]);
    expect(p.laningStats!.kills10).toBe(r.kills_log.filter((k: any) => k.time <= 600).length);
  });

  it('dano recebido por minuto e nivel nao existem na OpenDota', () => {
    expect(p.series!.heroDamageReceivedPerMinute).toBeNull();
    expect(p.series!.level).toBeNull();
  });
});

describe('mapOpenDotaMatch — mortes', () => {
  it('um evento por morte, inclusive no heroi com varios corpos', () => {
    // O Meepo da fixture tem 7 mortes e 27 linhas no deaths_log (uma por clone).
    const meepo = raw.players.find((p: any) => p.deaths_log.length > p.deaths);
    expect(meepo).toBeDefined();
    for (const p of match.players) {
      expect(p.deathEvents?.length ?? 0).toBe(rawBySlot.get(p.playerSlot).deaths);
    }
  });

  it('morte com Aegis no deaths_log do Meepo nao vira evento', () => {
    // `deaths_log` REAL de um Meepo (7.42, par do aceite da Fase 1, 2026-11-19): 4 mortes no
    // placar das duas APIs e um quinto grupo, aos 1818 s com time_dead 5, que é a morte com
    // a Aegis pega aos 1743 s. So tempo, nome de heroi e time_dead: nada identificavel. As
    // linhas entram no lugar do log do Meepo da fixture; os outros jogadores nao mudam.
    const realLog: Array<[number, string, number]> = [
      [255, 'meepo', 18], [255, 'viper', 18],
      [917, 'meepo', 44], [917, 'meepo', 44], [917, 'viper', 44],
      [1259, 'meepo', 52], [1259, 'meepo', 52], [1259, 'viper', 52],
      [1574, 'meepo', 70], [1574, 'meepo', 70], [1574, 'meepo', 70], [1574, 'life_stealer', 70],
      [1818, 'meepo', 5], [1818, 'meepo', 5], [1818, 'viper', 5],
    ];
    const meepoRaw = raw.players.find((p: any) => p.deaths_log.length > p.deaths);
    const patched = {
      ...raw,
      players: raw.players.map((p: any) =>
        p === meepoRaw
          ? { ...p, deaths: 4, deaths_log: realLog.map(([time, hero, time_dead]) => ({ time, key: `npc_dota_hero_${hero}`, time_dead })) }
          : p,
      ),
    };
    const events = mapOpenDotaMatch(patched).players.find((p) => p.playerSlot === meepoRaw.player_slot)!.deathEvents!;
    expect(events.map((e) => e.time)).toEqual([255, 917, 1259, 1574]);
  });

  it('grupo a mais que NAO tem o tempo da Aegis fica: nao se descarta morte por palpite', () => {
    const meepoRaw = raw.players.find((p: any) => p.deaths_log.length > p.deaths);
    const before = match.players.find((p) => p.playerSlot === meepoRaw.player_slot)!.deathEvents!.length;
    const patched = {
      ...raw,
      players: raw.players.map((p: any) => (p === meepoRaw ? { ...p, deaths: p.deaths - 1 } : p)),
    };
    const after = mapOpenDotaMatch(patched).players.find((p) => p.playerSlot === meepoRaw.player_slot)!.deathEvents!;
    // Nenhuma morte do Meepo da fixture tem time_dead 5, entao nada pode sair.
    expect(after.some((e) => e.timeDead === 5)).toBe(false);
    expect(after.length).toBe(before);
  });

  it('o autor é um jogador do OUTRO time, nunca o proprio heroi', () => {
    const bySlot = new Map(match.players.map((p) => [p.playerSlot, p]));
    let comAutor = 0;
    for (const p of match.players) {
      for (const d of p.deathEvents ?? []) {
        if (d.attackerSlot === null || d.attackerSlot === undefined) continue;
        comAutor += 1;
        expect(bySlot.get(d.attackerSlot)!.isRadiant).toBe(!p.isRadiant);
      }
    }
    expect(comAutor).toBeGreaterThan(0);
  });

  it('nao ha coordenada de morte: nada vai para o mapa', () => {
    expect(match.vision.deaths).toEqual([]);
    expect(match.players.every((p) => (p.deathEvents ?? []).every((d) => d.x === undefined))).toBe(true);
  });
});

describe('mapOpenDotaMatch — visao', () => {
  const rawWardCount = raw.players.reduce(
    (s: number, p: any) => s + p.obs_log.length + p.sen_log.length,
    0,
  );

  it('mesma contagem de wards da resposta, nenhuma descartada', () => {
    expect(match.vision.source).toBe('PLAYBACK');
    expect(match.vision.wards).toHaveLength(rawWardCount);
    expect(match.vision.droppedEvents).toBe(0);
  });

  it('as celulas decimais caem no mesmo espaco do minimapa', () => {
    for (const w of match.vision.wards) expect(stratzCellToMap(w.x, w.y)).not.toBeNull();
    expect(match.vision.wards.some((w) => !Number.isInteger(w.x))).toBe(true);
  });

  it('ward que viveu a duracao inteira expirou sozinha, nao foi destruida', () => {
    const cheias = match.vision.wards.filter(
      (w) => !w.expiryInferred && w.lifetimeSeconds >= WARD_DURATION_SEC[w.type] - 1,
    );
    expect(cheias.length).toBeGreaterThan(0);
    expect(cheias.every((w) => !w.wasDestroyed && w.destroyedBySlot === null)).toBe(true);
  });

  it('deward tem autor do time adversario e herda a celula da ward', () => {
    const bySlot = new Map(match.players.map((p) => [p.playerSlot, p]));
    const destruidas = match.vision.wards.filter((w) => w.wasDestroyed);
    expect(destruidas.length).toBeGreaterThan(0);
    expect(match.vision.dewards).toHaveLength(destruidas.length);
    for (const w of destruidas) {
      const dono = bySlot.get(w.placedBySlot!)!;
      expect(bySlot.get(w.destroyedBySlot!)!.isRadiant).toBe(!dono.isRadiant);
    }
  });

  it('ward sem linha de saida tem fim ESTIMADO e rotulado', () => {
    const vivas = match.vision.wards.filter((w) => w.expiryInferred);
    expect(vivas.length).toBeGreaterThan(0);
    expect(vivas.every((w) => w.expireTime <= match.durationSeconds && !w.wasDestroyed)).toBe(true);
  });

  it('visionStats por jogador bate com o que ele colocou', () => {
    for (const p of match.players) {
      const r = rawBySlot.get(p.playerSlot);
      expect(p.visionStats!.observersPlaced).toBe(r.obs_log.length);
      expect(p.visionStats!.sentriesPlaced).toBe(r.sen_log.length);
    }
  });
});

describe('mapOpenDotaMatch — o que a OpenDota nao tem fica desligado', () => {
  it('availability diz exatamente o que veio', () => {
    expect(match.availability).toEqual({
      parsed: true,
      perMinuteStats: true,
      networthSeries: true,
      deathEvents: true,
      damageReport: false,
      wards: true,
      advantageTimeline: true,
      heroAverage: false,
      abilities: false,
      // Regra propria de rota (utils/laneVerdict.ts), nao campo da OpenDota.
      laneOutcomes: true,
      imp: false,
      glint: true,
      parsePending: false,
    });
  });

  it('veredito de rota sai so do patrimonio aos 10 min de quem estava na rota', () => {
    // Conta a mao sobre `networth_t[10]` da fixture, media por heroi de cada lado:
    //  top 2v2: Radiant (4639 + 2138) / 2 = 3388,5 x Dire (2048 + 4389) / 2 = 3218,5
    //           => +170 / 3303,5 = +0,051, abaixo do empate (0,0751) => TIE
    //  mid 1v1: 4728 x 5008 => -280 / 4868 = -0,058 => TIE
    //  bot 2v2: Radiant (1152 + 2963) / 2 = 2057,5 x Dire (2379 + 4009) / 2 = 3194
    //           => -1136,5 / 2625,75 = -0,4328, logo ABAIXO do atropelo (0,4332) => DIRE_VICTORY
    expect(match.laneOutcomes).toEqual({ top: 'TIE', mid: 'TIE', bottom: 'DIRE_VICTORY' });
    const bySlot = new Map(match.players.map((p) => [p.playerSlot, p]));
    expect(bySlot.get(3)!.laningStats!.laneResult).toBe('LOST');
    expect(bySlot.get(4)!.laningStats!.laneResult).toBe('LOST');
    expect(bySlot.get(129)!.laningStats!.laneResult).toBe('WON');
    expect(bySlot.get(131)!.laningStats!.laneResult).toBe('WON');
    for (const slot of [0, 1, 2, 128, 130, 132]) expect(bySlot.get(slot)!.laningStats!.laneResult).toBe('TIE');
    // O numero ao lado do badge é a diferenca DA ROTA, do lado do jogador.
    expect(bySlot.get(3)!.laningStats!.laneAdvantage).toEqual({ kind: 'VERDICT', lane: 'bottom', networthDiff: -2273, perHero: false, allies: 2, enemies: 2 });
    expect(bySlot.get(131)!.laningStats!.laneAdvantage!.networthDiff).toBe(2273);
    // `lane_role` 3 com `lane` 1: o Dire offlaner na bot. A rota é a geografica, sem conversao safe/off.
    expect(bySlot.get(129)!.laningStats!.laneAdvantage!.lane).toBe('bottom');
  });

  it('veredito de rota nao depende do resultado da partida', () => {
    const flipped = mapOpenDotaMatch({ ...raw, radiant_win: !raw.radiant_win });
    expect(flipped.laneOutcomes).toEqual(match.laneOutcomes);
  });

  it('nao ha IMP, media do heroi nem ordem de skills', () => {
    for (const p of match.players) {
      expect(p.imp).toBe(0);
      expect(p.heroAverageCurve).toBeNull();
      expect(p.abilityBuild).toBeNull();
      expect(p.damageReport?.receivedTotal ?? null).toBeNull();
    }
  });

  it('o relatorio parcial de dano so lista herois do time adversario', () => {
    const bySide = (radiant: boolean) =>
      new Set(match.players.filter((p) => p.isRadiant === radiant).map((p) => p.heroId));
    for (const p of match.players) {
      const inimigos = bySide(!p.isRadiant);
      expect(p.damageReport!.receivedTargets.length).toBeGreaterThan(0);
      expect(p.damageReport!.receivedTargets.every((t) => inimigos.has(t.heroId))).toBe(true);
    }
  });

  it('o motor de coaching roda sem estourar e nao usa benchmark de heroi', () => {
    for (const p of match.players) {
      const { strengths, improvements } = generateMatchInsights(p, match);
      for (const i of [...strengths, ...improvements]) {
        expect(i.source).not.toBe('HERO_AVERAGE');
        // `deaths_log` nao traz essas marcas; regra que depende delas nao pode disparar.
        expect(['deathsBurst', 'deathsWardWalk', 'deathsDieBack', 'deathsTpInterrupted', 'deathsHealUnused', 'compositeBurstNoDispel']).not.toContain(i.ruleId);
      }
    }
  });
});

describe('mapOpenDotaMatch — partida nao parseada', () => {
  // Sintetico AO LADO da fixture: a captura é de partida parseada. O recorte tira
  // exatamente o que o parser acrescenta, que é como a API responde antes do parse.
  const PARSED_ONLY = [
    'lh_t', 'dn_t', 'gold_t', 'xp_t', 'networth_t', 'hero_damage_t', 'tower_damage_t',
    'hero_healing_t', 'camps_stacked_t', 'obs_log', 'sen_log', 'obs_left_log', 'sen_left_log',
    'deaths_log', 'kills_log', 'purchase_log', 'damage_taken', 'damage_inflictor_received',
    'position_est', 'lane', 'lane_role', 'is_roaming',
  ];
  const strip = (p: any) => Object.fromEntries(Object.entries(p).filter(([k]) => !PARSED_ONLY.includes(k)));
  const unparsedRaw = {
    ...raw,
    version: null,
    radiant_gold_adv: null,
    radiant_xp_adv: null,
    players: raw.players.map(strip),
  };
  const unparsed = mapOpenDotaMatch(unparsedRaw);

  it('isOpenDotaMatchParsed olha `version`', () => {
    expect(isOpenDotaMatchParsed(raw)).toBe(true);
    expect(isOpenDotaMatchParsed(unparsedRaw)).toBe(false);
  });

  it('marca parse pendente e desliga tudo que depende do replay', () => {
    expect(unparsed.availability.parsed).toBe(false);
    expect(unparsed.availability.parsePending).toBe(true);
    expect(unparsed.availability.perMinuteStats).toBe(false);
    expect(unparsed.availability.wards).toBe(false);
    expect(unparsed.availability.deathEvents).toBe(false);
    expect(unparsed.vision.source).toBe('NONE');
    expect(unparsed.advantageTimeline).toEqual([]);
  });

  it('sem dado é undefined/null, nunca zero', () => {
    for (const p of unparsed.players) {
      expect(p.series).toBeNull();
      expect(p.laningStats).toBeUndefined();
      expect(p.wardEvents).toBeUndefined();
      expect(p.deathEvents).toBeNull();
      expect(p.itemTimings).toBeUndefined();
      expect(p.role).toBe('UNKNOWN');
      expect(p.lane).toBe('UNKNOWN');
    }
  });

  it('o placar final continua vindo', () => {
    expect(unparsed.players.map((p) => p.kills)).toEqual(match.players.map((p) => p.kills));
    expect(unparsed.radiantNetworth).toBe(match.radiantNetworth);
  });
});

/**
 * A segunda fixture real (`match-uneven-lane-opendota.json`), escolhida pelo que dispara e
 * nunca editada. Aqui o caminho de rota DESIGUAL roda sobre dado real, sem sobreposicao.
 */
describe('mapOpenDotaMatch — rota desigual na fixture real', () => {
  const m = mapOpenDotaMatch(unevenFixture as any);
  const bySlot = new Map(m.players.map((p) => [p.playerSlot, p]));
  const lane = (slot: number) => bySlot.get(slot)!.laningStats!;

  it('a rota pareada recebe veredito, as desiguais nao', () => {
    // Conta a mao sobre `networth_t[10]`, media por heroi de cada lado:
    //  bot 2v2: Radiant (5011 + 1862) / 2 = 3436,5 x Dire (2911 + 1798) / 2 = 2354,5
    //           => +1082 / 2895,5 = +0,374, entre empate e atropelo => RADIANT_VICTORY
    //  top 2v1: Radiant (5430 + 2437) / 2 = 3933,5 x Dire 3434 => desigual, sem outcome
    //  mid 1v2: Radiant 3932 x Dire (3604 + 2769) / 2 = 3186,5 (o 2769 é um roamer, que a
    //           regra conta na rota, como no ajuste) => desigual, sem outcome
    expect(m.laneOutcomes).toEqual({ top: null, mid: null, bottom: 'RADIANT_VICTORY' });
    expect(lane(0).laneResult).toBe('WON');
    expect(lane(131).laneResult).toBe('LOST');
    expect(lane(0).laneAdvantage).toEqual({ kind: 'VERDICT', lane: 'bottom', networthDiff: 2164, perHero: false, allies: 2, enemies: 2 });
  });

  it('rota desigual sai UNKNOWN com a diferenca POR HEROI, igual dos dois lados', () => {
    for (const slot of [1, 3, 129, 2, 128, 130]) expect(lane(slot).laneResult).toBe('UNKNOWN');
    // top: 3933,5 - 3434 = +499,5 por heroi para o Radiant
    expect(lane(1).laneAdvantage).toEqual({ kind: 'ADVANTAGE', lane: 'top', networthDiff: 500, perHero: true, allies: 2, enemies: 1 });
    expect(lane(129).laneAdvantage).toEqual({ kind: 'ADVANTAGE', lane: 'top', networthDiff: -500, perHero: true, allies: 1, enemies: 2 });
    // mid: 3932 - 3186,5 = +745,5 por heroi para o Radiant
    expect(lane(2).laneAdvantage!.networthDiff).toBe(746);
    expect(lane(128).laneAdvantage!.networthDiff).toBe(-746);
  });

  it('nas rotas desiguais nenhuma regra de veredito de rota dispara', () => {
    for (const slot of [1, 3, 129, 2, 128, 130]) {
      const ctx = buildInsightContext(bySlot.get(slot)!, m, { threat: null, build: null });
      const ids = evaluateRules(ctx).map((h) => h.ruleId);
      expect(ids).not.toContain('laningLaneLost');
      expect(ids).not.toContain('laningLaneStomped');
    }
  });

  it('as regras que motivaram a escolha da fixture disparam so com dado real', () => {
    const ids = new Set(
      m.players.flatMap((p) => evaluateRules(buildInsightContext(p, m, { threat: null, build: null })).map((h) => h.ruleId)),
    );
    for (const id of ['farmingStacksHigh', 'fightKpHigh', 'visionCoverageLow', 'laningLaneLost']) expect(ids.has(id), id).toBe(true);
  });
});
