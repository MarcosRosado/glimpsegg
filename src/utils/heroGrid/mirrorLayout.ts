import type {
  HeroGridFile,
  HeroGridGroupView,
  HeroScore,
  MetaSource,
  MirrorGroupReport,
  NoDataReason,
  RankingCriterion,
} from '../../types/heroGrid';

/**
 * Geometria e leitura da REPLICA visual do layout espelho (specs/001-meta-hero-grid).
 *
 * Existe separado do componente pelo mesmo motivo de `tabFormat.ts`: o vitest deste projeto
 * roda em `environment: 'node'` e nao tem DOM, entao nenhum `.tsx` é testavel. Onde cada
 * grupo fica, se a geometria do arquivo serve para desenhar e qual numero cada heroi exibe
 * sao decisoes que um teste precisa exercitar — elas moram aqui, e o componente fica so com
 * o JSX e com a escolha da chave i18n.
 *
 * Nenhuma funcao daqui produz TEXTO traduzido: elas devolvem numero e discriminante. É a
 * mesma divisao do motor de coaching (`insights/` emite valor cru, `ruleText.ts` mapeia para
 * chave), e é o que permite testar sem locale.
 *
 * As duas regras que sustentam o resto:
 *
 * 1. **A geometria é tudo-ou-nada.** Grupo com coordenada quebrada nao é "chutado" numa
 *    posicao qualquer enquanto os outros seguem a do arquivo: plotar metade pela geometria e
 *    metade em posicao arbitraria mostraria ao jogador um layout que NAO é o dele. É a mesma
 *    doutrina de `minimapCoords.ts`, onde a funcao nunca infere — ou se sabe onde a caixa
 *    fica, ou a tela empilha em fluxo e DIZ que empilhou.
 * 2. **A fonte pedida nunca é substituida por outra.** `PERSONAL_ONLY` sem historico devolve
 *    "sem dado", nao o winrate do meta disfarcado de pessoal (e vice-versa). Preencher a
 *    lacuna com o numero que estiver a mao é exatamente o que a doutrina "nunca inventar
 *    dado" proibe; `NONE` é resultado legitimo.
 */

/* ------------------------------------------------------------------ *
 * 1. Os grupos do espelho, com geometria
 * ------------------------------------------------------------------ */

/**
 * Substitui o `groupViewsOf` que morava no `useHeroGridSync` (removido no mesmo passo),
 * agora carregando a geometria.
 *
 * Le as categorias do ESPELHO (indice `mirrorIndex`, nao o da origem) porque é lá que os
 * `hero_ids` ja estao na ordem final — é literalmente o que o jogador vera no jogo.
 *
 * `ordered`/`withoutData` vem de `perGroup[i]` quando existir. `perGroup` mais curto que as
 * categorias nao é erro: cai em 0, que significa "nada foi ordenado neste grupo" e nao
 * inventa contagem. A identidade continua sendo a POSICAO (I-4a) — parear por
 * `category_name` perderia o rastro assim que dois grupos tivessem o mesmo nome, o que o
 * grid publicado pelo D2PT faz sete vezes num layout so.
 *
 * Nao muta a entrada: `heroIds` sai como copia, para a tela nao conseguir reordenar por
 * acidente o array que veio do arquivo lido.
 */
export function buildGroupViews(
  mirrorFile: HeroGridFile,
  mirrorIndex: number,
  perGroup: MirrorGroupReport[],
): HeroGridGroupView[] {
  const config = mirrorFile?.configs?.[mirrorIndex];
  if (!config) return [];
  return (config.categories || []).map((category, i) => {
    const report = perGroup?.[i];
    return {
      categoryIndex: i,
      categoryName: category.category_name,
      heroIds: [...(category.hero_ids || [])],
      ordered: report ? report.ordered : 0,
      withoutData: report ? report.withoutData : 0,
      // I-6: as quatro coordenadas vem da origem sem tocar. A replica so as translada para o
      // canto superior esquerdo em `buildMirrorCanvas`; aqui elas sao copia fiel.
      xPosition: category.x_position,
      yPosition: category.y_position,
      width: category.width,
      height: category.height,
    };
  });
}

