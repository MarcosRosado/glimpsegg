import { describe, it, expect } from 'vitest';
import { generateMatchInsights, ALL_RULES } from '../../../src/utils/insights/index';
import { RULE_TEXT } from '../../../src/utils/insights/ruleText';
import { formatParams } from '../../../src/utils/insights/formatParams';
import { mapStratzMatch } from '../../../src/services/stratzGql';
import fixture from '../../../src/services/__fixtures__/match-parsed.json';
import { translations, Language } from '../../../src/i18n/translations';
import { BuildAdvice, BuildVerdict } from '../../../src/utils/buildAdvisor';
import { ThreatProfile } from '../../../src/utils/insights/threatProfile';
import { CoachingInsight, MatchDeathEvent } from '../../../src/types/dota';

/**
 * Guarda contra marcador i18n nao substituido.
 *
 * O bug que este arquivo existe para impedir: os textos de build usavam `{source}`,
 * mas o motor nunca emitia esse param, entao a interface mostrava literalmente
 * "vence 49,3% das partidas ({source})". O marcador foi renomeado para `{bracket}` —
 * `source` colidia com o campo `insight.source` (procedencia do benchmark), e foi essa
 * colisao de nome que fez ninguem perceber que o param nao estava ligado.
 */

const match = mapStratzMatch((fixture as any).data.match);

/** Params que a CAMADA DE RENDER injeta, nao o motor. Ver CoachingInsightsTab. */
const RENDER_PARAMS = { bracket: 'no seu ranque' };

