import { describe, expect, it } from 'vitest';
import { HEROES_MAP } from '../../../src/constants/heroes';
import type { HeroScore, MetaWinrate, PersonalWinrate, RankingCriterion } from '../../../src/types/heroGrid';
import { wilsonLowerBound } from '../../../src/utils/insights/wilson';
import {
  compareHeroScores,
  PERSONAL_WEIGHT_K,
  personalWeight,
  rankHeroes,
  recomputeScoreFromBreakdown,
} from '../../../src/utils/heroGrid/ranking';

/**
 * Testes da nota combinada (`ranking.ts`), invariantes I-15 a I-19 de
 * `specs/001-meta-hero-grid/data-model.md § 4`.
 *
 * Ambiente é `node` (sem DOM) e o modulo é puro, então nada aqui precisa de fake: os
 * testes montam `MetaWinrate`/`PersonalWinrate` a mao e conferem a saida.
 *
 * A tabela da curva de peso de `contracts/meta-sources.md § 4` é ancorada literalmente
 * abaixo, porque é ela que documenta a escolha de `K` — se `K` mudar sem que a tabela do
 * contrato mude junto, estes testes tem de ficar vermelhos.
 */

/** Ids que o catalogo do app conhece de verdade — L-5 depende dessa distincao. */
const KNOWN_HERO_A = 1;
const KNOWN_HERO_B = 8;
const KNOWN_HERO_C = 14;
/** Id que `HEROES_MAP` nao conhece: patch futuro, ou lixo no grid do jogador. */
const UNKNOWN_HERO = 999_999;

function makeMeta(heroId: number, wins: number, matchCount: number): MetaWinrate {
  return {
    heroId,
    source: 'OPENDOTA_BRACKET',
    winRate: matchCount > 0 ? wins / matchCount : 0,
    wins,
    matchCount,
    bracket: 'LEGEND_ANCIENT',
    bracketIsPlayerSpecific: true,
    patch: '7.39',
  };
}

function makePersonal(heroId: number, wins: number, games: number): PersonalWinrate {
  return { heroId, games, wins, winRate: games > 0 ? wins / games : 0 };
}

function score(
  heroIds: number[],
  criterion: RankingCriterion,
  meta: MetaWinrate[],
  personal: PersonalWinrate[] = [],
): HeroScore[] {
  return rankHeroes({ heroIds, criterion, meta, personal });
}

function one(
  heroId: number,
  criterion: RankingCriterion,
  meta: MetaWinrate[],
  personal: PersonalWinrate[] = [],
): HeroScore {
  return score([heroId], criterion, meta, personal)[0];
}

describe('sanidade das fixtures', () => {
  it('os ids conhecidos estao no catalogo e o desconhecido nao', () => {
    expect(HEROES_MAP[KNOWN_HERO_A]).toBeDefined();
    expect(HEROES_MAP[KNOWN_HERO_B]).toBeDefined();
    expect(HEROES_MAP[KNOWN_HERO_C]).toBeDefined();
    expect(HEROES_MAP[UNKNOWN_HERO]).toBeUndefined();
  });
});

