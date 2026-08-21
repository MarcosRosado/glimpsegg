import { describe, it, expect } from 'vitest';
import { mapStratzMatch } from './stratzGql';
import fixture from './__fixtures__/match-parsed.json';
import { sumAll, cumulativeLast, sumDeltas, heroAverageAt } from '../utils/insights/timeSeries';

/**
 * Teste de integracao do mapper contra uma resposta 200 REAL da STRATZ
 * (anonimizada). É a rede que faltava: as quatro wards hardcoded sobreviveram
 * porque nada exercitava este caminho.
 */
const raw = (fixture as any).data.match;
const match = mapStratzMatch(raw);

describe('mapStratzMatch — campos de partida', () => {
  it('mapeia os campos basicos', () => {
    expect(match.players).toHaveLength(10);
    expect(match.durationSeconds).toBeGreaterThan(0);
    expect(match.radiantScore).toBeGreaterThan(0);
    expect(match.direScore).toBeGreaterThan(0);
  });

  it('marca a partida como parseada e NAO como mock', () => {
    expect(match.parsedDateTime).not.toBeNull();
    expect(match.availability.parsed).toBe(true);
    expect(match.isMockData).toBeUndefined();
  });

  it('traz bracket e rank reais', () => {
    expect(match.bracket).toBe(6);
    expect(match.actualRank).toBe(62);
  });

  it('traz resultado de lane real em vez de laneEfficiencyPct inventado', () => {
    expect(match.laneOutcomes.top).toBe('RADIANT_VICTORY');
    expect(match.laneOutcomes.mid).toBe('DIRE_VICTORY');
    expect(match.laneOutcomes.bottom).toBe('RADIANT_VICTORY');
    expect(match.availability.laneOutcomes).toBe(true);
  });
});

describe('REGRESSAO: as wards falsas morreram', () => {
  it('nao existem 4 wards identicas por jogador', () => {
    // O bug antigo dava exatamente 4 wards para TODOS os 10 jogadores.
    const counts = match.players.map((p) => p.wardEvents?.length ?? -1);
    expect(counts.every((c) => c === 4)).toBe(false);
  });

  it('a contagem de wards varia por posicao, como na vida real', () => {
    const counts = match.players.map((p) => p.wardEvents?.length ?? 0);
    expect(new Set(counts).size).toBeGreaterThan(2);
    expect(Math.max(...counts)).toBeGreaterThan(10);
  });

  it('pelo menos um core colocou zero ward — e isso é [] , nao undefined', () => {
    const zero = match.players.filter((p) => p.wardEvents?.length === 0);
    expect(zero.length).toBeGreaterThan(0);
    // [] significa "tem dado, colocou zero". undefined significaria "sem dado".
    expect(zero[0].wardEvents).toEqual([]);
  });

  it('as wards vem do playbackData, com tempo de vida real', () => {
    expect(match.vision.source).toBe('PLAYBACK');
    expect(match.vision.wards.length).toBeGreaterThan(20);
    const real = match.vision.wards.filter((w) => !w.expiryInferred);
    expect(real.length).toBeGreaterThan(0);
  });

  it('as wards nao estao empilhadas em 4 coordenadas fixas', () => {
    const coords = new Set(match.vision.wards.map((w) => `${w.x},${w.y}`));
    expect(coords.size).toBeGreaterThan(20);
  });

  it('existem wards dos DOIS times', () => {
    const teams = new Set(match.vision.wards.map((w) => w.team));
    expect(teams.has('RADIANT')).toBe(true);
    expect(teams.has('DIRE')).toBe(true);
  });

  it('existem wards pre-horn com tempo negativo preservado', () => {
    expect(match.vision.wards.some((w) => w.spawnTime < 0)).toBe(true);
  });

  it('existem dewards reais com atribuicao', () => {
    expect(match.vision.dewards.length).toBeGreaterThan(0);
    expect(match.vision.dewards.some((d) => d.bySlot !== null)).toBe(true);
  });

  it('toda coordenada de ward esta na faixa valida da STRATZ', () => {
    for (const w of match.vision.wards) {
      expect(w.x).toBeGreaterThanOrEqual(60);
      expect(w.x).toBeLessThanOrEqual(200);
      expect(w.y).toBeGreaterThanOrEqual(60);
      expect(w.y).toBeLessThanOrEqual(200);
    }
  });
});

