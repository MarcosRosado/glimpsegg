import { describe, it, expect } from 'vitest';
import { mapStratzMatch } from '../../../src/services/stratzGql';
import fixture from '../../../src/services/__fixtures__/match-parsed.json';
import { buildInsightContext } from '../../../src/utils/insights/context';

const raw = (fixture as any).data.match;
const match = mapStratzMatch(raw);
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
      expect(ctx.benchmarks.networthPerMin!.sampleSize).toBeGreaterThan(200);
      expect(ctx.measured.networthPerMin).not.toBeNull();
    }
  });

  it('DEMONSTRA O BUG: com GPM no lado medido, a maioria estouraria o gatilho de 1.15', () => {
    // Reproduz a formula antiga sobre a MESMA fixture. Se este expect cair, a mistura
    // de unidades deixou de existir na fonte e o teste abaixo perdeu o sentido.
    const antigos = contexts.map((ctx) => ctx.player.goldPerMinute / ctx.benchmarks.networthPerMin!.value);
    const elogiosFalsos = antigos.filter((r) => r >= 1.15).length;
    expect(elogiosFalsos).toBeGreaterThanOrEqual(4);
    // E o lado `Low` era inalcancavel.
    expect(antigos.filter((r) => r <= 0.82).length).toBe(0);
  });

  it('com as duas pontas em patrimonio, a razao fica centrada em 1', () => {
    const ratios = contexts.map((ctx) => ctx.measured.networthPerMin! / ctx.benchmarks.networthPerMin!.value);
    for (const r of ratios) {
      expect(r).toBeGreaterThan(0.3);
      expect(r).toBeLessThan(3);
    }
    // Numa partida real ha quem farme acima e quem farme abaixo da media do heroi.
    // O sintoma do bug era a distribuicao inteira empurrada para cima.
    const media = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    expect(media).toBeGreaterThan(0.7);
    expect(media).toBeLessThan(1.3);
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
 * `killContributionAverage` nao vem na resposta real da STRATZ, mesmo com a query
 * pedindo. O codigo caia na constante de ROLE_BASELINES mas etiquetava HERO_AVERAGE
 * com sampleSize na casa dos milhares — a UI mostrava "media do heroi · n=4425" em
 * cima de uma estimativa estatica.
 */
describe('procedencia da participacao em abates', () => {
  it('a fixture real confirma a premissa: a STRATZ nao devolve killContributionAverage', () => {
    const temCampo = raw.players.some((p: any) =>
      (p.heroAverage ?? []).some((e: any) => e.killContributionAverage),
    );
    expect(temCampo).toBe(false);
  });

  it('sem o campo, o benchmark sai rotulado ROLE_BASELINE e SEM sampleSize', () => {
    for (const ctx of contexts) {
      const bench = ctx.benchmarks.killParticipationPct!;
      expect(bench.source).toBe('ROLE_BASELINE');
      expect(bench.sampleSize).toBeUndefined();
    }
  });

  it('quando o campo VEM, volta a ser media do heroi de verdade', () => {
    const comCampo = mapStratzMatch({
      ...raw,
      players: raw.players.map((p: any) => ({
        ...p,
        heroAverage: (p.heroAverage ?? []).map((e: any) => ({ ...e, killContributionAverage: 0.62 })),
      })),
    });
    const ctx = buildInsightContext(comCampo.players[0], comCampo, { threat: null, build: null });
    expect(ctx.benchmarks.killParticipationPct!.source).toBe('HERO_AVERAGE');
    expect(ctx.benchmarks.killParticipationPct!.value).toBeCloseTo(62, 5);
    expect(ctx.benchmarks.killParticipationPct!.sampleSize).toBeGreaterThan(200);
  });
});
