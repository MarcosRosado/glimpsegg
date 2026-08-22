import { describe, it, expect } from 'vitest';
import { generateMatchInsights, ALL_RULES, evaluateRules } from './index';
import { buildInsightContext } from './context';
import { RULE_TEXT } from './ruleText';
import { IMPROVEMENT_SCORE_FLOOR, MAX_PER_CATEGORY, scoreToImpact } from './rank';
import { mapStratzMatch } from '../../services/stratzGql';
import fixture from '../../services/__fixtures__/match-parsed.json';
import { translations } from '../../i18n/translations';

const match = mapStratzMatch((fixture as any).data.match);

describe('sanidade do conjunto de regras', () => {
  it('todo ruleId é unico', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda regra tem texto nos DOIS idiomas', () => {
    for (const rule of ALL_RULES) {
      const text = RULE_TEXT[rule.id];
      expect(text, rule.id).toBeTruthy();
      for (const key of [text.title, text.body, text.stat, text.bench]) {
        if (!key) continue;
        expect(translations['pt-BR'][key], `${rule.id} pt-BR ${key}`).toBeTruthy();
        expect(translations['en-US'][key], `${rule.id} en-US ${key}`).toBeTruthy();
      }
    }
  });

  it('scoreToImpact respeita os limiares', () => {
    expect(scoreToImpact(70)).toBe('HIGH');
    expect(scoreToImpact(69)).toBe('MEDIUM');
    expect(scoreToImpact(40)).toBe('MEDIUM');
    expect(scoreToImpact(39)).toBe('LOW');
  });
});

describe('partida real parseada', () => {
  it('produz insights para todos os 10 jogadores sem explodir', () => {
    for (const p of match.players) {
      const out = generateMatchInsights(p, match);
      expect(Array.isArray(out.strengths)).toBe(true);
      expect(Array.isArray(out.improvements)).toBe(true);
    }
  });

  it('usa heroAverage como procedencia primaria, nao a baseline estatica', () => {
    const sources = new Set<string>();
    for (const p of match.players) {
      const out = generateMatchInsights(p, match);
      [...out.strengths, ...out.improvements].forEach((i) => sources.add(i.source));
    }
    expect(sources.has('HERO_AVERAGE')).toBe(true);
  });

  it('insights de benchmark carregam amostra na casa dos milhares', () => {
    const withSample = match.players
      .flatMap((p) => {
        const out = generateMatchInsights(p, match);
        return [...out.strengths, ...out.improvements];
      })
      .filter((i) => i.source === 'HERO_AVERAGE' && i.sampleSize);
    expect(withSample.length).toBeGreaterThan(0);
    expect(Math.max(...withSample.map((i) => i.sampleSize!))).toBeGreaterThan(1000);
  });

  it('ordena por score decrescente', () => {
    for (const p of match.players) {
      const out = generateMatchInsights(p, match);
      for (const list of [out.strengths, out.improvements]) {
        for (let i = 1; i < list.length; i += 1) {
          expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
        }
      }
    }
  });

  it('respeita o piso de score e o teto por categoria', () => {
    for (const p of match.players) {
      const out = generateMatchInsights(p, match);
      for (const i of out.improvements) {
        expect(i.score).toBeGreaterThanOrEqual(IMPROVEMENT_SCORE_FLOOR);
      }
      const perCategory = new Map<string, number>();
      for (const i of out.improvements) {
        perCategory.set(i.category, (perCategory.get(i.category) ?? 0) + 1);
      }
      for (const count of perCategory.values()) {
        expect(count).toBeLessThanOrEqual(MAX_PER_CATEGORY);
      }
    }
  });

  it('é deterministico', () => {
    const p = match.players[0];
    const a = generateMatchInsights(p, match);
    const b = generateMatchInsights(p, match);
    expect(a.improvements.map((i) => i.ruleId)).toEqual(b.improvements.map((i) => i.ruleId));
  });

  it('params sao numeros CRUS, nao strings formatadas', () => {
    const out = generateMatchInsights(match.players[0], match);
    const all = [...out.strengths, ...out.improvements];
    const numeric = all.flatMap((i) => Object.values(i.params)).filter((v) => typeof v === 'number');
    expect(numeric.length).toBeGreaterThan(0);
    // Nenhum param deve trazer separador de milhar ja aplicado.
    for (const i of all) {
      for (const v of Object.values(i.params)) {
        if (typeof v === 'string') expect(v).not.toMatch(/\d[.,]\d{3}/);
      }
    }
  });

  it('regras de visao dependem de dado real e sao coerentes com as wards', () => {
    const support = match.players.find(
      (p) => (p.visionStats?.wardsPlaced ?? 0) > 10,
    );
    expect(support).toBeTruthy();
    const out = generateMatchInsights(support!, match);
    const vision = [...out.strengths, ...out.improvements].filter((i) => i.category === 'VISION');
    // Se ha insight de visao, o jogador tem dado de visao.
    if (vision.length > 0) {
      expect(support!.visionStats?.hasData).toBe(true);
    }
  });
});

