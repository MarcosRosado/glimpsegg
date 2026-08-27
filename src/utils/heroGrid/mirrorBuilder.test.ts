import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  HeroGridCategory,
  HeroGridErrorCode,
  HeroGridFile,
  HeroGridResult,
  HeroScore,
  MirrorResult,
} from '../../types/heroGrid';
import { buildMirror, defaultMirrorName, removeMirror } from './mirrorBuilder';

/**
 * O que este arquivo protege (specs/001-meta-hero-grid):
 *
 * `mirrorBuilder` é o coracao da feature: é ele que decide o que vai para o arquivo do
 * jogador. As invariantes I-1 a I-10 de `data-model.md` e as regras N-1 a N-7 de
 * `contracts/hero-grid-file.md` nao tem tipo que as garanta — com `strict: false` e sem
 * index signature nas interfaces, quem garante é este arquivo.
 *
 * As duas fixtures sao usadas de proposito para coisas diferentes:
 *
 * - `hero-grid-real.json` (1 layout, 8 grupos, 128 entradas, heroi `20` em dois grupos,
 *   `version: 3`) prova que o app lida com o arquivo que o jogador realmente tem;
 * - `hero-grid-adverse.json` (3 layouts, dois de nome igual, categorias homonimas,
 *   categoria vazia, heroi em tres grupos, `version: 4`, campos desconhecidos, `hero_id`
 *   fora do catalogo) existe porque com UM layout a invariante I-2 ("nenhum outro config é
 *   alterado") passa **vazia**, e I-4a / I-4b / L-4 nunca sao exercitadas.
 *
 * As fixtures sao lidas com `readFileSync` + `JSON.parse` (e nao `import ... from
 * '*.json'`) por dois motivos: `resolveJsonModule` nao esta ligado no `tsconfig.app.json`,
 * e cada teste precisa de uma COPIA NOVA — um teste que mutasse o objeto compartilhado
 * mascararia justamente a violacao de I-1 que estamos procurando.
 */

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../../services/__fixtures__/${name}`, import.meta.url));

const REAL_TEXT = readFileSync(fixturePath('hero-grid-real.json'), 'utf8');
const ADVERSE_TEXT = readFileSync(fixturePath('hero-grid-adverse.json'), 'utf8');

/** Copia nova a cada uso. */
const realFile = (): HeroGridFile => JSON.parse(REAL_TEXT) as HeroGridFile;
const adverseFile = (): HeroGridFile => JSON.parse(ADVERSE_TEXT) as HeroGridFile;

/**
 * Monta `HeroScore[]` a mao — é ENTRADA da funcao, nao precisa de rede nem de `ranking.ts`.
 * `score: null` entra de proposito, para exercitar I-9 (heroi sem dado vai para o fim do
 * grupo, nao é descartado e nao ganha nota estimada).
 */
function makeScores(entries: Array<[number, number | null]>): HeroScore[] {
  return entries.map(([heroId, score]) => ({
    heroId,
    score,
    breakdown: {
      metaComponent: score,
      personalComponent: null,
      personalWeight: 0,
    },
    criterion: 'COMBINED' as const,
    ...(score === null ? { noDataReason: 'NO_META' as const } : {}),
  }));
}

/**
 * Desembrulha o resultado, falhando com a mensagem real em vez de `undefined`.
 *
 * O cast existe porque `tsconfig.app.json` tem `strict: false`: sem `strictNullChecks` o
 * TypeScript nao estreita a uniao discriminada de `HeroGridResult` pelo `success`, e cada
 * acesso a `.data` / `.code` seria erro de tipo. Concentrar o cast nestes dois helpers
 * mantem o resto do arquivo lendo o resultado como uniao de verdade.
 */
type MirrorFailure = { success: false; error: string; code?: HeroGridErrorCode };

function ok<T>(result: HeroGridResult<T>): T {
  if (result.success === true) return (result as { success: true; data: T }).data;
  const failed = result as MirrorFailure;
  throw new Error(`esperava sucesso, veio ${failed.code}: ${failed.error}`);
}

/** Afirma a recusa e devolve o ramo de falha, para inspecionar `code` e `error`. */
function failure(result: HeroGridResult<unknown>): MirrorFailure {
  expect(result.success).toBe(false);
  return result as MirrorFailure;
}

const heroIdsOf = (file: HeroGridFile, configIndex: number, categoryIndex: number): number[] =>
  file.configs[configIndex].categories[categoryIndex].hero_ids;

/** Ids do grupo, ordenados, para comparar CONJUNTO sem depender da ordem (I-7). */
const sortedIds = (ids: number[]): number[] => [...ids].sort((a, b) => a - b);

const SOURCE_REAL = { index: 0, name: 'Layout1' };

/* ------------------------------------------------------------------ *
 * T017 — fixture real: I-5 a I-10, I-1 e I-4
 * ------------------------------------------------------------------ */

describe('mirrorBuilder contra o grid real (I-1, I-4 a I-10)', () => {
  /**
   * Notas escolhidas para cair sobre os cinco primeiros ids de `Grupo Um`
   * (`[20, 41, 12, 67, 32, ...]`), deixando os demais sem dado. `67` e `32` empatam de
   * proposito, para o desempate ficar verificavel.
   */
  const SCORES = makeScores([
    [12, 0.6],
    [41, 0.55],
    [20, 0.52],
    [67, 0.5],
    [32, 0.5],
  ]);

  const build = (file: HeroGridFile) =>
    buildMirror({ file, source: SOURCE_REAL, mirror: null, scores: SCORES });

  it('espelha o mesmo numero de grupos, com nomes e coordenadas identicos aos da origem (I-5, I-6)', () => {
    const file = realFile();
    const result = ok(build(file));
    const source = file.configs[0];
    const mirror = result.file.configs[result.mirror.index];

    expect(mirror.categories).toHaveLength(source.categories.length);
    expect(mirror.categories).toHaveLength(8);

    mirror.categories.forEach((category: HeroGridCategory, i: number) => {
      const origin = source.categories[i];
      expect(category.category_name).toBe(origin.category_name);
      expect(category.x_position).toBe(origin.x_position);
      expect(category.y_position).toBe(origin.y_position);
      expect(category.width).toBe(origin.width);
      expect(category.height).toBe(origin.height);
    });
  });

  it('preserva o conjunto e a cardinalidade de hero_ids em cada grupo (I-7)', () => {
    const file = realFile();
    const result = ok(build(file));
    const mirror = result.file.configs[result.mirror.index];

    mirror.categories.forEach((category: HeroGridCategory, i: number) => {
      const origin = file.configs[0].categories[i];
      expect(category.hero_ids).toHaveLength(origin.hero_ids.length);
      expect(sortedIds(category.hero_ids)).toEqual(sortedIds(origin.hero_ids));
    });

    // A fixture tem 128 entradas com 127 ids unicos — o espelho tem de manter as 128.
    const total = mirror.categories.reduce(
      (acc: number, category: HeroGridCategory) => acc + category.hero_ids.length,
      0,
    );
    expect(total).toBe(128);
  });

  it('ordena por nota decrescente e desempata pela ordem da origem (ordenacao estavel)', () => {
    const result = ok(build(realFile()));
    // `67` e `32` tem a mesma nota; na origem `67` vem antes, e é assim que tem de sair.
    expect(heroIdsOf(result.file, result.mirror.index, 0).slice(0, 5)).toEqual([12, 41, 20, 67, 32]);
  });

  it('manda heroi sem dado para o fim do grupo preservando a ordem relativa da origem (I-9)', () => {
    const file = realFile();
    const result = ok(build(file));
    const mirrorIndex = result.mirror.index;

    // `Grupo Um`: os cinco com nota vem na frente; o resto sai na ordem exata da origem.
    const semDadoNaOrigem = file.configs[0].categories[0].hero_ids.filter(
      (id: number) => ![12, 41, 20, 67, 32].includes(id),
    );
    expect(heroIdsOf(result.file, mirrorIndex, 0).slice(5)).toEqual(semDadoNaOrigem);

    // `Grupo dois`: NENHUM heroi tem nota — o grupo sai identico à origem, nao embaralhado.
    expect(heroIdsOf(result.file, mirrorIndex, 1)).toEqual(file.configs[0].categories[1].hero_ids);

    const grupoDois = result.perGroup[1];
    expect(grupoDois.ordered).toBe(0);
    expect(grupoDois.withoutData).toBe(file.configs[0].categories[1].hero_ids.length);
  });

  it('mantem o heroi repetido nos dois grupos e com a mesma nota nos dois (I-8)', () => {
    // `20` esta em `Grupo Um` (indice 0) e em `Grupo Três` (indice 2) no arquivo real.
    // Em cada grupo ele disputa com um heroi de nota maior (0.60) e um de nota menor (0.40):
    // se a nota de `20` fosse recortada por grupo, a posicao relativa divergiria.
    const scores = makeScores([
      [20, 0.5],
      [41, 0.6],
      [12, 0.4],
      [128, 0.6],
      [102, 0.4],
    ]);
    const result = ok(
      buildMirror({ file: realFile(), source: SOURCE_REAL, mirror: null, scores }),
    );
    const mirrorIndex = result.mirror.index;

    expect(heroIdsOf(result.file, mirrorIndex, 0).slice(0, 3)).toEqual([41, 20, 12]);
    expect(heroIdsOf(result.file, mirrorIndex, 2).slice(0, 3)).toEqual([128, 20, 102]);
  });

  it('produz o mesmo file em duas chamadas com a mesma entrada (I-10)', () => {
    const primeira = ok(build(realFile()));
    const segunda = ok(build(realFile()));
    expect(segunda.file).toEqual(primeira.file);
    expect(segunda.perGroup).toEqual(primeira.perGroup);
    expect(segunda.mirror).toEqual(primeira.mirror);
  });

  it('mantem no maximo um espelho por origem, substituindo o existente em vez de acrescentar (I-4)', () => {
    const primeira = ok(build(realFile()));
    expect(primeira.file.configs).toHaveLength(2);
    expect(primeira.mirror.index).toBe(1);

    const segunda = ok(
      buildMirror({
        file: primeira.file,
        source: SOURCE_REAL,
        mirror: primeira.mirror,
        scores: SCORES,
      }),
    );
    expect(segunda.file.configs).toHaveLength(2);
    expect(segunda.mirror.index).toBe(1);

    const terceira = ok(
      buildMirror({
        file: segunda.file,
        source: SOURCE_REAL,
        mirror: segunda.mirror,
        scores: SCORES,
      }),
    );
    expect(terceira.file.configs).toHaveLength(2);
    expect(terceira.file).toEqual(segunda.file);
  });

  it('devolve a origem igual em profundidade e nao muta o arquivo de entrada (I-1)', () => {
    const file = realFile();
    const antes = structuredClone(file);

    const result = ok(build(file));

    // O objeto de entrada sai como entrou — nenhuma mutacao em lugar nenhum.
    expect(file).toEqual(antes);
    // E o config na posicao de origem do arquivo DEVOLVIDO é igual em profundidade ao lido.
    expect(result.file.configs[0]).toEqual(antes.configs[0]);
  });

  it('nomeia o espelho como "<origem> — GlimpseGG" por padrao (N-5)', () => {
    const result = ok(build(realFile()));
    expect(defaultMirrorName('Layout1')).toBe('Layout1 — GlimpseGG');
    expect(result.mirror.name).toBe('Layout1 — GlimpseGG');
    expect(result.file.configs[1].config_name).toBe('Layout1 — GlimpseGG');
  });

  it('preserva o version lido do arquivo (I-3)', () => {
    const result = ok(build(realFile()));
    expect(result.file.version).toBe(3);
  });

  it('deixa outsideSource vazio quando todo o ranking esta na origem (FR-035a)', () => {
    const result = ok(build(realFile()));
    expect(result.outsideSource).toEqual([]);
  });

  it('sinaliza quando a posicao registrada da origem nao existe mais, sem adivinhar por nome (N-4)', () => {
    const result = buildMirror({
      file: realFile(),
      source: { index: 5, name: 'Layout1' },
      mirror: null,
      scores: SCORES,
    });
    expect(failure(result).code).toBe('SOURCE_INDEX_GONE');
  });
});

/* ------------------------------------------------------------------ *
 * T018 — guarda de nome (FR-008e, N-7)
 * ------------------------------------------------------------------ */

describe('guarda de nome do espelho (FR-008e, N-7)', () => {
  const SCORES = makeScores([[20, 0.6]]);

  it('recusa espelho cujo nome colide com config que nao é o espelho registrado, sem sobrescrever', () => {
    const file = realFile();
    const antes = structuredClone(file);

    const result = buildMirror({
      file,
      source: SOURCE_REAL,
      mirror: null,
      scores: SCORES,
      // `Layout1` é o layout do jogador, nao um espelho criado pelo app.
      mirrorName: 'Layout1',
    });

    const failed = failure(result);
    expect(failed.code).toBe('NAME_COLLISION');
    expect(failed.error).toContain('Layout1');
    // Nada foi sobrescrito: o arquivo de entrada continua com um unico layout, intacto.
    expect(file).toEqual(antes);
    expect(file.configs).toHaveLength(1);
  });

  it('recusa nome colidindo com layout que o app nao criou mesmo havendo espelho registrado', () => {
    const primeira = ok(
      buildMirror({ file: realFile(), source: SOURCE_REAL, mirror: null, scores: SCORES }),
    );

    const result = buildMirror({
      file: primeira.file,
      source: SOURCE_REAL,
      mirror: primeira.mirror,
      scores: SCORES,
      mirrorName: 'Layout1',
    });

    expect(failure(result).code).toBe('NAME_COLLISION');
    expect(primeira.file.configs[0].config_name).toBe('Layout1');
  });

  it('aceita atualizar o espelho registrado mantendo o nome que ele ja tem, mesmo com homonimo na colecao', () => {
    // Cenario da anti-fixture: `configs[0]` e `configs[1]` se chamam "Meta Espelho". Se o
    // espelho registrado for `configs[1]`, atualizar ele NAO reivindica nome nenhum — a
    // identidade é a posicao (N-1), e recusar aqui travaria a sincronizacao por um rotulo.
    const file = adverseFile();
    const result = buildMirror({
      file,
      source: { index: 2, name: 'Outro layout' },
      mirror: { index: 1, name: 'Meta Espelho' },
      scores: makeScores([[12, 0.7]]),
    });

    expect(result.success).toBe(true);
    const data = ok(result);
    expect(data.mirror).toEqual({ index: 1, name: 'Meta Espelho' });
    expect(data.file.configs).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------ *
 * T020 — re-espelhamento (FR-008d)
 * ------------------------------------------------------------------ */

describe('re-espelhamento quando a origem muda (FR-008d)', () => {
  const SCORES = makeScores([
    [12, 0.6],
    [41, 0.55],
    [20, 0.52],
  ]);

  /** Estado "no disco" depois da primeira sincronizacao: origem + espelho. */
  function afterFirstSync() {
    const primeira = ok(
      buildMirror({ file: realFile(), source: SOURCE_REAL, mirror: null, scores: SCORES }),
    );
    // Espelho recem-criado: nao ha estrutura anterior, entao nada "mudou desde" (FR-008d).
    expect(primeira.structureChanged).toBe(false);
    return primeira;
  }

  /** Aplica uma edicao do jogador na ORIGEM e re-espelha. */
  function resync(edit: (file: HeroGridFile) => void): MirrorResult {
    const primeira = afterFirstSync();
    const noDisco = structuredClone(primeira.file);
    edit(noDisco);
    return ok(
      buildMirror({
        file: noDisco,
        source: SOURCE_REAL,
        mirror: primeira.mirror,
        scores: SCORES,
      }),
    );
  }

  it('origem inalterada entre duas chamadas nao marca structureChanged (caso negativo)', () => {
    const segunda = resync(() => {
      /* nenhuma edicao */
    });
    expect(segunda.structureChanged).toBe(false);
  });

  it('grupo renomeado na origem marca structureChanged e o espelho adota o nome novo', () => {
    const segunda = resync((file) => {
      file.configs[0].categories[0].category_name = 'Grupo Renomeado';
    });
    expect(segunda.structureChanged).toBe(true);
    expect(segunda.file.configs[1].categories[0].category_name).toBe('Grupo Renomeado');
  });

  it('heroi movido de grupo na origem marca structureChanged e o espelho segue a alocacao nova', () => {
    const segunda = resync((file) => {
      const [de, para] = [file.configs[0].categories[0], file.configs[0].categories[1]];
      de.hero_ids = de.hero_ids.filter((id: number) => id !== 12);
      para.hero_ids = [...para.hero_ids, 12];
    });

    expect(segunda.structureChanged).toBe(true);
    expect(heroIdsOf(segunda.file, 1, 0)).not.toContain(12);
    // Com nota 0.60 e sendo o unico com dado no grupo novo, `12` vai para a frente dele.
    expect(heroIdsOf(segunda.file, 1, 1)[0]).toBe(12);
  });

  it('grupo criado na origem marca structureChanged e aparece no espelho', () => {
    const segunda = resync((file) => {
      file.configs[0].categories.push({
        category_name: 'Grupo Novo',
        x_position: 10.5,
        y_position: 20.25,
        width: 100,
        height: 50,
        hero_ids: [41, 20],
      });
    });

    expect(segunda.structureChanged).toBe(true);
    expect(segunda.file.configs[1].categories).toHaveLength(9);
    const novo = segunda.file.configs[1].categories[8];
    expect(novo.category_name).toBe('Grupo Novo');
    expect(novo.x_position).toBe(10.5);
    expect(novo.hero_ids).toEqual([41, 20]);
    expect(segunda.perGroup).toHaveLength(9);
  });

  it('grupo removido da origem marca structureChanged e desaparece do espelho', () => {
    const segunda = resync((file) => {
      file.configs[0].categories.splice(7, 1);
    });

    expect(segunda.structureChanged).toBe(true);
    expect(segunda.file.configs[1].categories).toHaveLength(7);
    expect(
      segunda.file.configs[1].categories.map((c: HeroGridCategory) => c.category_name),
    ).not.toContain('grupo oito');
  });
});

/* ------------------------------------------------------------------ *
 * T021 — os casos que so a anti-fixture exercita
 * ------------------------------------------------------------------ */

describe('mirrorBuilder contra a anti-fixture (I-2, I-3, I-4a, I-4b, L-4, L-5)', () => {
  /**
   * `12`, `67` e `5` NAO estao em `configs[0]` — sao a maioria do ranking e tem de cair em
   * `outsideSource` sem entrar no espelho (FR-035a / FR-008a).
   */
  const SCORES = makeScores([
    [1, 0.3],
    [8, 0.7],
    [20, 0.5],
    [41, 0.9],
    [12, 0.65],
    [67, null],
    [5, 0.8],
  ]);

  const SOURCE_ADVERSE = { index: 0, name: 'Meta Espelho' };

  const build = (file: HeroGridFile) =>
    buildMirror({ file, source: SOURCE_ADVERSE, mirror: null, scores: SCORES });

  it('nao altera nenhum outro config da colecao, em nenhuma posicao (I-2)', () => {
    const file = adverseFile();
    const antes = structuredClone(file);
    const result = ok(build(file));

    // Igualdade profunda config por config — com 1 layout esta invariante passaria vazia.
    expect(result.file.configs[0]).toEqual(antes.configs[0]);
    expect(result.file.configs[1]).toEqual(antes.configs[1]);
    expect(result.file.configs[2]).toEqual(antes.configs[2]);
    expect(file).toEqual(antes);
  });

  it('acrescenta o espelho no fim de configs sem mover os layouts do jogador (I-4b, N-6)', () => {
    const result = ok(build(adverseFile()));

    expect(result.file.configs).toHaveLength(4);
    expect(result.mirror.index).toBe(3);
    expect(result.file.configs.map((c) => c.config_name)).toEqual([
      'Meta Espelho',
      'Meta Espelho',
      'Outro layout',
      'Meta Espelho — GlimpseGG',
    ]);
  });

  it('espelha e ordena categorias homonimas de forma independente (I-4a, N-2)', () => {
    const result = ok(build(adverseFile()));
    const mirrorIndex = result.mirror.index;

    // Os dois grupos se chamam "Best with" e tem conjuntos diferentes: `[1, 8, 20]` e
    // `[20, 41]`. Ordenados de forma independente, as ordens resultantes divergem.
    expect(heroIdsOf(result.file, mirrorIndex, 0)).toEqual([8, 20, 1]);
    expect(heroIdsOf(result.file, mirrorIndex, 1)).toEqual([41, 20]);
    expect(heroIdsOf(result.file, mirrorIndex, 0)).not.toEqual(
      heroIdsOf(result.file, mirrorIndex, 1),
    );

    // A identidade no relatorio é o INDICE; o nome repetido é so rotulo.
    expect(result.perGroup[0]).toEqual({
      categoryIndex: 0,
      categoryName: 'Best with',
      ordered: 3,
      withoutData: 0,
    });
    expect(result.perGroup[1]).toEqual({
      categoryIndex: 1,
      categoryName: 'Best with',
      ordered: 2,
      withoutData: 0,
    });
  });

  it('ordena categoria vazia sem quebrar, com ordered zero (I-9)', () => {
    const result = ok(build(adverseFile()));
    expect(heroIdsOf(result.file, result.mirror.index, 2)).toEqual([]);
    expect(result.perGroup[2]).toEqual({
      categoryIndex: 2,
      categoryName: 'grupo Vazio',
      ordered: 0,
      withoutData: 0,
    });
  });

  it('lista em outsideSource os herois do ranking que nao estao na origem, sem inseri-los (FR-035a)', () => {
    const result = ok(build(adverseFile()));

    expect(result.outsideSource).toEqual([12, 67, 5]);
    const idsDoEspelho = result.file.configs[result.mirror.index].categories.flatMap(
      (c: HeroGridCategory) => c.hero_ids,
    );
    expect(idsDoEspelho).not.toContain(12);
    expect(idsDoEspelho).not.toContain(67);
    expect(idsDoEspelho).not.toContain(5);
  });

  it('preserva o version lido tambem quando ele nao é 3 (I-3)', () => {
    const result = ok(build(adverseFile()));
    expect(result.file.version).toBe(4);
  });

  it('preserva campo desconhecido de categoria no espelho e de config na origem (L-4)', () => {
    const result = ok(build(adverseFile()));

    // Copia por spread: o campo que a Valve acrescentou na categoria vai para o espelho.
    expect(result.file.configs[result.mirror.index].categories[1]).toMatchObject({
      future_valve_field: 7,
    });
    // E o campo desconhecido de `configs[1]` continua onde estava — origem intocada.
    expect(result.file.configs[1]).toMatchObject({ future_valve_config_field: 'reservado' });
  });

  it('resolve layout de nome duplicado pela posicao e trata id fora do catalogo como sem dado (N-1, L-5)', () => {
    // `configs[1]` tem o MESMO `config_name` de `configs[0]`. A origem aqui é a posicao 1.
    const result = ok(
      buildMirror({
        file: adverseFile(),
        source: { index: 1, name: 'Meta Espelho' },
        mirror: null,
        scores: SCORES,
      }),
    );

    expect(result.mirror.index).toBe(3);
    expect(result.file.configs[1].config_name).toBe('Meta Espelho');
    // `9999` nao existe no catalogo: preservado no grupo, no fim, contado como sem dado.
    expect(heroIdsOf(result.file, 3, 0)).toEqual([20, 9999]);
    expect(result.perGroup[0]).toEqual({
      categoryIndex: 0,
      categoryName: 'Só um grupo',
      ordered: 1,
      withoutData: 1,
    });
  });
});

/* ------------------------------------------------------------------ *
 * T022 — rename (FR-008h, N-3)
 * ------------------------------------------------------------------ */

describe('rename de layout entre duas sincronizacoes (FR-008h, N-3)', () => {
  const SCORES = makeScores([
    [12, 0.6],
    [20, 0.4],
  ]);

  function afterFirstSync() {
    return ok(
      buildMirror({ file: realFile(), source: SOURCE_REAL, mirror: null, scores: SCORES }),
    );
  }

  it('espelho renomeado no jogo é reconhecido pela posicao, tem o name atualizado e nao gera um segundo', () => {
    const primeira = afterFirstSync();
    const noDisco = structuredClone(primeira.file);
    noDisco.configs[1].config_name = 'Meu grid de ranked';

    const segunda = ok(
      buildMirror({
        file: noDisco,
        source: SOURCE_REAL,
        // O `name` guardado esta velho de proposito: a identidade é o `index`.
        mirror: { index: 1, name: 'Layout1 — GlimpseGG' },
        scores: SCORES,
      }),
    );

    expect(segunda.file.configs).toHaveLength(2);
    expect(segunda.mirror).toEqual({ index: 1, name: 'Meu grid de ranked' });
    // Renomear é rotulo: nao volta a se chamar como o default nem nasce um terceiro config.
    expect(segunda.file.configs[1].config_name).toBe('Meu grid de ranked');
    expect(
      segunda.file.configs.filter((c) => c.config_name.includes('GlimpseGG')),
    ).toHaveLength(0);
  });

  it('origem renomeada no jogo atualiza o name guardado sem criar um segundo espelho', () => {
    const primeira = afterFirstSync();
    const noDisco = structuredClone(primeira.file);
    noDisco.configs[0].config_name = 'Ranked 2026';

    const segunda = ok(
      buildMirror({
        file: noDisco,
        source: { index: 0, name: 'Layout1' },
        mirror: primeira.mirror,
        scores: SCORES,
      }),
    );

    expect(segunda.source).toEqual({ index: 0, name: 'Ranked 2026' });
    expect(segunda.file.configs).toHaveLength(2);
    expect(segunda.mirror.index).toBe(1);
    // Nao é layout novo: a estrutura nao mudou, so o rotulo da origem.
    expect(segunda.structureChanged).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * T037 — remocao do espelho (FR-008g)
 * ------------------------------------------------------------------ */

describe('remocao do espelho (FR-008g)', () => {
  const SCORES = makeScores([[20, 0.6]]);

  it('produz a colecao sem o config do espelho, deixando os demais intactos', () => {
    const primeira = ok(
      buildMirror({ file: realFile(), source: SOURCE_REAL, mirror: null, scores: SCORES }),
    );
    const antes = structuredClone(primeira.file);

    const result = removeMirror({
      file: primeira.file,
      mirror: primeira.mirror,
      source: primeira.source,
    });
    const data = ok(result);
    expect(data.file.configs).toHaveLength(1);
    expect(data.file.configs[0]).toEqual(antes.configs[0]);
    expect(data.file.version).toBe(3);
    expect(data.removedIndex).toBe(1);
    expect(data.source).toEqual({ index: 0, name: 'Layout1' });
    // Entrada nao mutada.
    expect(primeira.file).toEqual(antes);
  });

  it('corrige o indice da origem quando o espelho removido estava antes dela', () => {
    const file = adverseFile();
    const result = removeMirror({
      file,
      mirror: { index: 0, name: 'Meta Espelho' },
      source: { index: 2, name: 'Outro layout' },
    });

    const data = ok(result);
    expect(data.file.configs.map((c) => c.config_name)).toEqual(['Meta Espelho', 'Outro layout']);
    expect(data.source).toEqual({ index: 1, name: 'Outro layout' });
  });

  it('recusa remover quando a posicao registrada do espelho nao existe mais', () => {
    const result = removeMirror({
      file: realFile(),
      mirror: { index: 7, name: 'Layout1 — GlimpseGG' },
      source: SOURCE_REAL,
    });
    expect(failure(result).code).toBe('SOURCE_INDEX_GONE');
  });

  it('recusa remover config que nao é o espelho, mesmo com preferencia corrompida', () => {
    const file = realFile();
    const antes = structuredClone(file);

    const result = removeMirror({
      file,
      // Preferencia apontando o espelho para a propria origem: remover seria apagar o
      // layout do jogador, e o contrato proibe remover config que o app nao criou.
      mirror: { index: 0, name: 'Layout1' },
      source: SOURCE_REAL,
    });

    expect(failure(result).code).toBe('SOURCE_MUTATED');
    expect(file).toEqual(antes);
  });
});
