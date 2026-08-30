import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type {
  HeroGridFile,
  HeroGridGroupView,
  HeroScore,
  MirrorGroupReport,
} from '../../../src/types/heroGrid';
import {
  MIRROR_LEGIBLE_SCALE,
  MIRROR_MAX_SCALE,
  MIRROR_MIN_SCALE,
  MIRROR_UNIT_SCALE,
  SCORE_QUALITY_MIN_SAMPLE,
  buildGroupViews,
  buildScoreQualityScale,
  formatGlimpseScore,
  buildMirrorCanvas,
  fitScale,
  mirrorHeroDisplay,
  resolveMirrorLayout,
  scaleCanvas,
  scoreQuality,
} from '../../../src/utils/heroGrid/mirrorLayout';

/**
 * O que este arquivo protege (specs/001-meta-hero-grid):
 *
 * `mirrorLayout` decide ONDE cada grupo da replica aparece e QUAL numero cada heroi exibe.
 * Os dois erros que ele existe para impedir sao invisiveis num teste de tipo: desenhar um
 * layout parecido com o do jogador mas errado, e exibir o winrate de uma fonte com o rotulo
 * de outra.
 *
 * As fixtures sao as mesmas de `mirrorBuilder.test.ts`, e pelo mesmo motivo:
 *
 * - `hero-grid-real.json` (1 layout, 8 grupos, geometria real) prova que a replica lida com
 *   o arquivo que o jogador realmente tem — inclusive com o layout comecando em x=41,7 e nao
 *   em zero, que é o caso que a normalizacao existe para tratar;
 * - `hero-grid-adverse.json` (3 layouts, dois de nome igual, categorias homonimas, GRUPO
 *   VAZIO, `version: 4`) existe porque com um layout so nada exercita a identidade por
 *   posicao, e grupo vazio é o caso em que uma view "esquecida" passaria despercebida.
 *
 * Lidas com `readFileSync` + `JSON.parse` (e nao `import ... from '*.json'`) porque
 * `resolveJsonModule` nao esta ligado no `tsconfig.app.json`, e porque cada teste precisa de
 * uma COPIA NOVA — sem isso, uma mutacao acidental mascararia justamente o que procuramos.
 */

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../../../src/services/__fixtures__/${name}`, import.meta.url));

const REAL_TEXT = readFileSync(fixturePath('hero-grid-real.json'), 'utf8');
const ADVERSE_TEXT = readFileSync(fixturePath('hero-grid-adverse.json'), 'utf8');

const realFile = (): HeroGridFile => JSON.parse(REAL_TEXT) as HeroGridFile;
const adverseFile = (): HeroGridFile => JSON.parse(ADVERSE_TEXT) as HeroGridFile;

/** Relatorio por grupo, do tamanho que o chamador quiser. */
function reports(entries: Array<[number, number]>): MirrorGroupReport[] {
  return entries.map(([ordered, withoutData], i) => ({
    categoryIndex: i,
    categoryName: `grupo ${i}`,
    ordered,
    withoutData,
  }));
}

/** View minima valida, para cada teste falar so da medida que esta exercitando. */
function view(partial: Partial<HeroGridGroupView>): HeroGridGroupView {
  return {
    categoryIndex: 0,
    categoryName: 'grupo',
    heroIds: [],
    ordered: 0,
    withoutData: 0,
    xPosition: 0,
    yPosition: 0,
    width: 100,
    height: 50,
    ...partial,
  };
}

/** Nota minima valida — os campos que importam entram por `partial`. */
function score(partial: Partial<HeroScore>): HeroScore {
  return {
    heroId: 1,
    score: 0.5,
    breakdown: { metaComponent: 0.5, personalComponent: null, personalWeight: 0 },
    criterion: 'COMBINED',
    ...partial,
  };
}

function meta(winRate: number, matchCount: number): HeroScore['meta'] {
  return {
    heroId: 1,
    source: 'OPENDOTA_BRACKET',
    winRate,
    wins: Math.round(winRate * matchCount),
    matchCount,
    bracket: 'ALL',
    bracketIsPlayerSpecific: false,
    patch: '7.39',
  };
}

function personal(winRate: number, games: number): HeroScore['personal'] {
  return { heroId: 1, games, wins: Math.round(winRate * games), winRate };
}

/* ------------------------------------------------------------------ *
 * buildGroupViews
 * ------------------------------------------------------------------ */

describe('buildGroupViews (fixture real)', () => {
  it('devolve uma view por categoria, na ordem do arquivo', () => {
    const file = realFile();
    const views = buildGroupViews(file, 0, []);

    expect(views).toHaveLength(8);
    expect(views.map((v) => v.categoryIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(views.map((v) => v.categoryName)).toEqual(
      file.configs[0].categories.map((c) => c.category_name),
    );
  });

  it('preserva a ORDEM dos hero_ids — é ela que o jogador ve no jogo', () => {
    const file = realFile();
    const views = buildGroupViews(file, 0, []);

    for (let i = 0; i < views.length; i += 1) {
      expect(views[i].heroIds).toEqual(file.configs[0].categories[i].hero_ids);
    }
    expect(views[0].heroIds.slice(0, 4)).toEqual([20, 41, 12, 67]);
  });

  it('copia as quatro coordenadas da categoria sem tocar (I-6)', () => {
    const file = realFile();
    const views = buildGroupViews(file, 0, []);

    for (let i = 0; i < views.length; i += 1) {
      const cat = file.configs[0].categories[i];
      expect(views[i].xPosition).toBe(cat.x_position);
      expect(views[i].yPosition).toBe(cat.y_position);
      expect(views[i].width).toBe(cat.width);
      expect(views[i].height).toBe(cat.height);
    }
    expect(views[0].xPosition).toBeCloseTo(43.47826, 5);
    expect(views[3].xPosition).toBeCloseTo(890.434814, 5);
    expect(views[4].yPosition).toBeCloseTo(343.478271, 5);
  });

  it('casa ordered/withoutData com o perGroup pela POSICAO', () => {
    const views = buildGroupViews(
      realFile(),
      0,
      reports([
        [17, 0],
        [10, 2],
        [22, 0],
        [20, 0],
        [14, 0],
        [13, 1],
        [14, 0],
        [15, 0],
      ]),
    );

    expect(views.map((v) => v.ordered)).toEqual([17, 10, 22, 20, 14, 13, 14, 15]);
    expect(views.map((v) => v.withoutData)).toEqual([0, 2, 0, 0, 0, 1, 0, 0]);
  });

  it('perGroup mais curto que as categorias nao quebra: cai em 0, sem inventar contagem', () => {
    const views = buildGroupViews(
      realFile(),
      0,
      reports([
        [17, 0],
        [10, 2],
      ]),
    );

    expect(views).toHaveLength(8);
    expect(views[1].ordered).toBe(10);
    expect(views[2]).toMatchObject({ ordered: 0, withoutData: 0 });
    expect(views[7]).toMatchObject({ ordered: 0, withoutData: 0 });
  });

  it('nao muta a entrada: reordenar a view nao mexe no arquivo lido', () => {
    const file = realFile();
    const before = JSON.stringify(file);
    const views = buildGroupViews(file, 0, []);

    views[0].heroIds.reverse();
    views[0].heroIds.push(9999);

    expect(JSON.stringify(file)).toBe(before);
  });

  it('indice inexistente devolve lista vazia, nao o primeiro layout', () => {
    expect(buildGroupViews(realFile(), 1, [])).toEqual([]);
    expect(buildGroupViews(realFile(), -1, [])).toEqual([]);
    expect(buildGroupViews(realFile(), 99, [])).toEqual([]);
  });

  it('config sem categories devolve lista vazia', () => {
    const file = { version: 3, configs: [{ config_name: 'X' }] } as unknown as HeroGridFile;
    expect(buildGroupViews(file, 0, [])).toEqual([]);
  });
});

describe('buildGroupViews (fixture adversa)', () => {
  it('le o layout pelo INDICE pedido, e nao pelo nome repetido', () => {
    const file = adverseFile();

    // Os configs 0 e 1 tem o MESMO `config_name`. Busca por nome pegaria sempre o primeiro.
    expect(buildGroupViews(file, 0, [])).toHaveLength(3);
    const second = buildGroupViews(file, 1, []);
    expect(second).toHaveLength(1);
    expect(second[0].categoryName).toBe('Só um grupo');
    expect(second[0].heroIds).toEqual([20, 9999]);
  });

  it('categorias homonimas ficam independentes, distinguidas pela posicao', () => {
    const views = buildGroupViews(adverseFile(), 0, []);

    expect(views[0].categoryName).toBe('Best with');
    expect(views[1].categoryName).toBe('Best with');
    expect(views[0].categoryIndex).toBe(0);
    expect(views[1].categoryIndex).toBe(1);
    expect(views[0].heroIds).toEqual([1, 8, 20]);
    expect(views[1].heroIds).toEqual([20, 41]);
    expect(views[0].yPosition).toBeCloseTo(0.869565, 5);
    expect(views[1].yPosition).toBeCloseTo(130.434784, 5);
  });

  it('grupo vazio vira view com heroIds: [], e nao some da replica', () => {
    const views = buildGroupViews(adverseFile(), 0, []);

    expect(views).toHaveLength(3);
    expect(views[2].categoryName).toBe('grupo Vazio');
    expect(views[2].heroIds).toEqual([]);
    expect(views[2].width).toBeCloseTo(145.217392, 5);
    expect(views[2].height).toBeCloseTo(64.347824, 5);
  });
});

/* ------------------------------------------------------------------ *
 * buildMirrorCanvas
 * ------------------------------------------------------------------ */

describe('buildMirrorCanvas (geometria real)', () => {
  it('usa a geometria do arquivo e devolve uma caixa por grupo', () => {
    const canvas = buildMirrorCanvas(buildGroupViews(realFile(), 0, []));

    expect(canvas.usesGeometry).toBe(true);
    expect(canvas.boxes).toHaveLength(8);
    expect(canvas.boxes.map((b) => b.categoryIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('normaliza contra o canto superior esquerdo (o layout real comeca em x=41,7)', () => {
    const views = buildGroupViews(realFile(), 0, []);
    const canvas = buildMirrorCanvas(views);

    const minX = Math.min(...views.map((v) => v.xPosition));
    const minY = Math.min(...views.map((v) => v.yPosition));
    expect(minX).toBeCloseTo(41.739132, 5);
    expect(minY).toBe(0);

    expect(Math.min(...canvas.boxes.map((b) => b.left))).toBeCloseTo(0, 6);
    expect(Math.min(...canvas.boxes.map((b) => b.top))).toBeCloseTo(0, 6);
    for (let i = 0; i < views.length; i += 1) {
      expect(canvas.boxes[i].left).toBeCloseTo(views[i].xPosition - minX, 5);
      expect(canvas.boxes[i].top).toBeCloseTo(views[i].yPosition - minY, 5);
    }
  });

  it('largura e altura sao o maior (left+width) e o maior (top+height)', () => {
    const views = buildGroupViews(realFile(), 0, []);
    const canvas = buildMirrorCanvas(views);

    // Grupo 3 (x=890,4 w=288,7) é o mais a direita; grupo 5 (y=340,9 h=241,7) o mais abaixo.
    expect(canvas.width).toBeCloseTo(890.434814 + 288.695648 - 41.739132, 5);
    expect(canvas.height).toBeCloseTo(340.869568 + 241.739136, 5);
    expect(canvas.width).toBeCloseTo(Math.max(...canvas.boxes.map((b) => b.left + b.width)), 6);
    expect(canvas.height).toBeCloseTo(Math.max(...canvas.boxes.map((b) => b.top + b.height)), 6);
  });

  it('as dimensoes de cada caixa saem intactas — so a posicao é transladada', () => {
    const views = buildGroupViews(realFile(), 0, []);
    const canvas = buildMirrorCanvas(views);

    for (let i = 0; i < views.length; i += 1) {
      expect(canvas.boxes[i].width).toBe(views[i].width);
      expect(canvas.boxes[i].height).toBe(views[i].height);
    }
  });

  it('a fixture adversa (grupo vazio incluso) tambem desenha', () => {
    const canvas = buildMirrorCanvas(buildGroupViews(adverseFile(), 0, []));

    expect(canvas.usesGeometry).toBe(true);
    expect(canvas.boxes).toHaveLength(3);
    expect(canvas.boxes[0].left).toBeCloseTo(0, 6);
    expect(canvas.boxes[2].left).toBeCloseTo(340.869568 - 43.47826, 5);
    expect(canvas.width).toBeCloseTo(340.869568 - 43.47826 + 145.217392, 5);
  });
});

describe('buildMirrorCanvas (casos degenerados)', () => {
  it('coordenada negativa é aceitavel: a normalizacao resolve', () => {
    const canvas = buildMirrorCanvas([
      view({ categoryIndex: 0, xPosition: -120, yPosition: -40, width: 100, height: 50 }),
      view({ categoryIndex: 1, xPosition: -20, yPosition: 10, width: 100, height: 50 }),
    ]);

    expect(canvas.usesGeometry).toBe(true);
    expect(canvas.boxes[0]).toMatchObject({ left: 0, top: 0 });
    expect(canvas.boxes[1]).toMatchObject({ left: 100, top: 50 });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  it('lista vazia nao é geometria', () => {
    expect(buildMirrorCanvas([])).toEqual({
      width: 0,
      height: 0,
      boxes: [],
      usesGeometry: false,
    });
  });

  it('width <= 0 em UM grupo derruba a geometria inteira (tudo-ou-nada)', () => {
    const canvas = buildMirrorCanvas([
      view({ categoryIndex: 0, width: 100, height: 50 }),
      view({ categoryIndex: 1, xPosition: 200, width: 0, height: 50 }),
    ]);

    expect(canvas.usesGeometry).toBe(false);
    expect(canvas.boxes).toEqual([]);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('height <= 0 tambem derruba', () => {
    expect(buildMirrorCanvas([view({ height: 0 })]).usesGeometry).toBe(false);
    expect(buildMirrorCanvas([view({ height: -10 })]).usesGeometry).toBe(false);
    expect(buildMirrorCanvas([view({ width: -1 })]).usesGeometry).toBe(false);
  });

  it('NaN ou Infinity em qualquer das quatro medidas derruba', () => {
    const bad = [
      view({ xPosition: Number.NaN }),
      view({ yPosition: Number.NaN }),
      view({ width: Number.NaN }),
      view({ height: Number.NaN }),
      view({ xPosition: Number.POSITIVE_INFINITY }),
      view({ yPosition: Number.NEGATIVE_INFINITY }),
      view({ width: Number.POSITIVE_INFINITY }),
      view({ height: Number.POSITIVE_INFINITY }),
    ];
    for (const group of bad) {
      const canvas = buildMirrorCanvas([view({ categoryIndex: 0 }), group]);
      expect(canvas.usesGeometry).toBe(false);
      expect(canvas.boxes).toEqual([]);
    }
  });

  it('um unico grupo valido continua sendo geometria valida', () => {
    const canvas = buildMirrorCanvas([view({ xPosition: 30, yPosition: 40 })]);

    expect(canvas.usesGeometry).toBe(true);
    expect(canvas.boxes).toEqual([
      { categoryIndex: 0, left: 0, top: 0, width: 100, height: 50 },
    ]);
    expect(canvas).toMatchObject({ width: 100, height: 50 });
  });
});

/* ------------------------------------------------------------------ *
 * fitScale
 * ------------------------------------------------------------------ */

describe('fitScale', () => {
  it('reduz proporcionalmente quando o canvas nao cabe', () => {
    expect(fitScale(1000, 800)).toBeCloseTo(0.8, 6);
    expect(fitScale(1137.39, 910)).toBeCloseTo(910 / 1137.39, 6);
  });

  it('nunca amplia: cabendo de sobra, fica no tamanho natural', () => {
    expect(fitScale(500, 1600)).toBe(MIRROR_MAX_SCALE);
    expect(fitScale(500, 500)).toBe(1);
  });

  it('nao encolhe abaixo do piso de legibilidade', () => {
    expect(fitScale(2000, 200)).toBe(MIRROR_MIN_SCALE);
    expect(MIRROR_MIN_SCALE).toBe(0.55);
    expect(MIRROR_MAX_SCALE).toBe(1);
  });

  it('respeita min/max explicitos', () => {
    expect(fitScale(1000, 100, 0.2, 0.9)).toBeCloseTo(0.2, 6);
    expect(fitScale(1000, 5000, 0.2, 0.9)).toBeCloseTo(0.9, 6);
    expect(fitScale(1000, 500, 0.2, 0.9)).toBeCloseTo(0.5, 6);
  });

  it('largura degenerada devolve max, e nao uma escala colapsada', () => {
    expect(fitScale(0, 800)).toBe(1);
    expect(fitScale(-10, 800)).toBe(1);
    expect(fitScale(Number.NaN, 800)).toBe(1);
    expect(fitScale(1000, 0)).toBe(1);
    expect(fitScale(1000, -5)).toBe(1);
    expect(fitScale(1000, Number.NaN)).toBe(1);
    expect(fitScale(1000, Number.POSITIVE_INFINITY)).toBe(1);
    expect(fitScale(0, 800, 0.3, 0.7)).toBe(0.7);
  });

  it('min > max devolve max, em vez de estourar o teto pedido', () => {
    expect(fitScale(1000, 100, 0.9, 0.5)).toBe(0.5);
    expect(fitScale(1000, 5000, 0.9, 0.5)).toBe(0.5);
  });
});

/* ------------------------------------------------------------------ *
 * mirrorHeroDisplay
 * ------------------------------------------------------------------ */

describe('mirrorHeroDisplay (META_ONLY)', () => {
  it('com meta exibe winrate, amostra e procedencia', () => {
    const out = mirrorHeroDisplay(score({ meta: meta(0.534, 12345) }), 'META_ONLY');

    expect(out).toEqual({
      kind: 'META',
      ratio: 0.534,
      sampleSize: 12345,
      source: 'OPENDOTA_BRACKET',
    });
  });

  it('SEM meta nao devolve o numero do pessoal', () => {
    const out = mirrorHeroDisplay(
      score({ personal: personal(0.71, 24), noDataReason: 'NO_META' }),
      'META_ONLY',
    );

    expect(out.kind).toBe('NONE');
    expect(out.ratio).toBeNull();
    expect(out.sampleSize).toBeNull();
    expect(out.source).toBeNull();
    expect(out.noDataReason).toBe('NO_META');
  });

  it('sem nada devolve NONE, com o motivo quando ele existe', () => {
    expect(mirrorHeroDisplay(score({}), 'META_ONLY')).toEqual({
      kind: 'NONE',
      ratio: null,
      sampleSize: null,
      source: null,
    });
    expect(mirrorHeroDisplay(score({ noDataReason: 'HERO_UNKNOWN' }), 'META_ONLY').noDataReason)
      .toBe('HERO_UNKNOWN');
  });
});

describe('mirrorHeroDisplay (COMBINED)', () => {
  it('exibe o meta, com procedencia', () => {
    const out = mirrorHeroDisplay(
      score({ meta: meta(0.482, 900), personal: personal(0.6, 10) }),
      'COMBINED',
    );

    expect(out).toEqual({
      kind: 'META',
      ratio: 0.482,
      sampleSize: 900,
      source: 'OPENDOTA_BRACKET',
    });
  });

  it('sem meta nao promove o pessoal a numero exibido', () => {
    const out = mirrorHeroDisplay(score({ personal: personal(0.6, 10) }), 'COMBINED');

    expect(out.kind).toBe('NONE');
    expect(out.ratio).toBeNull();
  });

  it('pessoal com 0 jogos nao muda nada — o meta continua mandando', () => {
    const out = mirrorHeroDisplay(
      score({ meta: meta(0.5, 100), personal: personal(0, 0) }),
      'COMBINED',
    );

    expect(out).toMatchObject({ kind: 'META', ratio: 0.5, sampleSize: 100 });
  });
});

describe('mirrorHeroDisplay (PERSONAL_ONLY)', () => {
  it('com historico exibe winrate pessoal e a contagem de jogos, sem fonte', () => {
    const out = mirrorHeroDisplay(score({ personal: personal(0.625, 16) }), 'PERSONAL_ONLY');

    expect(out).toEqual({
      kind: 'PERSONAL',
      ratio: 0.625,
      sampleSize: 16,
      source: null,
    });
  });

  it('SEM historico nao devolve o numero do meta', () => {
    const out = mirrorHeroDisplay(
      score({ meta: meta(0.55, 5000), noDataReason: 'NO_PERSONAL_IN_PERSONAL_ONLY' }),
      'PERSONAL_ONLY',
    );

    expect(out.kind).toBe('NONE');
    expect(out.ratio).toBeNull();
    expect(out.sampleSize).toBeNull();
    expect(out.source).toBeNull();
    expect(out.noDataReason).toBe('NO_PERSONAL_IN_PERSONAL_ONLY');
  });

  it('pessoal com 0 jogos é ausencia de historico, nao 0% de vitoria', () => {
    const out = mirrorHeroDisplay(
      score({ personal: personal(0, 0), meta: meta(0.55, 5000) }),
      'PERSONAL_ONLY',
    );

    expect(out.kind).toBe('NONE');
    expect(out.ratio).toBeNull();
  });

  it('winrate pessoal de 0% com jogos é numero legitimo, e é exibido', () => {
    const out = mirrorHeroDisplay(score({ personal: personal(0, 7) }), 'PERSONAL_ONLY');

    expect(out).toMatchObject({ kind: 'PERSONAL', ratio: 0, sampleSize: 7 });
  });
});

describe('mirrorHeroDisplay (bordas comuns aos tres criterios)', () => {
  it('score ausente devolve NONE SEM motivo — nao se inventa explicacao', () => {
    for (const criterion of ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'] as const) {
      const out = mirrorHeroDisplay(null, criterion);
      expect(out).toEqual({ kind: 'NONE', ratio: null, sampleSize: null, source: null });
      expect(out.noDataReason).toBeUndefined();
      expect(mirrorHeroDisplay(undefined, criterion).kind).toBe('NONE');
    }
  });

  it('winRate fora de 0..1 ou nao finito conta como ausente', () => {
    expect(mirrorHeroDisplay(score({ meta: meta(1.4, 100) }), 'META_ONLY').kind).toBe('NONE');
    expect(mirrorHeroDisplay(score({ meta: meta(-0.2, 100) }), 'META_ONLY').kind).toBe('NONE');
    expect(mirrorHeroDisplay(score({ meta: meta(Number.NaN, 100) }), 'COMBINED').kind).toBe(
      'NONE',
    );
    expect(
      mirrorHeroDisplay(score({ personal: personal(3.4, 9) }), 'PERSONAL_ONLY').kind,
    ).toBe('NONE');
    expect(
      mirrorHeroDisplay(score({ personal: personal(Number.NaN, 9) }), 'PERSONAL_ONLY').kind,
    ).toBe('NONE');
  });

  it('winrate 0 e 1 sao valores validos nas duas pontas', () => {
    expect(mirrorHeroDisplay(score({ meta: meta(0, 10) }), 'META_ONLY').ratio).toBe(0);
    expect(mirrorHeroDisplay(score({ meta: meta(1, 10) }), 'META_ONLY').ratio).toBe(1);
  });

  it('a procedencia acompanha o meta seja qual for a fonte', () => {
    const stratz = { ...meta(0.51, 400), source: 'STRATZ_BRACKET' as const };
    expect(mirrorHeroDisplay(score({ meta: stratz }), 'COMBINED').source).toBe('STRATZ_BRACKET');
  });
});

describe('scaleCanvas — zoom sem rearranjo', () => {
  const groups = buildGroupViews(realFile(), 0, []);

  it('multiplica as quatro medidas de toda caixa pelo mesmo fator', () => {
    const base = buildMirrorCanvas(groups);
    const scaled = scaleCanvas(base, 2);

    expect(scaled.usesGeometry).toBe(true);
    expect(scaled.width).toBeCloseTo(base.width * 2, 6);
    expect(scaled.height).toBeCloseTo(base.height * 2, 6);
    expect(scaled.boxes).toHaveLength(base.boxes.length);
    scaled.boxes.forEach((box, i) => {
      expect(box.categoryIndex).toBe(base.boxes[i].categoryIndex);
      expect(box.left).toBeCloseTo(base.boxes[i].left * 2, 6);
      expect(box.top).toBeCloseTo(base.boxes[i].top * 2, 6);
      expect(box.width).toBeCloseTo(base.boxes[i].width * 2, 6);
      expect(box.height).toBeCloseTo(base.boxes[i].height * 2, 6);
    });
  });

  it('preserva as proporcoes: escalar nao muda a razao entre duas caixas', () => {
    const base = buildMirrorCanvas(groups);
    const scaled = scaleCanvas(base, MIRROR_UNIT_SCALE);
    // A replica so continua sendo o layout do jogador se a geometria RELATIVA nao mudar.
    for (let i = 1; i < base.boxes.length; i += 1) {
      expect(scaled.boxes[i].left / scaled.width).toBeCloseTo(
        base.boxes[i].left / base.width,
        10,
      );
      expect(scaled.boxes[i].top / scaled.height).toBeCloseTo(
        base.boxes[i].top / base.height,
        10,
      );
    }
  });

  it('devolve o canvas intocado quando nao ha geometria', () => {
    const empty = buildMirrorCanvas([]);
    expect(scaleCanvas(empty, 2)).toBe(empty);
  });

  it('fator nao finito ou nao positivo devolve o canvas intocado', () => {
    const base = buildMirrorCanvas(groups);
    expect(scaleCanvas(base, 0)).toBe(base);
    expect(scaleCanvas(base, -1)).toBe(base);
    expect(scaleCanvas(base, NaN)).toBe(base);
  });

  it('o fator padrao é o calibrado contra a fixture real', () => {
    // Trava o numero: mexer nele sem refazer a conta de densidade quebra aqui.
    expect(MIRROR_UNIT_SCALE).toBe(1.75);
    expect(scaleCanvas(buildMirrorCanvas(groups)).width).toBeCloseTo(
      buildMirrorCanvas(groups).width * 1.75,
      6,
    );
  });
});

describe('resolveMirrorLayout — quando a geometria deixa de valer a pena', () => {
  const canvas = () => scaleCanvas(buildMirrorCanvas(buildGroupViews(realFile(), 0, [])));

  it('janela larga reproduz a geometria em tamanho natural, sem AMPLIAR', () => {
    const c = canvas();
    // Relativo à largura do canvas, e nao a um numero magico: a largura muda junto com
    // `MIRROR_UNIT_SCALE`, e o que se quer travar é "sobrou espaco => escala 1".
    expect(resolveMirrorLayout(c, c.width)).toEqual({ mode: 'GEOMETRY', scale: 1 });
    expect(resolveMirrorLayout(c, c.width * 2)).toEqual({ mode: 'GEOMETRY', scale: 1 });
  });

  it('janela apertada mas ainda legivel reproduz a geometria encolhida', () => {
    const c = canvas();
    const available = c.width * 0.9;
    const decision = resolveMirrorLayout(c, available);
    expect(decision.mode).toBe('GEOMETRY');
    expect(decision.scale).toBeCloseTo(0.9, 6);
  });

  it('abaixo do piso de legibilidade empilha em vez de encolher a tipografia', () => {
    // A replica em 5px nao é replica: a saida certa é abrir mao da geometria, com aviso.
    const c = canvas();
    expect(resolveMirrorLayout(c, c.width * (MIRROR_LEGIBLE_SCALE - 0.01)).mode).toBe(
      'FLOW_TOO_NARROW',
    );
    expect(resolveMirrorLayout(c, 400).mode).toBe('FLOW_TOO_NARROW');
    // Exatamente no piso ainda reproduz.
    expect(resolveMirrorLayout(c, c.width * MIRROR_LEGIBLE_SCALE).mode).toBe('GEOMETRY');
  });

  it('distingue os DOIS motivos de empilhar', () => {
    // Dizer "a geometria do seu arquivo nao serve" quando o problema é a janela seria uma
    // afirmacao falsa sobre o arquivo do jogador.
    expect(resolveMirrorLayout(buildMirrorCanvas([]), 1750).mode).toBe('FLOW_NO_GEOMETRY');
    expect(resolveMirrorLayout(canvas(), 200).mode).toBe('FLOW_TOO_NARROW');
  });

  it('largura ainda nao medida conta como cabe, para a tela nao piscar na montagem', () => {
    const c = canvas();
    expect(resolveMirrorLayout(c, 0)).toEqual({ mode: 'GEOMETRY', scale: MIRROR_MAX_SCALE });
    expect(resolveMirrorLayout(c, NaN)).toEqual({ mode: 'GEOMETRY', scale: MIRROR_MAX_SCALE });
  });

  it('o piso de legibilidade é o calibrado para o nome em text-xs', () => {
    expect(MIRROR_LEGIBLE_SCALE).toBe(0.7);
  });
});

describe('qualidade da nota — o que é nota boa neste layout', () => {
  const withScore = (heroId: number, score: number | null): HeroScore => ({
    heroId,
    score,
    breakdown: { metaComponent: 0.5, personalComponent: 0.5, personalWeight: 0.4 },
    criterion: 'COMBINED',
  });
  const ramp = (n: number) =>
    Array.from({ length: n }, (_, i) => withScore(i + 1, 0.30 + (i / (n - 1)) * 0.25));

  it('parte os herois em tres tercos deste espelho', () => {
    const scale = buildScoreQualityScale(ramp(30));
    expect(scale).not.toBeNull();
    expect(scale?.sampleSize).toBe(30);
    const buckets = ramp(30).map((s) => scoreQuality(s.score, scale));
    expect(buckets.filter((b) => b === 'POOR').length).toBe(10);
    expect(buckets.filter((b) => b === 'FAIR').length).toBe(10);
    expect(buckets.filter((b) => b === 'GOOD').length).toBe(10);
  });

  it('o limiar é uma nota que EXISTE na lista, para ser verificavel na tela', () => {
    const scores = ramp(30);
    const scale = buildScoreQualityScale(scores);
    const values = scores.map((s) => s.score);
    expect(values).toContain(scale?.fair);
    expect(values).toContain(scale?.good);
  });

  it('amostra pequena nao ganha cor: tercil de 6 herois é ruido', () => {
    expect(buildScoreQualityScale(ramp(SCORE_QUALITY_MIN_SAMPLE - 1))).toBeNull();
    expect(buildScoreQualityScale(ramp(SCORE_QUALITY_MIN_SAMPLE))).not.toBeNull();
    expect(buildScoreQualityScale([])).toBeNull();
    expect(buildScoreQualityScale(null)).toBeNull();
  });

  it('nota nula ou nao exibivel nao calibra a escala', () => {
    // FR-030b: o que nao se exibe nao pode deslocar o limiar de quem se exibe.
    const semNota = Array.from({ length: 20 }, (_, i) => withScore(100 + i, null));
    const semBreakdown = Array.from({ length: 20 }, (_, i) => ({
      ...withScore(200 + i, 0.9),
      breakdown: undefined as never,
    }));
    const base = buildScoreQualityScale(ramp(30));
    const poluido = buildScoreQualityScale([...ramp(30), ...semNota, ...semBreakdown]);
    expect(poluido).toEqual(base);
  });

  it('sem escala ou sem nota, nao ha cor — nunca um "intermediario" inventado', () => {
    const scale = buildScoreQualityScale(ramp(30));
    expect(scoreQuality(0.5, null)).toBeNull();
    expect(scoreQuality(null, scale)).toBeNull();
    expect(scoreQuality(NaN, scale)).toBeNull();
  });

  it('o corte é inclusivo no piso de cada faixa', () => {
    const scale = buildScoreQualityScale(ramp(30));
    expect(scoreQuality(scale!.good, scale)).toBe('GOOD');
    expect(scoreQuality(scale!.fair, scale)).toBe('FAIR');
    expect(scoreQuality(scale!.fair - 1e-9, scale)).toBe('POOR');
  });

  it('num layout real a nota mora abaixo de 0,5 — dai a escala ser relativa', () => {
    // Curva assimetrica, concentrada em baixo: é a forma que a nota tem por ser limite
    // inferior de Wilson, e nao o winrate observado. Num grid real de 127 herois a mediana
    // era 0,406 e apenas 5 passavam de 0,500. (Forma aproximada, nao o dado real.)
    const realista = Array.from({ length: 127 }, (_, i) =>
      withScore(i + 1, 0.28 + 0.3 * Math.pow(i / 126, 4)),
    );
    const acimaDeMeio = realista.filter((entry) => (entry.score as number) >= 0.5).length;
    const scale = buildScoreQualityScale(realista);
    const good = realista.filter((entry) => scoreQuality(entry.score, scale) === 'GOOD').length;

    // Um corte fixo em 0,500 marcaria quase nada como bom — o layout inteiro viraria
    // vermelho, que o dado nao sustenta. A escala relativa mantem a tela legivel.
    expect(acimaDeMeio).toBeLessThan(realista.length / 8);
    expect(good).toBeGreaterThan(realista.length / 4);
  });
});

describe('GlimpseScore — a escala que tira o 0.xxx da abstracao', () => {
  it('leva a razao 0..1 para 0..100 com uma casa', () => {
    expect(formatGlimpseScore(0.4263)).toBe('42.6');
    expect(formatGlimpseScore(0)).toBe('0.0');
    expect(formatGlimpseScore(1)).toBe('100.0');
    expect(formatGlimpseScore(0.5735)).toBe('57.4');
  });

  it('uma casa decimal evita empate visivel numa coluna lida como ranking', () => {
    // Duas notas distintas que o inteiro colapsaria no mesmo numero.
    expect(formatGlimpseScore(0.4261)).not.toBe(formatGlimpseScore(0.4289));
  });

  it('sem nota nao ha escala', () => {
    expect(formatGlimpseScore(null)).toBeNull();
    expect(formatGlimpseScore(undefined)).toBeNull();
    expect(formatGlimpseScore(NaN)).toBeNull();
  });

  it('a escala preserva a ordem — ela renomeia, nao reordena', () => {
    const raw = [0.2824, 0.3881, 0.4263, 0.5735];
    const scaled = raw.map((v) => Number(formatGlimpseScore(v)));
    expect(scaled).toEqual([...scaled].sort((a, b) => a - b));
  });
});
