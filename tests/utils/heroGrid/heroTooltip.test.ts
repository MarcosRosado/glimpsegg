import { describe, expect, it } from 'vitest';
import { NO_DATA_LABEL, metaSourceKey } from '../../../src/components/heroGrid/labels';
import type { HeroScore, MetaWinrate, PersonalWinrate } from '../../../src/types/heroGrid';
import { buildHeroTooltipRows, type TooltipRow } from '../../../src/utils/heroGrid/heroTooltip';

/**
 * O conteudo do tooltip do tile de heroi, agora como dado testavel.
 *
 * Antes era uma IIFE dentro do `HeroTile` que grudava tudo com ` · `: nada verificava se o
 * winrate saia acompanhado de fonte e amostra (FR-014), nem se `PERSONAL_ONLY` deixava de
 * cair no meta por engano. É exatamente o tipo de caminho que o bug das quatro wards
 * hardcoded mostrou que sobrevive quando ninguem olha.
 */
const meta = (over: Partial<MetaWinrate> = {}): MetaWinrate => ({
  heroId: 1,
  source: 'OPENDOTA_BRACKET',
  winRate: 0.532,
  wins: 5320,
  matchCount: 10000,
  bracket: 'LEGEND_ANCIENT',
  bracketIsPlayerSpecific: true,
  patch: '7.41e',
  ...over,
});

const personal = (over: Partial<PersonalWinrate> = {}): PersonalWinrate => ({
  heroId: 1,
  games: 40,
  wins: 24,
  winRate: 0.6,
  ...over,
});

const score = (over: Partial<HeroScore> = {}): HeroScore => ({
  heroId: 1,
  score: 0.526,
  breakdown: { metaComponent: 0.522, personalComponent: 0.451, personalWeight: 0.667 },
  meta: meta(),
  personal: personal(),
  criterion: 'COMBINED',
  ...over,
});

const build = (s: HeroScore | null, criterion: HeroScore['criterion'] = 'COMBINED') =>
  buildHeroTooltipRows(
    { heroName: 'Lion', score: s, criterion, bracketLabelKey: 'coachBracketYours' },
    metaSourceKey,
  );

const keys = (rows: TooltipRow[]) => rows.map((r) => r.labelKey).filter(Boolean);

describe('cabecalho e ausencia de dado', () => {
  it('a primeira linha é sempre o nome do heroi', () => {
    for (const s of [null, score(), score({ score: null })]) {
      expect(build(s)[0]).toEqual({ kind: 'HEADER', value: 'Lion' });
    }
  });

  it('sem `score`, a saida para no "sem dado" e NAO inventa motivo', () => {
    const rows = build(null);
    expect(keys(rows)).toEqual(['heroGridNoData']);
    // `score` ausente nao diz POR QUE. Escolher um motivo seria fabricar explicacao.
    expect(rows.some((r) => r.kind === 'NOTE')).toBe(false);
  });

  it('sem dado COM motivo, o motivo entra como nota', () => {
    const rows = build(score({ meta: undefined, personal: undefined, score: null, noDataReason: 'NO_META' }));
    expect(keys(rows)).toEqual(['heroGridNoData', 'heroGridNoDataNoMeta']);
  });

  it('sem dado nao emite winrate, nota nem parcela', () => {
    const rows = build(score({ meta: undefined, personal: undefined, score: null, noDataReason: 'NO_META' }));
    expect(rows.some((r) => r.kind === 'SCORE')).toBe(false);
    expect(keys(rows)).not.toContain('heroGridMetaComponent');
  });
});

describe('FR-014 — winrate nunca aparece sozinho', () => {
  it('todo winrate exibido vem com fonte e amostra', () => {
    const rows = build(score());
    const k = keys(rows);
    expect(k).toContain('heroGridMetaWinrate');
    expect(k).toContain('heroGridSourceOpenDota'); // procedencia
    expect(k).toContain('coachSampleSize'); // amostra
    expect(rows.find((r) => r.labelKey === 'coachSampleSize')?.labelParams).toEqual({ n: 10000 });
  });

  it('vale para as duas fontes de meta', () => {
    const rows = build(score({ meta: meta({ source: 'STRATZ_BRACKET' }) }));
    expect(keys(rows)).toContain('heroGridSourceStratz');
  });

  it('o ranque qualifica só o numero do META', () => {
    // No pessoal, "no seu ranque" sugeriria um recorte que nao foi feito.
    expect(keys(build(score(), 'META_ONLY'))).toContain('coachBracketYours');
    expect(keys(build(score(), 'PERSONAL_ONLY'))).not.toContain('coachBracketYours');
  });

  it('a chave do ranque é a que foi passada, e nao uma inferida', () => {
    const rows = buildHeroTooltipRows(
      { heroName: 'Lion', score: score(), criterion: 'META_ONLY', bracketLabelKey: 'coachBracketGeneric' },
      metaSourceKey,
    );
    expect(keys(rows)).toContain('coachBracketGeneric');
    expect(keys(rows)).not.toContain('coachBracketYours');
  });
});

