import { describe, it, expect } from 'vitest';
import {
  GLINT_MEDIAN,
  GLINT_METRICS,
  GLINT_MODEL,
  GLINT_THRESHOLDS,
  computeGlint,
  getGlintIconKind,
  glintPercentilesFromMatch,
  glintPercentilesFromRaw,
  glintRoleOf,
  percentileFromTable,
} from '../../src/utils/glint';
import { mapOpenDotaMatch } from '../../src/services/openDotaMatch';
import matchFixture from '../../src/services/__fixtures__/match-parsed-opendota.json';
import playerFixture from '../../src/services/__fixtures__/opendota-player.json';

const raw = matchFixture as any;
const tables = (playerFixture as any).benchmarks as Record<string, any>;

describe('computeGlint', () => {
  const allAt = (v: number) => Object.fromEntries(GLINT_METRICS.map((m) => [m, v]));

  const D = GLINT_MODEL.duration;
  /** A conta do modelo no ar, feita a mao: intercepto + percentil x peso + minuto x termo de duracao. */
  const byHand = (set: 'core' | 'support' | 'any', v: number, minutes: number) => {
    const w = GLINT_MODEL.weights[set];
    return w[0] + w.slice(1).reduce((s, x) => s + x * v, 0) + Math.min(D.capMinutes, minutes) * D[set];
  };

  it('é a soma do intercepto com percentil x peso e o termo de duracao, arredondada e presa em 0..100', () => {
    for (const role of ['core', 'support'] as const) {
      expect(computeGlint(allAt(0.5), role, 35 * 60)).toBe(Math.round(Math.max(0, Math.min(100, byHand(role, 0.5, 35)))));
    }
    expect(computeGlint(allAt(0), 'core', 35 * 60)).toBeGreaterThanOrEqual(0);
    expect(computeGlint(allAt(1), 'support', 20 * 60)).toBeLessThanOrEqual(100);
  });

  it('sem papel e sem heroi usa os pesos sem papel', () => {
    expect(computeGlint(allAt(0.5), null, 35 * 60)).toBe(Math.round(byHand('any', 0.5, 35)));
  });

  it('o modelo no ar exige duracao: sem ela a nota é null, nunca uma nota sem o termo', () => {
    expect(computeGlint(allAt(0.5), 'core')).toBeNull();
    expect(computeGlint(allAt(0.5), null, 0, undefined, 1)).toBeNull();
  });

  it('o modelo no ar so tem pesos nao negativos (R9)', () => {
    for (const w of Object.values(GLINT_MODEL.weights)) for (const x of w.slice(1)) expect(x).toBeGreaterThanOrEqual(0);
  });

  it('sem posicao, heroi da tabela mistura core e suporte pela fatia medida', () => {
    const [id, share] = Object.entries(GLINT_MODEL.heroCoreShare)[0];
    const mixed = share * byHand('core', 0.5, 35) + (1 - share) * byHand('support', 0.5, 35);
    expect(computeGlint(allAt(0.5), null, 35 * 60, undefined, Number(id))).toBe(Math.round(mixed));
  });

  it('percentil faltando devolve null: nota com metrica a menos seria outro modelo', () => {
    const pct: any = allAt(0.5);
    delete pct.deaths_per_min;
    expect(computeGlint(pct, 'core', 1800)).toBeNull();
    expect(computeGlint(null, 'core', 1800)).toBeNull();
    expect(computeGlint({ ...allAt(0.5), xp_per_min: NaN }, null, 1800)).toBeNull();
  });

  it('modelo sem termo de duracao (o formato do antigo, ajustado ao IMP): a duracao nao pesa', () => {
    const noDuration = { weights: GLINT_MODEL.weights };
    for (const role of ['core', 'support', null] as const) {
      for (const v of [0, 0.3, 0.5, 0.9]) {
        const base = computeGlint(allAt(v), role, undefined, noDuration);
        expect(base).not.toBeNull();
        expect(computeGlint(allAt(v), role, 2400, noDuration)).toBe(base);
        expect(computeGlint(allAt(v), role, null, noDuration)).toBe(base);
        expect(computeGlint(allAt(v), role, 0, noDuration, 1)).toBe(base);
      }
    }
  });

  describe('modelo com termo de duracao (o formato do reajuste contra o alvo proprio)', () => {
    // Pesos de forma, nao do reajuste: o que se testa é a conta, nao o candidato.
    const model = {
      weights: { core: [10, 10, 10, 10, 10, 10, 10, 10, 10], support: [20, 5, 5, 5, 5, 5, 5, 5, 5], any: [15, 8, 8, 8, 8, 8, 8, 8, 8] },
      duration: { core: -0.5, support: -1, any: -0.25, capMinutes: null },
    };

    it('soma pontos por minuto ao resultado dos oito pesos, pelo papel', () => {
      expect(computeGlint(allAt(0.5), 'core', 40 * 60, model)).toBe(Math.round(10 + 8 * 10 * 0.5 - 0.5 * 40));
      expect(computeGlint(allAt(0.5), 'support', 30 * 60, model)).toBe(Math.round(20 + 8 * 5 * 0.5 - 30));
      expect(computeGlint(allAt(0.5), null, 30 * 60, model)).toBe(Math.round(15 + 8 * 8 * 0.5 - 0.25 * 30));
    });

    it('sem duracao valida devolve null, como percentil faltando', () => {
      for (const d of [undefined, null, 0, -60, NaN]) expect(computeGlint(allAt(0.5), 'core', d, model)).toBeNull();
    });

    it('teto do minuto, quando o modelo tem', () => {
      const capped = { ...model, duration: { ...model.duration, capMinutes: 60 } };
      expect(computeGlint(allAt(0.9), 'core', 90 * 60, capped)).toBe(computeGlint(allAt(0.9), 'core', 60 * 60, capped));
    });

    it('a nota continua presa em 0..100', () => {
      expect(computeGlint(allAt(0), 'support', 120 * 60, model)).toBe(0);
    });

    describe('fatia de core do heroi (a nota sem posicao)', () => {
      const withShare = { ...model, heroCoreShare: { 1: 1, 5: 0, 8: 0.25 } };
      const raw = (b: number, w: number, beta: number, min: number) => b + 8 * w * 0.5 + beta * min;

      it('sem posicao, mistura core e suporte pela fatia, antes do corte', () => {
        const core = raw(10, 10, -0.5, 30);
        const sup = raw(20, 5, -1, 30);
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare, 8)).toBe(Math.round(0.25 * core + 0.75 * sup));
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare, 1)).toBe(computeGlint(allAt(0.5), 'core', 30 * 60, withShare));
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare, 5)).toBe(computeGlint(allAt(0.5), 'support', 30 * 60, withShare));
      });

      it('heroi fora da tabela, ou sem heroi, usa os pesos sem papel', () => {
        const any = computeGlint(allAt(0.5), null, 30 * 60, model);
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare, 999)).toBe(any);
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare)).toBe(any);
        expect(computeGlint(allAt(0.5), null, 30 * 60, withShare, null)).toBe(any);
      });

      it('com posicao conhecida a fatia nao pesa', () => {
        expect(computeGlint(allAt(0.5), 'support', 30 * 60, withShare, 1)).toBe(computeGlint(allAt(0.5), 'support', 30 * 60, model));
      });
    });
  });

  it('com posicao conhecida o heroi nao muda a nota do modelo no ar', () => {
    for (const role of ['core', 'support'] as const) {
      expect(computeGlint(allAt(0.6), role, 2400, undefined, 1)).toBe(computeGlint(allAt(0.6), role, 2400));
    }
  });

  it('cada conjunto de pesos tem intercepto + um peso por metrica', () => {
    for (const w of Object.values(GLINT_MODEL.weights)) expect(w.length).toBe(GLINT_METRICS.length + 1);
  });

  it('limiares em ordem, com o neutro na mediana (a escala da v5 é ancorada nela)', () => {
    const t = GLINT_THRESHOLDS;
    const ordered = [t.extremeLow, t.weak, t.poor, t.neutral, t.impact, t.good, t.strong, t.stomp, t.elite, t.extremeHigh];
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
    expect(t.neutral).toBe(GLINT_MEDIAN);
    expect(getGlintIconKind(t.extremeHigh)).toBe('STAR');
    expect(getGlintIconKind(t.extremeLow)).toBe('SKULL');
    expect(getGlintIconKind(50)).toBe('ZAP');
  });

  it('papel sai da posicao; sem posicao, null', () => {
    expect(glintRoleOf('POSITION_2')).toBe('core');
    expect(glintRoleOf('POSITION_5')).toBe('support');
    expect(glintRoleOf('UNKNOWN')).toBeNull();
    expect(glintRoleOf(undefined)).toBeNull();
  });
});