describe('curva de peso do componente pessoal (I-16)', () => {
  it('K é 20 — a constante documentada do contrato', () => {
    expect(PERSONAL_WEIGHT_K).toBe(20);
  });

  // Tabela literal de `contracts/meta-sources.md § 4`. Tolerancia de 2 casas porque o
  // contrato arredonda (3 jogos => 0,13; o valor exato é 0,1304...).
  it.each([
    [0, 0.0],
    [3, 0.13],
    [10, 0.33],
    [20, 0.5],
    [50, 0.71],
    [100, 0.83],
  ])('com %i jogos o peso pessoal é ~%f', (games, expected) => {
    expect(personalWeight(games)).toBeCloseTo(expected, 2);
  });

  it('20 jogos é exatamente meio a meio — é a justificativa de K', () => {
    expect(personalWeight(PERSONAL_WEIGHT_K)).toBe(0.5);
  });

  it('games === 0 dá peso exatamente zero, nao só proximo de zero', () => {
    expect(personalWeight(0)).toBe(0);
  });

  it('é monotonico nao decrescente ao longo da sequencia de jogos', () => {
    const sequence = [0, 1, 2, 3, 5, 10, 20, 50, 100, 500];
    const weights = sequence.map(personalWeight);
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
    }
    // E cresce de fato: monotonicidade sozinha seria satisfeita por uma constante.
    expect(weights[weights.length - 1]).toBeGreaterThan(weights[0]);
  });

  it('nunca sai de 0..1, nem com jogos absurdos ou invalidos', () => {
    for (const games of [0, 1, 1_000_000, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const w = personalWeight(games);
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it('o peso reflete a mesma curva quando aplicado pelo ranking', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 600, 1000)];
    const withTen = one(KNOWN_HERO_A, 'COMBINED', metas, [makePersonal(KNOWN_HERO_A, 5, 10)]);
    const withHundred = one(KNOWN_HERO_A, 'COMBINED', metas, [makePersonal(KNOWN_HERO_A, 50, 100)]);
    expect(withTen.breakdown.personalWeight).toBeCloseTo(0.33, 2);
    expect(withHundred.breakdown.personalWeight).toBeCloseTo(0.83, 2);
  });
});

