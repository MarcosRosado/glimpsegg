import { describe, it, expect } from 'vitest';
import { buildInsightContext } from '../../../src/utils/insights/context';
import { referenceMatch, withSyntheticHeroAverage } from '../../support/fixtureMatches';

/**
 * Partida real da OpenDota, com curva de media do heroi SINTETICA de razao 1: cada jogador
 * "jogou exatamente na media" (a curva é a propria serie dele). A STRATZ, que trazia a curva
 * real, saiu em 2026-11-19; com razao 1 a conta esperada é conhecida de antemao, o que deixa
 * o teste de unidade mais nitido do que era com a curva real.
 */
const base = referenceMatch();
const match = withSyntheticHeroAverage(base);
const contexts = match.players.map((p) => buildInsightContext(p, match, { threat: null, build: null }));

/**
 * O benchmark de economia comparava `player.goldPerMinute` (ouro GANHO) contra
 * `heroAverage.networth / min` (ouro ACUMULADO em itens e reserva). Unidades
 * diferentes, e o vies sempre no mesmo sentido: benchmark baixo demais.
 */
describe('benchmark de economia — patrimonio contra patrimonio', () => {
  it('o benchmark existe para todos, com procedencia de media do heroi', () => {
    for (const ctx of contexts) {
      expect(ctx.benchmarks.networthPerMin).not.toBeNull();
      expect(ctx.benchmarks.networthPerMin!.source).toBe('HERO_AVERAGE');
      expect(ctx.benchmarks.networthPerMin!.sampleSize).toBe(5000);
      expect(ctx.measured.networthPerMin).not.toBeNull();
    }
  });

  it('sem curva nao ha benchmark de economia — nada de cair em GPM de baseline', () => {
    // `ROLE_BASELINES.gpm` é ouro GANHO: usar como fallback traria de volta a mistura.
    for (const p of base.players) {
      const ctx = buildInsightContext(p, base, { threat: null, build: null });
      expect(ctx.benchmarks.networthPerMin).toBeNull();
    }
  });

  it('com as duas pontas em patrimonio, quem jogou na media fica exatamente em 1', () => {
    for (const ctx of contexts) {
      expect(ctx.measured.networthPerMin! / ctx.benchmarks.networthPerMin!.value).toBeCloseTo(1, 6);
    }
  });

  it('DEMONSTRA O BUG: com GPM no lado medido, jogar NA media ja estouraria o gatilho de 1.15', () => {
    // A formula antiga sobre os mesmos jogadores. Medido nesta fixture: de 1,02 a 1,41.
    // Se este expect cair, a mistura de unidades deixou de existir na fonte e o teste
    // acima perdeu o sentido.
    const antigos = contexts.map((ctx) => ctx.player.goldPerMinute / ctx.benchmarks.networthPerMin!.value);
    expect(antigos.filter((r) => r >= 1.15).length).toBeGreaterThanOrEqual(4);
    // E o lado `Low` era inalcancavel: todo mundo sai acima de 1.
    expect(antigos.every((r) => r > 1)).toBe(true);
  });

  it('mede o jogador e o benchmark NO MESMO minuto', () => {
    // Se as janelas divergirem, a razao compara fases diferentes do jogo.
    const ctx = contexts[0];
    const serie = ctx.player.series!.networthPerMinute!;
    const minuto = Math.round(ctx.player.networth / ctx.measured.networthPerMin!);
    expect(minuto).toBeLessThanOrEqual(serie.length);
    expect(minuto).toBeGreaterThan(0);
  });
});

/**
 * `killContributionAverage` nao vinha na resposta real da STRATZ, mesmo com a query
 * pedindo. O codigo caia na constante de ROLE_BASELINES mas etiquetava HERO_AVERAGE
 * com sampleSize na casa dos milhares — a UI mostrava "media do heroi · n=4425" em
 * cima de uma estimativa estatica. A curva sintetica reproduz os dois casos.
 */
describe('procedencia da participacao em abates', () => {
  it('sem o campo, o benchmark sai rotulado ROLE_BASELINE e SEM sampleSize', () => {
    for (const ctx of contexts) {
      const bench = ctx.benchmarks.killParticipationPct!;
      expect(bench.source).toBe('ROLE_BASELINE');
      expect(bench.sampleSize).toBeUndefined();
    }
  });

  it('quando o campo VEM, volta a ser media do heroi de verdade', () => {
    const comCampo = withSyntheticHeroAverage(base, { killContribution: 0.62 });
    const ctx = buildInsightContext(comCampo.players[0], comCampo, { threat: null, build: null });
    expect(ctx.benchmarks.killParticipationPct!.source).toBe('HERO_AVERAGE');
    expect(ctx.benchmarks.killParticipationPct!.value).toBeCloseTo(62, 5);
    expect(ctx.benchmarks.killParticipationPct!.sampleSize).toBe(5000);
  });
});