describe('Glint no mapper da partida (fixture real)', () => {
  const match = mapOpenDotaMatch(raw);

  it('os dez jogadores tem nota de 0 a 100, igual a conta feita a mao', () => {
    expect(match.availability.glint).toBe(true);
    for (const p of match.players) {
      const rp = raw.players.find((x: any) => x.player_slot === p.playerSlot);
      expect(p.glint).not.toBeNull();
      expect(p.glint).toBe(computeGlint(glintPercentilesFromMatch(rp.benchmarks), glintRoleOf(p.position), raw.duration, undefined, rp.hero_id));
      expect(p.glint).toBeGreaterThanOrEqual(0);
      expect(p.glint).toBeLessThanOrEqual(100);
    }
    // A nota nao é constante: separa os jogadores.
    expect(new Set(match.players.map((p) => p.glint)).size).toBeGreaterThan(5);
  });

  it('sem `benchmarks` nao ha nota, e a flag desliga', () => {
    const stripped = { ...raw, players: raw.players.map((p: any) => ({ ...p, benchmarks: undefined })) };
    const m = mapOpenDotaMatch(stripped);
    expect(m.players.every((p) => p.glint === null)).toBe(true);
    expect(m.availability.glint).toBe(false);
  });
});

describe('percentil pela tabela publica (o caminho da lista de partidas)', () => {
  it('interpola entre os pontos e trata as pontas', () => {
    const table = [
      { percentile: 0.1, value: 100 },
      { percentile: 0.5, value: 200 },
      { percentile: 0.99, value: 400 },
    ];
    expect(percentileFromTable(table, 150)).toBeCloseTo(0.3, 5);
    expect(percentileFromTable(table, 200)).toBeCloseTo(0.5, 5);
    expect(percentileFromTable(table, 50)).toBeCloseTo(0.05, 5);
    expect(percentileFromTable(table, 9999)).toBe(0.995);
    expect(percentileFromTable(undefined, 10)).toBeNull();
    expect(percentileFromTable(table, NaN)).toBeNull();
  });

  it('reproduz o `pct` que vem pronto na partida (Meepo da fixture), mortes invertidas', () => {
    const meepo = raw.players.find((p: any) => p.hero_id === 82);
    const fromTable = glintPercentilesFromRaw(
      {
        durationSeconds: raw.duration,
        goldPerMinute: meepo.gold_per_min,
        experiencePerMinute: meepo.xp_per_min,
        kills: meepo.kills,
        deaths: meepo.deaths,
        assists: meepo.assists,
        lastHits: meepo.last_hits,
        denies: meepo.denies,
        heroDamage: meepo.hero_damage,
      },
      tables['82'],
    );
    const fromMatch = glintPercentilesFromMatch(meepo.benchmarks);
    for (const m of GLINT_METRICS) {
      // A tabela é de outro dia que a partida: tolerancia larga, mas que pega inversao
      // (erro de ~0,5) e metrica trocada.
      expect(Math.abs(fromTable[m]! - fromMatch[m]!)).toBeLessThan(0.1);
    }
    const a = computeGlint(fromTable, 'core', raw.duration);
    const b = computeGlint(fromMatch, 'core', raw.duration);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Math.abs(a! - b!)).toBeLessThanOrEqual(5);
  });

  it('sem tabela ou sem duracao nao ha percentil, logo nao ha nota', () => {
    const stats = { durationSeconds: 1800, goldPerMinute: 500, experiencePerMinute: 500, kills: 5, deaths: 5, assists: 5, lastHits: 100, denies: 5, heroDamage: 10000 };
    expect(computeGlint(glintPercentilesFromRaw(stats, null), null, 1800)).toBeNull();
    expect(computeGlint(glintPercentilesFromRaw({ ...stats, durationSeconds: 0 }, tables['82']), null, 0)).toBeNull();
  });
});