describe('breakdown coerente com a nota (I-15)', () => {
  it('toda nota nao-nula traz breakdown completo e recalculavel', () => {
    const heroIds = [KNOWN_HERO_A, KNOWN_HERO_B, KNOWN_HERO_C];
    const metas = [
      makeMeta(KNOWN_HERO_A, 600, 1000),
      makeMeta(KNOWN_HERO_B, 520, 4000),
      makeMeta(KNOWN_HERO_C, 40, 60),
    ];
    const personals = [
      makePersonal(KNOWN_HERO_A, 18, 30),
      makePersonal(KNOWN_HERO_B, 2, 3),
      // KNOWN_HERO_C sem historico pessoal de proposito.
    ];

    for (const criterion of ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'] as RankingCriterion[]) {
      const scores = score(heroIds, criterion, metas, personals);
      for (const s of scores) {
        if (s.score === null) continue;
        expect(s.breakdown).toBeDefined();
        expect(typeof s.breakdown.personalWeight).toBe('number');
        // A prova de coerencia: reaplicar a formula sobre o breakdown devolve a nota.
        expect(recomputeScoreFromBreakdown(s.breakdown)).toBeCloseTo(s.score, 12);
      }
    }
  });

  it('breakdown existe mesmo quando a nota é null — sem caminho que devolva HeroScore sem ele', () => {
    const casos: HeroScore[] = [
      one(UNKNOWN_HERO, 'COMBINED', [makeMeta(UNKNOWN_HERO, 600, 1000)]),
      one(KNOWN_HERO_A, 'COMBINED', []),
      one(KNOWN_HERO_A, 'META_ONLY', []),
      one(KNOWN_HERO_A, 'PERSONAL_ONLY', [makeMeta(KNOWN_HERO_A, 600, 1000)]),
    ];
    for (const s of casos) {
      expect(s.score).toBeNull();
      expect(s.breakdown).toBeDefined();
      expect(s.breakdown.personalWeight).toBe(0);
      expect(s.noDataReason).toBeDefined();
    }
  });

  it('a nota fica em 0..1 sempre que nao é null', () => {
    const heroIds = [KNOWN_HERO_A, KNOWN_HERO_B, KNOWN_HERO_C];
    const metas = [
      makeMeta(KNOWN_HERO_A, 1000, 1000),
      makeMeta(KNOWN_HERO_B, 0, 1000),
      makeMeta(KNOWN_HERO_C, 1, 2),
    ];
    const personals = [
      makePersonal(KNOWN_HERO_A, 0, 400),
      makePersonal(KNOWN_HERO_B, 400, 400),
      makePersonal(KNOWN_HERO_C, 1, 1),
    ];
    for (const criterion of ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'] as RankingCriterion[]) {
      for (const s of score(heroIds, criterion, metas, personals)) {
        if (s.score === null) continue;
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('COMBINED sem pessoal cai para meta puro, nao para null (I-17, FR-030c)', () => {
  it('sem nenhum dado pessoal a nota é o metaComponent puro', () => {
    const meta = makeMeta(KNOWN_HERO_A, 600, 1000);
    const s = one(KNOWN_HERO_A, 'COMBINED', [meta]);
    expect(s.score).not.toBeNull();
    expect(s.score).toBeCloseTo(wilsonLowerBound(600, 1000), 12);
    expect(s.breakdown.personalWeight).toBe(0);
    expect(s.breakdown.personalComponent).toBeNull();
    expect(s.noDataReason).toBeUndefined();
  });

  it('pessoal com games === 0 conta como ausencia — nao vira 0% pessoal', () => {
    const meta = makeMeta(KNOWN_HERO_A, 600, 1000);
    const s = one(KNOWN_HERO_A, 'COMBINED', [meta], [makePersonal(KNOWN_HERO_A, 0, 0)]);
    expect(s.score).toBeCloseTo(wilsonLowerBound(600, 1000), 12);
    expect(s.breakdown.personalWeight).toBe(0);
    expect(s.breakdown.personalComponent).toBeNull();
  });

  it('o caso rotulado é distinguivel de um COMBINED com pessoal', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 600, 1000), makeMeta(KNOWN_HERO_B, 600, 1000)];
    const [semPessoal, comPessoal] = score(
      [KNOWN_HERO_A, KNOWN_HERO_B],
      'COMBINED',
      metas,
      [makePersonal(KNOWN_HERO_B, 30, 40)],
    );
    expect(semPessoal.breakdown.personalWeight).toBe(0);
    expect(semPessoal.breakdown.personalComponent).toBeNull();
    expect(semPessoal.personal).toBeUndefined();

    expect(comPessoal.breakdown.personalWeight).toBeGreaterThan(0);
    expect(comPessoal.breakdown.personalComponent).not.toBeNull();
    expect(comPessoal.personal).toBeDefined();
    // Mesmo meta, pessoal bom => a nota tem de ser diferente da do herói sem pessoal.
    expect(comPessoal.score).not.toBeCloseTo(semPessoal.score as number, 6);
  });

  it('sem meta a nota é null com NO_META, em COMBINED e em META_ONLY', () => {
    for (const criterion of ['COMBINED', 'META_ONLY'] as RankingCriterion[]) {
      const s = one(KNOWN_HERO_A, criterion, [], [makePersonal(KNOWN_HERO_A, 30, 40)]);
      expect(s.score).toBeNull();
      expect(s.noDataReason).toBe('NO_META');
    }
  });

  it('meta com matchCount === 0 conta como ausencia de meta, nao como 0% de winrate', () => {
    const s = one(KNOWN_HERO_A, 'COMBINED', [makeMeta(KNOWN_HERO_A, 0, 0)]);
    expect(s.score).toBeNull();
    expect(s.noDataReason).toBe('NO_META');
    expect(s.breakdown.metaComponent).toBeNull();
  });
});

describe('PERSONAL_ONLY nunca cai para o meta em silencio (I-18, FR-032a)', () => {
  it('sem historico pessoal a nota é null com NO_PERSONAL_IN_PERSONAL_ONLY', () => {
    const meta = makeMeta(KNOWN_HERO_A, 600, 1000);
    const s = one(KNOWN_HERO_A, 'PERSONAL_ONLY', [meta]);
    expect(s.score).toBeNull();
    expect(s.noDataReason).toBe('NO_PERSONAL_IN_PERSONAL_ONLY');
    // Assercao negativa: a nota NAO é o valor do meta disfarcado.
    expect(s.score).not.toBe(wilsonLowerBound(600, 1000));
    expect(s.breakdown.personalWeight).toBe(0);
  });

  it('games === 0 tambem é ausencia em PERSONAL_ONLY', () => {
    const s = one(
      KNOWN_HERO_A,
      'PERSONAL_ONLY',
      [makeMeta(KNOWN_HERO_A, 600, 1000)],
      [makePersonal(KNOWN_HERO_A, 0, 0)],
    );
    expect(s.score).toBeNull();
    expect(s.noDataReason).toBe('NO_PERSONAL_IN_PERSONAL_ONLY');
  });

  it('com historico pessoal a nota é o pessoal puro e ignora o meta', () => {
    // Metas radicalmente diferentes, mesmo pessoal => mesma nota.
    const metas = [makeMeta(KNOWN_HERO_A, 900, 1000), makeMeta(KNOWN_HERO_B, 100, 1000)];
    const personals = [makePersonal(KNOWN_HERO_A, 30, 50), makePersonal(KNOWN_HERO_B, 30, 50)];
    const [a, b] = score([KNOWN_HERO_A, KNOWN_HERO_B], 'PERSONAL_ONLY', metas, personals);
    expect(a.score).not.toBeNull();
    expect(a.score).toBeCloseTo(wilsonLowerBound(30, 50), 12);
    expect(a.score).toBeCloseTo(b.score as number, 12);
  });

  it('sem meta e com pessoal, PERSONAL_ONLY ainda produz nota', () => {
    const s = one(KNOWN_HERO_A, 'PERSONAL_ONLY', [], [makePersonal(KNOWN_HERO_A, 30, 50)]);
    expect(s.score).toBeCloseTo(wilsonLowerBound(30, 50), 12);
    expect(s.noDataReason).toBeUndefined();
  });
});

describe('META_ONLY ignora o componente pessoal (T062)', () => {
  it('mesmo meta e pessoais radicalmente diferentes dao a MESMA nota', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 600, 1000), makeMeta(KNOWN_HERO_B, 600, 1000)];
    const personals = [makePersonal(KNOWN_HERO_A, 0, 200), makePersonal(KNOWN_HERO_B, 200, 200)];
    const [a, b] = score([KNOWN_HERO_A, KNOWN_HERO_B], 'META_ONLY', metas, personals);
    expect(a.score).toBeCloseTo(wilsonLowerBound(600, 1000), 12);
    expect(a.score).toBeCloseTo(b.score as number, 12);
    expect(a.breakdown.personalWeight).toBe(0);
    expect(b.breakdown.personalWeight).toBe(0);
  });

  it('o personalComponent continua preenchido para exibicao, mas fora da nota', () => {
    const s = one(
      KNOWN_HERO_A,
      'META_ONLY',
      [makeMeta(KNOWN_HERO_A, 600, 1000)],
      [makePersonal(KNOWN_HERO_A, 200, 200)],
    );
    expect(s.breakdown.personalComponent).toBeCloseTo(wilsonLowerBound(200, 200), 12);
    expect(s.breakdown.personalWeight).toBe(0);
    expect(s.score).toBeCloseTo(wilsonLowerBound(600, 1000), 12);
  });
});