/* ------------------------------------------------------------------ *
 * 2. O canvas: as caixas ja normalizadas
 * ------------------------------------------------------------------ */

export interface MirrorCanvasBox {
  /** I-4a: a identidade é a POSICAO, e é por ela que a caixa casa com o grupo. */
  categoryIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MirrorCanvas {
  width: number;
  height: number;
  boxes: MirrorCanvasBox[];
  /** `false` => a geometria do arquivo nao é utilizavel; a tela empilha em fluxo e DIZ isso. */
  usesGeometry: boolean;
}

const EMPTY_CANVAS: MirrorCanvas = { width: 0, height: 0, boxes: [], usesGeometry: false };

/** Uma caixa so serve se as quatro medidas sao finitas e se ela tem area para desenhar. */
function isUsableBox(group: HeroGridGroupView): boolean {
  if (!group) return false;
  const { xPosition, yPosition, width, height } = group;
  if (!Number.isFinite(xPosition) || !Number.isFinite(yPosition)) return false;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  // Coordenada negativa é aceitavel — a normalizacao resolve. Dimensao nao positiva nao é:
  // caixa de area zero nao desenha nada, e uma caixa invisivel no meio da replica seria lida
  // como "esse grupo nao existe".
  return width > 0 && height > 0;
}

/**
 * Traduz a geometria da Valve para caixas de tela, normalizadas contra o canto superior
 * esquerdo (o menor x e o menor y viram 0).
 *
 * A normalizacao existe porque o arquivo do jogador nao promete comecar em zero: o layout
 * real que temos de fixture comeca em x=41,7, e um grid montado com scroll para a esquerda
 * pode ter coordenada negativa. Traduzir mantem as posicoes RELATIVAS, que é o que faz a
 * replica ser o layout dele.
 *
 * Tudo-ou-nada de proposito: um unico grupo com medida quebrada derruba `usesGeometry` e
 * devolve `boxes: []`. Devolver as caixas boas e deixar a tela improvisar as ruins produziria
 * um layout parecido com o do jogador, mas errado — pior que assumir que nao dá para desenhar.
 */
export function buildMirrorCanvas(groups: readonly HeroGridGroupView[]): MirrorCanvas {
  if (!Array.isArray(groups) || groups.length === 0) return { ...EMPTY_CANVAS, boxes: [] };
  if (!groups.every(isUsableBox)) return { ...EMPTY_CANVAS, boxes: [] };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const group of groups) {
    if (group.xPosition < minX) minX = group.xPosition;
    if (group.yPosition < minY) minY = group.yPosition;
  }

  let width = 0;
  let height = 0;
  const boxes: MirrorCanvasBox[] = groups.map((group) => {
    const left = group.xPosition - minX;
    const top = group.yPosition - minY;
    if (left + group.width > width) width = left + group.width;
    if (top + group.height > height) height = top + group.height;
    return {
      categoryIndex: group.categoryIndex,
      left,
      top,
      width: group.width,
      height: group.height,
    };
  });

  return { width, height, boxes, usesGeometry: true };
}