describe('series por minuto e as invariantes de unidade', () => {
  it('INVARIANTE: sum(lastHitsPerMinute) === numLastHits em todos os jogadores', () => {
    for (const p of match.players) {
      const soma = sumAll(p.series?.lastHitsPerMinute);
      if (soma === null) continue;
      // A API pode truncar o ultimo minuto parcial, entao toleramos uma pequena
      // diferenca — o que importa é a ORDEM DE GRANDEZA estar certa (delta, nao cumulativo).
      expect(soma).toBeLessThanOrEqual(p.numLastHits);
      expect(soma).toBeGreaterThan(p.numLastHits * 0.8);
    }
  });

  it('INVARIANTE: networthPerMinute é CUMULATIVO, terminando perto do networth final', () => {
    for (const p of match.players) {
      const last = cumulativeLast(p.series?.networthPerMinute);
      if (last === null) continue;
      expect(last).toBeGreaterThan(p.networth * 0.85);
      // Se fosse tratado como delta, a soma seria multiplos do networth.
      const somaErrada = (p.series!.networthPerMinute || []).reduce((a, b) => a + b, 0);
      expect(somaErrada).toBeGreaterThan(p.networth * 3);
    }
  });

  it('networthPerMinute é um NIVEL cumulativo, nao um delta', () => {
    // Nao é monotonico: networth CAI quando o jogador morre (ouro perdido) ou da
    // buyback. O que caracteriza a serie como cumulativa é a escala — cada entrada
    // é o patrimonio naquele minuto, nao o ganho do minuto.
    const nw = match.players[0].series!.networthPerMinute!;
    // Comeca no ouro inicial, nao em ~0 como um delta comecaria.
    expect(nw[0]).toBeGreaterThan(400);
    // Cresce ao longo do jogo em ordem de grandeza.
    expect(nw[nw.length - 1]).toBeGreaterThan(nw[0] * 5);
    // Quedas existem, mas sao pequenas em relacao ao nivel (morte, nao reset).
    for (let i = 1; i < nw.length; i += 1) {
      if (nw[i] < nw[i - 1]) {
        expect(nw[i]).toBeGreaterThan(nw[i - 1] * 0.7);
      }
    }
  });
});

describe('laningStats — real, nao inventado', () => {
  it('CS@10 é a soma dos 10 primeiros minutos, nao numLastHits * 0.22', () => {
    const p = match.players[0];
    const esperado = sumDeltas(p.series!.lastHitsPerMinute, 0, 10);
    expect(p.laningStats!.lastHits10).toBe(esperado);
    // O valor antigo inventado, para garantir que nao é ele.
    expect(p.laningStats!.lastHits10).not.toBe(Math.round(p.numLastHits * 0.22));
  });

  it('gold10 le a posicao 10 do array cumulativo, nao a soma', () => {
    const p = match.players[0];
    expect(p.laningStats!.gold10).toBe(p.series!.networthPerMinute![10]);
  });

  it('laneResult é derivado da API, e nao existe mais laneEfficiencyPct', () => {
    const p = match.players[0];
    expect(p.laningStats!.laneResult).not.toBe('UNKNOWN');
    expect((p.laningStats as any).laneEfficiencyPct).toBeUndefined();
  });

  it('firstCoreItemTimingSec sai das compras reais, sem o 840 literal', () => {
    const comCore = match.players.filter((p) => p.laningStats?.firstCoreItemTimingSec != null);
    expect(comCore.length).toBeGreaterThan(0);
    const tempos = comCore.map((p) => p.laningStats!.firstCoreItemTimingSec);
    expect(new Set(tempos).size).toBeGreaterThan(1); // nao é constante
  });
});

describe('heroAverage como benchmark', () => {
  it('cada jogador traz a curva do proprio heroi, com amostra grossa', () => {
    expect(match.availability.heroAverage).toBe(true);
    for (const p of match.players) {
      expect(p.heroAverageCurve!.length).toBeGreaterThan(20);
    }
  });

  it('a curva é cumulativa: CS cresce com o tempo', () => {
    const p = match.players.find((x) => x.heroAverageCurve && x.heroAverageCurve.length > 25)!;
    const at10 = heroAverageAt(p.heroAverageCurve, 10, p.position);
    const at20 = heroAverageAt(p.heroAverageCurve, 20, p.position);
    expect(at10).not.toBeNull();
    expect(at20).not.toBeNull();
    expect(at20!.cs).toBeGreaterThan(at10!.cs);
    expect(at20!.networth).toBeGreaterThan(at10!.networth);
  });

  it('ALINHAMENTO: CS@10 do jogador e do benchmark ficam na mesma ordem de grandeza', () => {
    for (const p of match.players) {
      const bench = heroAverageAt(p.heroAverageCurve, 10, p.position);
      const seu = sumDeltas(p.series?.lastHitsPerMinute, 0, 10);
      if (!bench || seu === null || bench.cs < 5) continue;
      // Se o codigo confundisse delta com cumulativo, esta razao explodiria (~4.5x).
      expect(seu / bench.cs).toBeGreaterThan(0.1);
      expect(seu / bench.cs).toBeLessThan(4);
    }
  });
});