describe('Wilson impede amostra pequena de furar a fila (I-19, FR-019)', () => {
  // O caso concreto: heroi A com 3/3 = 100% em 3 partidas contra heroi B com
  // 730/1000 = 73% em 1000. Com win rate cru A ganharia; com Wilson B fica na frente.
  it('A com 3/3 (100%, n=3) NAO passa B com 730/1000 (73%, n=1000)', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 3, 3), makeMeta(KNOWN_HERO_B, 730, 1000)];
    const [a, b] = score([KNOWN_HERO_A, KNOWN_HERO_B], 'COMBINED', metas);
    expect(a.score).not.toBeNull();
    expect(b.score).not.toBeNull();
    expect(b.score as number).toBeGreaterThan(a.score as number);
    // E a ordenacao concorda com a nota.
    const ordered = [a, b].slice().sort(compareHeroScores);
    expect(ordered[0].heroId).toBe(KNOWN_HERO_B);
  });

  it('a mesma protecao vale no componente pessoal: 3/3 pessoal nao supera 730/1000 pessoal', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 500, 1000), makeMeta(KNOWN_HERO_B, 500, 1000)];
    const personals = [makePersonal(KNOWN_HERO_A, 3, 3), makePersonal(KNOWN_HERO_B, 730, 1000)];
    const [a, b] = score([KNOWN_HERO_A, KNOWN_HERO_B], 'PERSONAL_ONLY', metas, personals);
    expect(b.score as number).toBeGreaterThan(a.score as number);
  });
});