describe('REGRESSAO: fim do filler', () => {
  it('nao emite mais os insights genericos que nao derivavam de dado', () => {
    const removidos = ['str-neutral-utility', 'imp-bkb-timing', 'imp-buyback-discipline'];
    for (const p of match.players) {
      const out = generateMatchInsights(p, match);
      const ids = [...out.strengths, ...out.improvements].map((i) => i.ruleId);
      for (const removido of removidos) {
        expect(ids).not.toContain(removido);
      }
    }
  });

  it('nao ha piso artificial de 3 forcas e 3 melhorias', () => {
    // Entrada minima: nenhuma regra deve conseguir disparar com dado suficiente.
    const vazio = generateMatchInsights(
      { ...match.players[0], series: null, deathEvents: null, damageReport: null, heroAverageCurve: null, visionStats: undefined, laningStats: undefined, itemTimings: undefined } as any,
      {
        ...match,
        availability: {
          parsed: false, perMinuteStats: false, networthSeries: false, deathEvents: false,
          damageReport: false, wards: false, advantageTimeline: false, heroAverage: false,
          abilities: false, laneOutcomes: false,
        },
      },
    );
    // Pode sobrar alguma regra que só usa campos sempre presentes (GPM, mortes),
    // mas nao pode haver preenchimento até 3.
    expect(vazio.improvements.length).toBeLessThan(3);
  });
});

describe('partida NAO parseada', () => {
  const unparsed = {
    ...match,
    parsedDateTime: null,
    availability: {
      parsed: false, perMinuteStats: false, networthSeries: false, deathEvents: false,
      damageReport: false, wards: false, advantageTimeline: false, heroAverage: false,
      abilities: false, laneOutcomes: false,
    },
  };

  it('nenhum insight exige dado que nao existe', () => {
    for (const p of match.players) {
      const out = generateMatchInsights({ ...p, visionStats: undefined, wardEvents: undefined } as any, unparsed);
      const cats = [...out.strengths, ...out.improvements].map((i) => i.category);
      expect(cats).not.toContain('VISION');
      expect(cats).not.toContain('DEATHS');
      expect(cats).not.toContain('LANING');
    }
  });

  it('nenhum insight afirma procedencia HERO_AVERAGE sem a curva', () => {
    for (const p of match.players) {
      const out = generateMatchInsights({ ...p, heroAverageCurve: null } as any, unparsed);
      for (const i of [...out.strengths, ...out.improvements]) {
        expect(i.source).not.toBe('HERO_AVERAGE');
      }
    }
  });
});

describe('robustez', () => {
  it('entrada nula devolve vazio em vez de explodir', () => {
    expect(generateMatchInsights(null as any, null as any)).toEqual({ strengths: [], improvements: [] });
  });

  it('uma regra que lanca excecao nao derruba as outras', () => {
    const ctx = buildInsightContext(match.players[0], match, { threat: null, build: null });
    const bomb = {
      id: 'laningCsHigh' as const,
      category: 'LANING' as const,
      requires: [] as never[],
      evaluate: () => {
        throw new Error('boom');
      },
    };
    const original = ALL_RULES[0];
    ALL_RULES[0] = bomb as any;
    try {
      expect(() => evaluateRules(ctx)).not.toThrow();
    } finally {
      ALL_RULES[0] = original;
    }
  });
});