/**
 * Unidades da Valve -> pixels.
 *
 * A geometria do arquivo é calibrada para o ICONE que o Dota desenha (~26x18 unidades por
 * heroi). O tile desta tela carrega icone + nome + porcentagem, e ocupa varias vezes essa
 * area — reproduzir a geometria 1:1 fazia TODO grupo transbordar. Medido na
 * `hero-grid-real.json`: 8 de 8 grupos, com 35% a 60% dos herois nascendo fora da viewport e
 * 4 grupos colapsando para uma coluna so, o que deixa de ser replica e vira lista (que o
 * painel ja é).
 *
 * 1.75 é o multiplicador que faz os 8 grupos daquele grid caberem inteiros com o tile
 * de `HERO_TILE_MIN_WIDTH`. A folga mais apertada é o grupo mais baixo e estreito do grid de
 * referencia, que fica com sobra ZERO de linhas: um heroi a mais nele e ele passa a rolar —
 * degradacao prevista (`overflow-y-auto`), nao quebra. Ele NAO distorce a replica: multiplica x, y, largura e altura
 * pelo MESMO fator, entao posicoes relativas, proporcoes e vizinhanca ficam identicas — é
 * zoom, nao rearranjo. Mexer neste numero exige refazer a conta contra a fixture, do mesmo
 * jeito que as constantes de `mapGeometry.ts` exigem refazer a calibracao.
 *
 * Subiu de 1.15 para 1.6 quando o tile passou a carregar duas linhas — nome em cima, winrate
 * e NOTA embaixo — e a tipografia foi para a escala em `rem` do resto do app; e de 1.6 para
 * 1.75 quando a NOTA virou o numero principal, em `text-sm`, e a linha de baixo ficou 3px
 * mais alta. Tile maior exige caixa maior; é a mesma conta, com outro tile.
 *
 * Ha um teto util, e ele nao é a geometria: crescer a escala aumenta o canvas, e canvas maior
 * encolhe mais na janela, entao o tamanho EFETIVO da fonte cai. Medido com o tile atual, a
 * nota renderiza a 13,8px em escala 1.70 e a 10,2px em 2.30. 1.75 fica no joelho da curva —
 * folga de 46px no grupo mais apertado e nota a 13,5px numa janela de 1750px uteis.
 */
export const MIRROR_UNIT_SCALE = 1.75;

/**
 * Multiplica um canvas por um fator de unidade.
 *
 * Separado de `buildMirrorCanvas` de proposito: aquela funcao responde "o que o ARQUIVO
 * diz", e é assim que ela é testada contra as fixtures. Esta responde "quanto disso vira
 * pixel", que é decisao de apresentacao e muda quando o tile muda. Juntar as duas faria o
 * teste da geometria do arquivo passar a depender do tamanho de uma fonte.
 *
 * Canvas sem geometria sai intacto: nao ha o que escalar, e `usesGeometry: false` continua
 * sendo a resposta.
 */