describe('ordenacao exposta ao mirrorBuilder', () => {
  it('nota maior vem primeiro e nota null empata entre si (ordenacao estavel do chamador)', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 500, 1000), makeMeta(KNOWN_HERO_C, 800, 1000)];
    const scores = score([KNOWN_HERO_A, KNOWN_HERO_B, KNOWN_HERO_C], 'COMBINED', metas);
    const ordered = scores.slice().sort(compareHeroScores);
    expect(ordered.map((s) => s.heroId)).toEqual([KNOWN_HERO_C, KNOWN_HERO_A, KNOWN_HERO_B]);

    const semDado = scores.filter((s) => s.score === null);
    expect(semDado).toHaveLength(1);
    // Dois "sem dado" empatam: o comparador nao pode reordenar entre eles (I-9 depende disso).
    expect(compareHeroScores(semDado[0], semDado[0])).toBe(0);
  });

  it('rankHeroes preserva a ordem de entrada — quem ordena é o chamador', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 500, 1000), makeMeta(KNOWN_HERO_C, 900, 1000)];
    const scores = score([KNOWN_HERO_A, KNOWN_HERO_C], 'COMBINED', metas);
    expect(scores.map((s) => s.heroId)).toEqual([KNOWN_HERO_A, KNOWN_HERO_C]);
  });
});

describe('bordas: catalogo, amostra zero e entrada vazia', () => {
  it('heroi desconhecido pelo catalogo é preservado como HERO_UNKNOWN (L-5)', () => {
    const s = one(
      UNKNOWN_HERO,
      'COMBINED',
      [makeMeta(UNKNOWN_HERO, 600, 1000)],
      [makePersonal(UNKNOWN_HERO, 30, 40)],
    );
    expect(s.heroId).toBe(UNKNOWN_HERO);
    expect(s.score).toBeNull();
    expect(s.noDataReason).toBe('HERO_UNKNOWN');
    expect(s.breakdown.metaComponent).toBeNull();
    expect(s.breakdown.personalComponent).toBeNull();
  });

  it('matchCount 0 e games 0 nao produzem NaN nem divisao por zero', () => {
    for (const criterion of ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'] as RankingCriterion[]) {
      const s = one(
        KNOWN_HERO_A,
        criterion,
        [makeMeta(KNOWN_HERO_A, 0, 0)],
        [makePersonal(KNOWN_HERO_A, 0, 0)],
      );
      expect(s.score === null || Number.isFinite(s.score)).toBe(true);
      expect(Number.isNaN(s.breakdown.personalWeight)).toBe(false);
      expect(s.breakdown.metaComponent === null || Number.isFinite(s.breakdown.metaComponent)).toBe(true);
    }
  });

  it('entrada vazia devolve [] sem lancar', () => {
    expect(rankHeroes({ heroIds: [], criterion: 'COMBINED', meta: [], personal: [] })).toEqual([]);
    expect(rankHeroes({ heroIds: [], criterion: 'COMBINED', meta: [] })).toEqual([]);
  });

  it('heroId repetido na entrada devolve uma linha por ocorrencia, sem quebrar', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 600, 1000)];
    const scores = score([KNOWN_HERO_A, KNOWN_HERO_A], 'COMBINED', metas);
    expect(scores).toHaveLength(2);
    expect(scores[0].score).toBeCloseTo(scores[1].score as number, 12);
  });

  it('meta duplicado por heroId usa a primeira ocorrencia, de forma deterministica', () => {
    const metas = [makeMeta(KNOWN_HERO_A, 900, 1000), makeMeta(KNOWN_HERO_A, 100, 1000)];
    const s = one(KNOWN_HERO_A, 'META_ONLY', metas);
    expect(s.score).toBeCloseTo(wilsonLowerBound(900, 1000), 12);
  });
});