describe('criterio manda no numero exibido', () => {
  it('PERSONAL_ONLY mostra o winrate pessoal, nao o meta', () => {
    const rows = build(score({ criterion: 'PERSONAL_ONLY' }), 'PERSONAL_ONLY');
    expect(keys(rows)).toContain('heroGridPersonalWinrate');
    expect(keys(rows)).not.toContain('heroGridMetaWinrate');
  });

  it('PERSONAL_ONLY sem historico diz "sem dado" — nao cai para o meta', () => {
    const rows = build(
      score({ personal: undefined, noDataReason: 'NO_PERSONAL_IN_PERSONAL_ONLY' }),
      'PERSONAL_ONLY',
    );
    expect(keys(rows)).toEqual(['heroGridNoData', 'heroGridNoDataNoPersonal']);
  });

  it('COMBINED acrescenta o winrate pessoal com o numero de partidas', () => {
    const rows = build(score(), 'COMBINED');
    expect(keys(rows)).toContain('heroGridPersonalWinrate');
    expect(rows.find((r) => r.labelKey === 'heroGridPersonalGames')?.labelParams).toEqual({ n: 40 });
  });

  it('COMBINED sem historico pessoal diz isso explicitamente', () => {
    const rows = build(score({ personal: undefined }), 'COMBINED');
    expect(keys(rows)).toContain('heroGridPersonalNone');
    expect(keys(rows)).not.toContain('heroGridPersonalGames');
  });

  it('zero jogos nao é 0% de vitoria', () => {
    const rows = build(score({ personal: personal({ games: 0, wins: 0, winRate: 0 }) }), 'COMBINED');
    expect(keys(rows)).toContain('heroGridPersonalNone');
  });

  it('META_ONLY nao acrescenta a linha pessoal do COMBINED', () => {
    const rows = build(score(), 'META_ONLY');
    expect(keys(rows)).not.toContain('heroGridPersonalNone');
    expect(keys(rows)).not.toContain('heroGridPersonalGames');
  });
});

describe('nota e parcelas', () => {
  it('a nota sai na escala 0..100, junto com as parcelas', () => {
    const rows = build(score());
    expect(rows.find((r) => r.kind === 'SCORE')).toEqual({
      kind: 'SCORE',
      labelKey: 'heroGridScoreLabel',
      value: '52.6',
    });
    // As parcelas na MESMA escala da nota: comparar 52.6 com 0.522 nao significa nada.
    expect(rows.find((r) => r.labelKey === 'heroGridMetaComponent')?.value).toBe('52.2');
    expect(rows.find((r) => r.labelKey === 'heroGridPersonalComponent')?.value).toBe('45.1');
  });

  it('score null nao vira linha de nota', () => {
    const rows = build(score({ score: null }));
    expect(rows.some((r) => r.kind === 'SCORE')).toBe(false);
  });

  it('avisa quando o componente pessoal nao foi aplicado', () => {
    const rows = build(
      score({
        personal: undefined,
        breakdown: { metaComponent: 0.522, personalComponent: null, personalWeight: 0 },
      }),
    );
    expect(keys(rows)).toContain('heroGridPersonalNotApplied');
  });

  it('parcela ausente simplesmente nao aparece', () => {
    const rows = build(
      score({ breakdown: { metaComponent: null, personalComponent: null, personalWeight: 0 } }),
    );
    expect(keys(rows)).not.toContain('heroGridMetaComponent');
    expect(keys(rows)).not.toContain('heroGridPersonalComponent');
  });
});

describe('as tabelas de motivo nao podem divergir', () => {
  it('o motivo emitido é o mesmo de NO_DATA_LABEL', () => {
    // `utils/` nao importa de `components/`, entao a tabela é repetida no modulo. Esta
    // asercao é o que impede as duas copias de andarem separadas.
    for (const [reason, esperado] of Object.entries(NO_DATA_LABEL)) {
      const rows = build(
        score({ meta: undefined, personal: undefined, score: null, noDataReason: reason as never }),
      );
      expect(keys(rows)).toEqual(['heroGridNoData', esperado]);
    }
  });
});
