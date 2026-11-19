import { describe, it, expect } from 'vitest';
import {
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

  it('é a soma do intercepto com percentil x peso, arredondada e presa em 0..100', () => {
    for (const role of ['core', 'support'] as const) {
      const w = GLINT_MODEL.weights[role];
      const expected = Math.round(Math.max(0, Math.min(100, w[0] + w.slice(1).reduce((s, x) => s + x * 0.5, 0))));
      expect(computeGlint(allAt(0.5), role)).toBe(expected);
    }
    expect(computeGlint(allAt(0), 'core')).toBe(0);
    expect(computeGlint(allAt(1), 'support')).toBeLessThanOrEqual(100);
  });

  it('sem papel usa os pesos sem papel', () => {
    const w = GLINT_MODEL.weights.any;
    expect(computeGlint(allAt(0.5), null)).toBe(Math.round(w[0] + w.slice(1).reduce((s, x) => s + x * 0.5, 0)));
  });

  it('percentil faltando devolve null: nota com metrica a menos seria outro modelo', () => {
    const pct: any = allAt(0.5);
    delete pct.deaths_per_min;
    expect(computeGlint(pct, 'core')).toBeNull();
    expect(computeGlint(null, 'core')).toBeNull();
    expect(computeGlint({ ...allAt(0.5), xp_per_min: NaN }, null)).toBeNull();
  });

  it('cada conjunto de pesos tem intercepto + um peso por metrica', () => {
    for (const w of Object.values(GLINT_MODEL.weights)) expect(w.length).toBe(GLINT_METRICS.length + 1);
  });

  it('limiares em ordem, com o neutro abaixo de 50 (a mediana medida é 45)', () => {
    const t = GLINT_THRESHOLDS;
    const ordered = [t.extremeLow, t.weak, t.poor, t.neutral, t.impact, t.good, t.strong, t.stomp, t.elite, t.extremeHigh];
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
    expect(t.neutral).toBeLessThan(50);
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
      expect(p.glint).toBe(computeGlint(glintPercentilesFromMatch(rp.benchmarks), glintRoleOf(p.position)));
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
    expect(Math.abs(computeGlint(fromTable, 'core')! - computeGlint(fromMatch, 'core')!)).toBeLessThanOrEqual(5);
  });

  it('sem tabela ou sem duracao nao ha percentil, logo nao ha nota', () => {
    const stats = { durationSeconds: 1800, goldPerMinute: 500, experiencePerMinute: 500, kills: 5, deaths: 5, assists: 5, lastHits: 100, denies: 5, heroDamage: 10000 };
    expect(computeGlint(glintPercentilesFromRaw(stats, null), null)).toBeNull();
    expect(computeGlint(glintPercentilesFromRaw({ ...stats, durationSeconds: 0 }, tables['82']), null)).toBeNull();
  });
});