export function scaleCanvas(
  canvas: MirrorCanvas,
  unitScale: number = MIRROR_UNIT_SCALE,
): MirrorCanvas {
  if (!canvas || !canvas.usesGeometry) return canvas;
  if (!Number.isFinite(unitScale) || unitScale <= 0) return canvas;
  return {
    width: canvas.width * unitScale,
    height: canvas.height * unitScale,
    usesGeometry: true,
    boxes: canvas.boxes.map((box) => ({
      categoryIndex: box.categoryIndex,
      left: box.left * unitScale,
      top: box.top * unitScale,
      width: box.width * unitScale,
      height: box.height * unitScale,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * 3. Caber na largura disponivel
 * ------------------------------------------------------------------ */

/**
 * Piso do zoom: abaixo disso o container rola em vez de encolher mais.
 *
 * NAO é o piso de legibilidade — esse é `MIRROR_LEGIBLE_SCALE`, e `resolveMirrorLayout`
 * troca a geometria pelo fluxo empilhado antes de chegar aqui. Este piso continua existindo
 * para o caso em que a geometria é desenhada mesmo assim (chamador que use `fitScale`
 * direto), para a escala nunca colapsar em zero.
 */
export const MIRROR_MIN_SCALE = 0.55;
/** Nunca AMPLIAR: o layout da Valve tem tamanho proprio, e esticar so borra o desenho. */
export const MIRROR_MAX_SCALE = 1;

/**
 * Fator de escala para o canvas caber na largura disponivel.
 *
 * Entrada degenerada (largura zero, negativa, `NaN` — o que `clientWidth` devolve antes do
 * primeiro layout do React) devolve `max`, isto é, tamanho natural: melhor a replica nascer
 * grande e o container rolar do que ela nascer colapsada em escala zero.
 */
export function fitScale(
  canvasWidth: number,
  availableWidth: number,
  min: number = MIRROR_MIN_SCALE,
  max: number = MIRROR_MAX_SCALE,
): number {
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return max;
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return max;
  // Faixa invertida por chamador confuso: `max` manda, em vez de devolver um `min` que é
  // maior que o teto que a propria chamada pediu.
  if (min > max) return max;
  const raw = availableWidth / canvasWidth;
  if (raw < min) return min;
  if (raw > max) return max;
  return raw;
}

/**
 * Abaixo desta escala o nome do heroi deixa de ser legivel.
 *
 * O nome sai em `text-xs` (~13px com o `font-size` de 17.5px do `html`), entao 0.7 é ~9,2px
 * efetivos — o piso pratico para texto truncado. Nao
 * confundir com `MIRROR_MIN_SCALE`, que é o piso do ZOOM: aquele decide "quanto encolher
 * antes de deixar o container rolar", este decide "a partir de quando encolher deixa de ser
 * uma opcao".
 *
 * A distincao importa porque a saida certa em janela estreita nao é uma replica em 5px, que
 * nao se lê: é abrir mao da geometria e empilhar os grupos, que é a mesma degradacao que a
 * tela ja faz quando o arquivo nao tem geometria utilizavel — com aviso, nunca em silencio.
 */
export const MIRROR_LEGIBLE_SCALE = 0.7;

/**
 * Como a replica deve ser desenhada.
 *
 * - `GEOMETRY` — grupos nas posicoes do arquivo, no `scale` devolvido;
 * - `FLOW_NO_GEOMETRY` — o arquivo nao traz geometria utilizavel;
 * - `FLOW_TOO_NARROW` — ha geometria, mas respeita-la nesta janela produziria texto que nao
 *   se lê. Os dois motivos de empilhar sao distintos de proposito: a tela diz qual foi, e
 *   dizer "a geometria do seu arquivo nao serve" quando o problema é a largura da janela
 *   seria uma afirmacao falsa sobre o arquivo do jogador.
 */
export type MirrorLayoutMode = 'GEOMETRY' | 'FLOW_NO_GEOMETRY' | 'FLOW_TOO_NARROW';

export interface MirrorLayoutDecision {
  mode: MirrorLayoutMode;
  /** Só significativo em `GEOMETRY`; `1` nos modos de fluxo. */
  scale: number;
}

/**
 * Decide entre reproduzir a geometria e empilhar, e com que zoom.
 *
 * Largura ainda nao medida (`0`, o que `contentRect` devolve antes do primeiro layout)
 * conta como CABE: a replica nasce em tamanho natural e o `ResizeObserver` corrige no tique
 * seguinte. O contrario — nascer empilhada e saltar para a geometria — pisca a tela inteira
 * em toda montagem.
 */
export function resolveMirrorLayout(
  canvas: MirrorCanvas,
  availableWidth: number,
): MirrorLayoutDecision {
  if (!canvas || !canvas.usesGeometry || canvas.width <= 0) {
    return { mode: 'FLOW_NO_GEOMETRY', scale: 1 };
  }
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return { mode: 'GEOMETRY', scale: MIRROR_MAX_SCALE };
  }
  if (availableWidth / canvas.width < MIRROR_LEGIBLE_SCALE) {
    return { mode: 'FLOW_TOO_NARROW', scale: 1 };
  }
  return { mode: 'GEOMETRY', scale: fitScale(canvas.width, availableWidth) };
}

/* ------------------------------------------------------------------ *
 * 4. Qualidade da nota: o que é nota boa
 * ------------------------------------------------------------------ */

/**
 * O nome e a escala da nota: **GlimpseScore**, de 0 a 100.
 *
 * O motor guarda a nota como razao 0..1, porque é o que sai do `wilsonLowerBound` e é assim
 * que ela é combinada e comparada. Exibir esse numero cru (`0.426`) nao diz nada a ninguem —
 * ele nao tem unidade, nao tem teto visivel e nao se parece com nada que o jogador ja conheca.
 *
 * Multiplicar por 100 nao é maquiagem: a nota É um winrate, so que o limite INFERIOR do
 * intervalo de confianca em vez do valor observado. Entao "GlimpseScore 42.6" tem uma leitura
 * literal e honesta — "com a amostra que existe, dá para sustentar cerca de 42,6% de vitoria".
 * A distancia entre ela e o winrate exibido é exatamente o quanto a amostra ainda nao provou.
 *
 * Uma casa decimal, e nao inteiro: com 127 herois num layout e ~30 pontos de faixa util, o
 * inteiro empataria uns quatro herois por ponto, e empate visivel numa coluna que o jogador
 * lê como ranking parece erro de ordenacao. A ordem em si usa a precisao cheia.
 */
export const GLIMPSE_SCORE_MAX = 100;

export function formatGlimpseScore(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return (value * GLIMPSE_SCORE_MAX).toFixed(1);
}

export type ScoreQuality = 'GOOD' | 'FAIR' | 'POOR';

export interface ScoreQualityScale {
  /** Piso de `GOOD`: percentil 67 das notas deste espelho. */
  good: number;
  /** Piso de `FAIR`: percentil 33. Abaixo disso é `POOR`. */
  fair: number;
  /** Quantas notas entraram na calibracao. Vai para a tela junto dos limiares. */
  sampleSize: number;
}

/**
 * Abaixo disso os tercis sao ruido, e cor de ruido é pior que cor nenhuma.
 *
 * Com 6 herois, um tercil tem 2 — mover um heroi de posicao repinta um terco do grupo. O
 * numero continua visivel sem cor; é a degradacao honesta, e a mesma escolha de
 * `isScoreDisplayable`: sem base para afirmar, nao afirma.
 */
export const SCORE_QUALITY_MIN_SAMPLE = 9;

/**
 * Calibra a escala de cor da nota nas notas DESTE espelho.
 *
 * ## Por que relativa, e nao um corte fixo em 0,500
 *
 * A nota é o limite inferior de Wilson, entao ela é conservadora POR CONSTRUCAO: ela responde
 * "qual winrate eu consigo sustentar com a amostra que tenho", nao "qual winrate foi
 * observado". Um heroi com 55% em 40 partidas aterrissa perto de 0,42, e nao perto de 0,55.
 *
 * O efeito medido num grid real de 127 herois: mediana 0,406, e apenas 5 herois (3,9%) acima
 * de 0,500. Um corte absoluto ancorado em "50% é o equilibrio" pintaria 96% do layout de
 * vermelho — estatisticamente correto e praticamente inutil, e pior, LIDO como "quase todos
 * os seus herois sao ruins", que é uma afirmacao que o dado nao sustenta.
 *
 * Entao a escala responde outra pergunta, mais modesta e verdadeira: onde este heroi esta em
 * relacao aos outros DESTE layout. Verde é o terco de cima, amarelo o do meio, vermelho o de
 * baixo. A tela é obrigada a dizer isso e a mostrar os limiares — cor relativa apresentada
 * como se fosse absoluta seria exatamente o tipo de numero sem procedencia que a doutrina do
 * projeto proibe.
 *
 * Nota nao exibivel (FR-030b) e nota nula ficam FORA da calibracao: elas nao tem valor para
 * posicionar, e inclui-las deslocaria os limiares dos herois que tem.
 */
export function buildScoreQualityScale(
  scores: readonly HeroScore[] | null | undefined,
): ScoreQualityScale | null {
  if (!Array.isArray(scores)) return null;

  const values: number[] = [];
  for (const entry of scores) {
    const value = entry?.score;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    // Mesma regra de `isScoreDisplayable`: sem `personalWeight` a nota nao é exibivel, e o
    // que nao se exibe nao calibra cor.
    if (!entry.breakdown || !Number.isFinite(entry.breakdown.personalWeight)) continue;
    values.push(value);
  }
  if (values.length < SCORE_QUALITY_MIN_SAMPLE) return null;

  values.sort((a, b) => a - b);
  // Rank mais proximo, e nao interpolacao: o limiar passa a ser uma nota que EXISTE na
  // lista, entao "verde a partir de 0,428" é verificavel olhando o proprio layout.
  const at = (fraction: number) =>
    values[Math.min(values.length - 1, Math.floor(values.length * fraction))];

  return { fair: at(1 / 3), good: at(2 / 3), sampleSize: values.length };
}

/**
 * Em que terco a nota cai. `null` quando nao ha escala ou nao ha nota — e ai a tela mostra o
 * numero sem cor, nunca uma cor neutra que se confunda com "intermediario".
 */
export function scoreQuality(
  score: number | null | undefined,
  scale: ScoreQualityScale | null | undefined,
): ScoreQuality | null {
  if (!scale) return null;
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= scale.good) return 'GOOD';
  if (score >= scale.fair) return 'FAIR';
  return 'POOR';
}

/* ------------------------------------------------------------------ *
 * 5. Que numero cada heroi exibe
 * ------------------------------------------------------------------ */

export type MirrorHeroDisplayKind = 'META' | 'PERSONAL' | 'NONE';

export interface MirrorHeroDisplay {
  kind: MirrorHeroDisplayKind;
  /** 0..1, o numero principal. `null` quando `kind === 'NONE'`. */
  ratio: number | null;
  /** `matchCount` (meta) ou `games` (pessoal). FR-014: amostra sempre acompanha o numero. */
  sampleSize: number | null;
  /** Procedencia, so quando `kind === 'META'`. */
  source: MetaSource | null;
  noDataReason?: NoDataReason;
}

/** Winrate fora de 0..1 nao é winrate — trata como ausente em vez de exibir 340%. */
function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** `NONE` carregando o motivo QUANDO ele existe; sem motivo, nao se inventa um. */
function noData(reason: NoDataReason | undefined): MirrorHeroDisplay {
  const out: MirrorHeroDisplay = { kind: 'NONE', ratio: null, sampleSize: null, source: null };
  if (reason) out.noDataReason = reason;
  return out;
}

/**
 * O que a celula do heroi exibe, dado o criterio que o JOGADOR escolheu.
 *
 * A regra vem da configuracao dele, e nao do que por acaso existe no `HeroScore`: em
 * `PERSONAL_ONLY` o numero é o historico pessoal, e sem historico a celula diz "sem dado" —
 * NUNCA cai para o meta. O contrario tambem vale. Trocar a fonte pedida por outra sem avisar
 * é o mesmo erro que `BenchmarkSource` existe para impedir do outro lado do app: o jogador
 * leria "meu winrate com esse heroi" olhando para a media de milhares de partidas alheias.
 *
 * `score` ausente devolve `NONE` sem `noDataReason`: nao se sabe o motivo, e escolher um
 * seria fabricar explicacao.
 */
export function mirrorHeroDisplay(
  score: HeroScore | null | undefined,
  criterion: RankingCriterion,
): MirrorHeroDisplay {
  if (!score) return noData(undefined);

  if (criterion === 'PERSONAL_ONLY') {
    const personal = score.personal;
    // `games > 0` porque zero jogo com winrate 0 é ausencia de historico, nao 0% de vitoria.
    if (personal && personal.games > 0 && isRatio(personal.winRate)) {
      return {
        kind: 'PERSONAL',
        ratio: personal.winRate,
        sampleSize: personal.games,
        source: null,
      };
    }
    return noData(score.noDataReason);
  }

  // `META_ONLY` e `COMBINED` exibem o mesmo numero: a nota combinada ordena o grupo, mas o
  // que a celula mostra continua sendo um winrate com procedencia e amostra (FR-014).
  const meta = score.meta;
  if (meta && isRatio(meta.winRate)) {
    return {
      kind: 'META',
      ratio: meta.winRate,
      sampleSize: meta.matchCount,
      source: meta.source,
    };
  }
  return noData(score.noDataReason);
}