describe('forense de dano e morte', () => {
  it('traz o relatorio de dano recebido com a divisao fisico/magico', () => {
    expect(match.availability.damageReport).toBe(true);
    const p = match.players[0];
    const rt = p.damageReport!.receivedTotal!;
    expect(rt.physicalDamage + rt.magicalDamage).toBeGreaterThan(0);
    expect(p.damageReport!.receivedTargets.length).toBeGreaterThan(0);
    expect(p.damageReport!.receivedSourceAbility.length).toBeGreaterThan(0);
  });

  it('receivedTargets aponta heroIds que estao no time inimigo', () => {
    const p = match.players[0];
    const inimigos = new Set(
      match.players.filter((x) => x.isRadiant !== p.isRadiant).map((x) => x.heroId),
    );
    const alvos = p.damageReport!.receivedTargets.map((t) => t.heroId);
    expect(alvos.some((h) => inimigos.has(h))).toBe(true);
  });

  it('traz eventos de morte com coordenada e flags', () => {
    expect(match.availability.deathEvents).toBe(true);
    const comMortes = match.players.filter((p) => (p.deathEvents?.length ?? 0) > 0);
    expect(comMortes.length).toBeGreaterThan(5);
    const d = comMortes[0].deathEvents![0];
    expect(typeof d.x).toBe('number');
    expect(typeof d.time).toBe('number');
  });
});

describe('skill build real', () => {
  it('traz as habilidades com tempo, em vez do template fixo Q/W/E/R', () => {
    expect(match.availability.abilities).toBe(true);
    const p = match.players[0];
    expect(p.abilityBuild!.length).toBeGreaterThan(10);
    // Ordenado por tempo.
    for (let i = 1; i < p.abilityBuild!.length; i += 1) {
      expect(p.abilityBuild![i].timeSec).toBeGreaterThanOrEqual(p.abilityBuild![i - 1].timeSec);
    }
  });
});

describe('degradacao para partida nao parseada', () => {
  const semNada = mapStratzMatch({
    id: 1,
    didRadiantWin: true,
    durationSeconds: 2000,
    parsedDateTime: null,
    players: raw.players.map((p: any) => ({
      steamAccountId: p.steamAccountId,
      isRadiant: p.isRadiant,
      playerSlot: p.playerSlot,
      heroId: p.heroId,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      numLastHits: p.numLastHits,
      role: p.role,
      lane: p.lane,
    })),
  });

  it('availability reporta tudo ausente', () => {
    expect(semNada.availability.parsed).toBe(false);
    expect(semNada.availability.perMinuteStats).toBe(false);
    expect(semNada.availability.wards).toBe(false);
    expect(semNada.availability.damageReport).toBe(false);
    expect(semNada.availability.heroAverage).toBe(false);
  });

  it('visao é NONE e wardEvents é undefined — NUNCA ward inventada', () => {
    expect(semNada.vision.source).toBe('NONE');
    expect(semNada.vision.wards).toEqual([]);
    for (const p of semNada.players) {
      expect(p.wardEvents).toBeUndefined();
    }
  });

  it('laningStats é undefined em vez de estimado', () => {
    for (const p of semNada.players) {
      expect(p.laningStats).toBeUndefined();
    }
  });

  it('itemTimings é undefined em vez do ladder sintetico 300/840/1260/1680', () => {
    for (const p of semNada.players) {
      expect(p.itemTimings).toBeUndefined();
    }
  });

  it('laneOutcomes sao null, nao inventados', () => {
    expect(semNada.laneOutcomes.top).toBeNull();
    expect(semNada.laneOutcomes.mid).toBeNull();
    expect(semNada.availability.laneOutcomes).toBe(false);
  });
});