/** Reproduz a substituicao do t() em LanguageContext. */
function fill(template: string, params: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

function placeholdersIn(s: string): string[] {
  return [...s.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
}

function renderAll(insight: CoachingInsight, lang: Language): { key: string; text: string }[] {
  const text = RULE_TEXT[insight.ruleId as keyof typeof RULE_TEXT];
  const params = { ...formatParams(insight.params, lang), ...RENDER_PARAMS };
  const out: { key: string; text: string }[] = [];
  for (const key of [text.title, text.body, text.stat, text.bench]) {
    if (!key) continue;
    out.push({ key, text: fill(translations[lang][key], params) });
  }
  return out;
}

// --- Insights reais da fixture (cobre as regras dirigidas por dados de partida) ---
const fromFixture: CoachingInsight[] = match.players.flatMap((p) => {
  const r = generateMatchInsights(p, match);
  return [...r.strengths, ...r.improvements];
});

// --- Build / matchup / composto: precisam de agregado, que a fixture nao tem ---
const verdictBase = {
  itemId: 116,
  playerTimeMin: 26,
  bestBandMin: [17, 19] as [number, number],
  bestBandWinRate: 0.732,
  playerBandWinRate: 0.48,
  heroBaselineWinRate: 0.52,
  sampleSize: 2553,
  magnitude: 0.8,
};
const verdicts: BuildVerdict[] = [
  { ...verdictBase, kind: 'LATE' },
  { ...verdictBase, kind: 'MISSING', itemId: 147 },
  { ...verdictBase, kind: 'OFF_META', itemId: 69 },
  { ...verdictBase, kind: 'GOOD', itemId: 145, playerTimeMin: 18 },
  {
    ...verdictBase,
    kind: 'COUNTER_PICK',
    threatArchetype: 'MAGIC_BURST',
    attributedHeroId: 26,
    attributedAbilityId: 5439,
  },
];
const build: BuildAdvice = {
  verdicts,
  heroBaselineWinRate: 0.52,
  totalSample: 40000,
  bracketIsPlayerSpecific: true,
};

const enemy = match.players.find((p) => p.isRadiant !== match.players[0].isRadiant)!;
const threat: ThreatProfile = {
  physicalPct: 0.28,
  magicalPct: 0.66,
  purePct: 0.06,
  totalReceived: 26000,
  controlRatio: 1.9,
  slowRatio: 1.1,
  topAttacker: { heroId: enemy.heroId, amount: 8000, pct: 0.41 },
  topAbility: { abilityId: 5439, count: 4, amount: 3200, pct: 0.3 },
  topItemSource: { itemId: 1604, amount: 511 },
  archetypes: ['MAGIC_BURST', 'HARD_LOCKDOWN'],
  hardestMatchups: [
    { heroId: enemy.heroId, ourWinRate: 0.385, ourWinRateLower: 0.37, matchCount: 2621, synergy: -5.1 },
  ],
};

// Jogador com padrao de morte por burst, para o insight composto disparar.
const burstDeaths: MatchDeathEvent[] = Array.from({ length: 8 }, (_, i) => ({
  time: 600 + i * 120,
  x: 120,
  y: 120,
  team: 'RADIANT',
  slot: 0,
  isBurst: i < 6,
}));
const burstPlayer = { ...match.players[0], deathEvents: burstDeaths } as any;

const fromBuild: CoachingInsight[] = (() => {
  const r = generateMatchInsights(burstPlayer, match, { threat, build });
  return [...r.strengths, ...r.improvements];
})();

const ALL = [...fromFixture, ...fromBuild];

describe('cobertura', () => {
  it('exercita um numero relevante de insights', () => {
    expect(fromFixture.length).toBeGreaterThan(20);
    expect(fromBuild.length).toBeGreaterThan(0);
  });

  it('cobre as regras de BUILD e MATCHUP, onde o bug estava', () => {
    const cats = new Set(fromBuild.map((i) => i.category));
    expect(cats.has('BUILD')).toBe(true);
    expect(cats.has('MATCHUP')).toBe(true);
  });
});

describe('nenhum marcador i18n fica sem substituicao', () => {
  for (const lang of ['pt-BR', 'en-US'] as Language[]) {
    it(`${lang}: todo texto renderizado sai sem {marcador}`, () => {
      const leftovers: string[] = [];
      for (const insight of ALL) {
        for (const { key, text } of renderAll(insight, lang)) {
          const remaining = placeholdersIn(text);
          if (remaining.length > 0) {
            leftovers.push(`${insight.ruleId} / ${key}: {${remaining.join('}, {')}}`);
          }
        }
      }
      expect(leftovers, `marcadores nao substituidos:\n${leftovers.join('\n')}`).toEqual([]);
    });

    it(`${lang}: nenhum texto contem a sequencia literal "{" apos render`, () => {
      for (const insight of ALL) {
        for (const { text } of renderAll(insight, lang)) {
          expect(text).not.toContain('{');
          expect(text).not.toContain('}');
        }
      }
    });
  }
});

describe('contrato dos marcadores por regra', () => {
  it('todo marcador de todo texto vem do motor ou da camada de render', () => {
    // Uniao dos params que cada regra realmente emitiu + os injetados no render.
    const emitted = new Map<string, Set<string>>();
    for (const insight of ALL) {
      const set = emitted.get(insight.ruleId) ?? new Set<string>();
      Object.keys(insight.params).forEach((k) => set.add(k));
      Object.keys(RENDER_PARAMS).forEach((k) => set.add(k));
      emitted.set(insight.ruleId, set);
    }

    const problemas: string[] = [];
    for (const [ruleId, available] of emitted) {
      const text = RULE_TEXT[ruleId as keyof typeof RULE_TEXT];
      for (const key of [text.title, text.body, text.stat, text.bench]) {
        if (!key) continue;
        for (const ph of placeholdersIn(translations['pt-BR'][key])) {
          if (!available.has(ph)) problemas.push(`${ruleId} / ${key} usa {${ph}}`);
        }
      }
    }
    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  it('pt-BR e en-US usam exatamente os mesmos marcadores em cada chave', () => {
    const diffs: string[] = [];
    for (const text of Object.values(RULE_TEXT)) {
      for (const key of [text.title, text.body, text.stat, text.bench]) {
        if (!key) continue;
        const a = placeholdersIn(translations['pt-BR'][key]).sort();
        const b = placeholdersIn(translations['en-US'][key]).sort();
        if (a.join(',') !== b.join(',')) diffs.push(`${key}: pt=[${a}] en=[${b}]`);
      }
    }
    expect(diffs, diffs.join('\n')).toEqual([]);
  });

  it('nenhuma regra ficou orfa de texto', () => {
    for (const rule of ALL_RULES) {
      expect(RULE_TEXT[rule.id], rule.id).toBeTruthy();
    }
  });
});
