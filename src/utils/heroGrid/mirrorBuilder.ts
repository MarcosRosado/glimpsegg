import type {
  ConfigRef,
  HeroGridCategory,
  HeroGridConfig,
  HeroGridErrorCode,
  HeroGridFile,
  HeroGridResult,
  HeroScore,
  MirrorGroupReport,
  MirrorResult,
} from '../../types/heroGrid';

/**
 * Construtor do layout espelho (specs/001-meta-hero-grid, T026/T027/T037).
 *
 * Modulo PURO: nenhum I/O, nenhuma rede, nenhum `Date.now()`, nenhuma mutacao do que
 * recebe. Ele decide o que vai para o arquivo do jogador, e é o unico lugar onde as
 * invariantes I-1 a I-10 de `data-model.md` podem ser garantidas antes de os bytes saírem.
 *
 * ## As tres decisoes de desenho, e o bug que cada uma evita
 *
 * 1. **Identidade é POSICAO, nunca nome (N-1 a N-7).** Layout e categoria sao referenciados
 *    por indice; `config_name` e `category_name` sao rotulos. O Dota 2 permite dois layouts
 *    com o mesmo nome, permite duas CATEGORIAS com o mesmo nome (caso real: o grid do Dota 2
 *    Pro Tracker repete `Best with` sete vezes num unico layout) e permite renomear a
 *    qualquer momento. Identidade por nome perderia o rastro do espelho num rename e criaria
 *    um segundo na sincronizacao seguinte, violando FR-008c.
 *
 * 2. **Nada é mutado; os configs alheios saem pela MESMA referencia.** `nextConfigs` é uma
 *    copia rasa do array, e as posicoes que nao sao o espelho continuam apontando para os
 *    objetos lidos. Isso torna I-1 e I-2 verdadeiras por construcao — nao por cuidado de
 *    quem edita o codigo depois — e é o que a guarda de igualdade profunda do main (E-3/E-4)
 *    vai reconferir antes do `rename`.
 *
 * 3. **Copia por spread (`{ ...category, hero_ids: ordered }`).** É o mecanismo de L-4:
 *    campo que a Valve acrescente num patch novo sobrevive, na posicao original, porque
 *    escrevemos as chaves que o objeto TEM em vez das chaves que conhecemos. As interfaces
 *    de `types/heroGrid.ts` nao tem index signature de proposito, entao nao existe tipo
 *    garantindo isso — quem garante é este spread mais `mirrorBuilder.test.ts`.
 *
 * ## A UNICA coisa que o espelho muda é a ordem dentro de cada grupo
 *
 * Numero de categorias, `category_name`, as quatro coordenadas e o CONJUNTO de `hero_ids`
 * vem da origem sem alteracao (I-5, I-6, I-7). Heroi sem dado nao é descartado nem ganha
 * nota estimada: vai para o fim do proprio grupo preservando a ordem relativa que tinha na
 * origem (I-9). É a doutrina do projeto — quando falta dado, a saida legitima é rotular ou
 * omitir a secao, nunca preencher com estimativa.
 *
 * ## Como a recusa é modelada
 *
 * `HeroGridResult<T>` (o mesmo `{ success, data } | { success, error, code }` da ponte IPC),
 * com `code` de `HeroGridErrorCode`. Nao é excecao: a recusa por nome (FR-008e) e a origem
 * apagada (N-4) sao estados PREVISTOS do arquivo do jogador, e quem chama tem de decidir o
 * que fazer com cada um — pedir outro nome, pedir nova origem — em vez de tratar tudo como
 * "falhou". Reusar o tipo da ponte tambem evita traduzir codigo de erro no meio do caminho:
 * `NAME_COLLISION` e `SOURCE_INDEX_GONE` ja existem lá.
 */

/** N-5: sufixo do nome padrao. Rotulo — renomear no jogo nao muda comportamento nenhum. */
export const MIRROR_NAME_SUFFIX = ' — GlimpseGG';

/** N-5: `"<origem> — GlimpseGG"`. Identifica à primeira vista que foi gerado (FR-008b). */
export function defaultMirrorName(sourceName: string): string {
  return `${sourceName}${MIRROR_NAME_SUFFIX}`;
}

export interface MirrorBuildInput {
  /** O arquivo LIDO. Sai daqui intocado — nem ele nem nada dentro dele é mutado (I-1). */
  file: HeroGridFile;
  /** Origem: `index` é a identidade, `name` é o ultimo nome visto (N-1). */
  source: ConfigRef;
  /** Espelho registrado, ou `null` na primeira sincronizacao. */
  mirror: ConfigRef | null;
  /** Ranking pronto (`ranking.ts`). Entra por parametro para este modulo seguir puro. */
  scores: HeroScore[];
  /**
   * Nome desejado. Ausente => mantem o nome que o espelho registrado ja tem (o jogador pode
   * te-lo renomeado, FR-008h), ou cai no default de N-5 quando o espelho é novo.
   */
  mirrorName?: string | null;
}

export interface MirrorRemovalInput {
  file: HeroGridFile;
  /** So o config que o app registrou como espelho pode ser removido. */
  mirror: ConfigRef;
  /** Origem, para devolver o `index` corrigido quando o espelho estava antes dela. */
  source?: ConfigRef | null;
}

export interface MirrorRemoval {
  /** Colecao sem o espelho. Os demais configs saem pela mesma referencia (I-2). */
  file: HeroGridFile;
  removedIndex: number;
  removedName: string;
  /** Origem reposicionada: remover um elemento ANTES dela desloca o indice guardado. */
  source: ConfigRef | null;
}

function fail<T>(code: HeroGridErrorCode, error: string): HeroGridResult<T> {
  return { success: false, error, code };
}

const isIndex = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;

/**
 * Nota por heroi, uma unica vez para o arquivo inteiro. É isto que faz I-8 valer: o mesmo
 * heroi em dois grupos consulta a MESMA nota, porque FR-034 tirou o recorte por posicao.
 * Entrada repetida para o mesmo heroi: a primeira vence, para a saida nao depender da ordem
 * em que o ranking foi montado.
 */
function scoreIndex(scores: HeroScore[]): Map<number, number> {
  const byHero = new Map<number, number>();
  for (const entry of scores ?? []) {
    if (!entry || !Number.isInteger(entry.heroId)) continue;
    // `score === null` é "sem dado" (I-9) e fica FORA do mapa de proposito: ausencia no
    // mapa e nota nula sao o mesmo caso, e nenhum dos dois vira numero estimado.
    if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) continue;
    if (!byHero.has(entry.heroId)) byHero.set(entry.heroId, entry.score);
  }
  return byHero;
}

/**
 * Ordena um grupo: nota decrescente na frente, sem dado atras.
 *
 * O desempate é a posicao de origem (`at`), o que torna a ordenacao ESTAVEL sem depender da
 * estabilidade do `Array.prototype.sort` do runtime — e estabilidade é requisito, nao
 * detalhe: I-9 exige que os herois sem dado (e os empatados) saiam na ordem exata que
 * tinham no grid do jogador, senao cada sincronizacao embaralharia o fim do grupo e o diff
 * do arquivo pareceria maior do que a mudanca real.
 */
function orderGroup(
  heroIds: number[],
  byHero: Map<number, number>,
): { ordered: number[]; withData: number; withoutData: number } {
  const scored: Array<{ heroId: number; score: number; at: number }> = [];
  const unscored: number[] = [];

  heroIds.forEach((heroId, at) => {
    const score = byHero.get(heroId);
    if (score === undefined) unscored.push(heroId);
    else scored.push({ heroId, score, at });
  });

  scored.sort((a, b) => b.score - a.score || a.at - b.at);

  return {
    ordered: [...scored.map((entry) => entry.heroId), ...unscored],
    withData: scored.length,
    withoutData: unscored.length,
  };
}

/**
 * FR-008d: "estrutura" é numero de categorias, nomes, coordenadas e alocacao de herois por
 * grupo. A ORDEM dentro do grupo é justamente o que o espelho muda, entao entra na
 * comparacao como conjunto ordenado — comparar a ordem crua marcaria `structureChanged` em
 * toda sincronizacao e o aviso viraria ruido.
 *
 * Sem esta comparacao a feature serviria um grid que nao corresponde mais ao do jogador
 * (risco R-002a).
 */
function sameStructure(source: HeroGridConfig, mirror: HeroGridConfig): boolean {
  const a = source?.categories ?? [];
  const b = mirror?.categories ?? [];
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (left.category_name !== right.category_name) return false;
    if (left.x_position !== right.x_position) return false;
    if (left.y_position !== right.y_position) return false;
    if (left.width !== right.width) return false;
    if (left.height !== right.height) return false;

    const leftIds = [...(left.hero_ids ?? [])].sort((x, y) => x - y);
    const rightIds = [...(right.hero_ids ?? [])].sort((x, y) => x - y);
    if (leftIds.length !== rightIds.length) return false;
    for (let k = 0; k < leftIds.length; k += 1) {
      if (leftIds[k] !== rightIds[k]) return false;
    }
  }

  return true;
}

/** FR-035a: heroi do ranking que nao pertence a nenhum grupo da origem. So informativo. */
function heroesOutsideSource(source: HeroGridConfig, scores: HeroScore[]): number[] {
  const inSource = new Set<number>();
  for (const category of source?.categories ?? []) {
    for (const heroId of category?.hero_ids ?? []) inSource.add(heroId);
  }

  const outside: number[] = [];
  const seen = new Set<number>();
  for (const entry of scores ?? []) {
    const heroId = entry?.heroId;
    if (!Number.isInteger(heroId) || inSource.has(heroId) || seen.has(heroId)) continue;
    seen.add(heroId);
    outside.push(heroId);
  }
  return outside;
}

/**
 * Constroi (ou reconstroi) o layout espelho a partir da origem e do ranking.
 *
 * Devolve a colecao inteira pronta para `valveJson.serializeHeroGridFile`, com a origem
 * intocada (I-1), nenhum outro config alterado (I-2) e no maximo um espelho por origem
 * (I-4). Nao grava nada — a escrita é do main, com backup, atomicidade e a guarda de
 * igualdade profunda.
 */
export function buildMirror(input: MirrorBuildInput): HeroGridResult<MirrorResult> {
  const { file, source, mirror, scores } = input ?? ({} as MirrorBuildInput);

  if (!file || !Array.isArray(file.configs)) {
    return fail('INVALID_JSON', 'Colecao de layouts invalida: `configs` nao é um array.');
  }
  const configs = file.configs;

  // N-4: posicao registrada da origem sumiu (layout apagado no jogo). NAO adivinhar por
  // nome — o chamador avisa e pede nova origem.
  const sourceIndex = source?.index;
  const sourceConfig = isIndex(sourceIndex) ? configs[sourceIndex] : undefined;
  if (!sourceConfig || !Array.isArray(sourceConfig.categories)) {
    return fail(
      'SOURCE_INDEX_GONE',
      `O layout de origem na posicao ${String(sourceIndex)} nao existe mais na colecao.`,
    );
  }

  // N-3 / FR-008h: nome diferente do guardado é RENAME, nao layout novo. Atualiza o rotulo
  // e segue — a identidade continua sendo a posicao.
  const resolvedSource: ConfigRef = { index: sourceIndex, name: sourceConfig.config_name };

  // I-4: o espelho é localizado por POSICAO. Posicao fora da colecao => o jogador apagou o
  // espelho, e um novo é criado no fim; buscar por nome aqui é que criaria o segundo.
  let mirrorIndex: number | null = null;
  if (mirror && isIndex(mirror.index) && mirror.index < configs.length) {
    if (mirror.index === sourceIndex) {
      return fail(
        'SOURCE_MUTATED',
        'A preferencia aponta o espelho para a propria origem; escrever ali alteraria o layout do jogador.',
      );
    }
    mirrorIndex = mirror.index;
  }
  const previousMirror: HeroGridConfig | null = mirrorIndex === null ? null : configs[mirrorIndex];

  const requestedName =
    typeof input.mirrorName === 'string' && input.mirrorName.length > 0 ? input.mirrorName : null;
  const mirrorName =
    requestedName ??
    (previousMirror ? previousMirror.config_name : defaultMirrorName(sourceConfig.config_name));

  /**
   * FR-008e / N-7: layout que o app nao criou nunca é sobrescrito, mesmo com nome identico.
   *
   * A guarda vale quando o app REIVINDICA um nome — espelho novo, ou renome pedido para um
   * nome diferente do que o espelho ja tem. Atualizar o espelho registrado mantendo o nome
   * dele nao reivindica nada (a identidade é a posicao, N-1), e recusar ali travaria a
   * sincronizacao de quem tem dois layouts homonimos na colecao — que é caso real.
   */
  const claimsName = previousMirror === null || mirrorName !== previousMirror.config_name;
  if (claimsName) {
    const taken = configs.findIndex(
      (config, index) => index !== mirrorIndex && config?.config_name === mirrorName,
    );
    if (taken !== -1) {
      return fail(
        'NAME_COLLISION',
        `O nome "${mirrorName}" ja pertence ao layout na posicao ${taken}, que nao foi criado pelo app. Escolha outro nome.`,
      );
    }
  }

  const byHero = scoreIndex(scores);
  const categories: HeroGridCategory[] = [];
  const perGroup: MirrorGroupReport[] = [];

  sourceConfig.categories.forEach((category, categoryIndex) => {
    const { ordered, withData, withoutData } = orderGroup(category?.hero_ids ?? [], byHero);

    // I-5, I-6 e L-4 em uma linha: tudo vem da categoria de origem por spread, e SO
    // `hero_ids` é substituido (e no lugar original da chave, o que mantem o diff minimo).
    categories.push({ ...category, hero_ids: ordered });

    perGroup.push({
      categoryIndex,
      categoryName: category?.category_name,
      ordered: withData,
      withoutData,
    });
  });

  // Espelho existente: preserva os campos desconhecidos que ele ja tinha (L-4). Espelho
  // novo: so os campos conhecidos — copiar campo desconhecido da ORIGEM para um config novo
  // seria inventar dado, e pode ser justamente um campo que nao deve ser duplicado.
  const mirrorConfig: HeroGridConfig = previousMirror
    ? { ...previousMirror, config_name: mirrorName, categories }
    : { config_name: mirrorName, categories };

  // I-4b / N-6: espelho novo vai para o FIM. A posicao dos layouts do jogador nunca muda —
  // senao os `index` guardados nas preferencias passariam a apontar para o layout errado.
  const nextConfigs = configs.slice();
  let finalMirrorIndex: number;
  if (mirrorIndex === null) {
    nextConfigs.push(mirrorConfig);
    finalMirrorIndex = nextConfigs.length - 1;
  } else {
    nextConfigs[mirrorIndex] = mirrorConfig;
    finalMirrorIndex = mirrorIndex;
  }

  // I-3: `version` (e qualquer chave de raiz que a Valve acrescente) vem do arquivo lido.
  const nextFile: HeroGridFile = { ...file, configs: nextConfigs };

  return {
    success: true,
    data: {
      file: nextFile,
      source: resolvedSource,
      mirror: { index: finalMirrorIndex, name: mirrorName },
      perGroup,
      outsideSource: heroesOutsideSource(sourceConfig, scores),
      // Espelho recem-criado nao tem estrutura anterior: nada "mudou desde o ultimo
      // espelho", entao é `false` — o chamador registra criacao, nao mudanca.
      structureChanged: previousMirror !== null && !sameStructure(sourceConfig, previousMirror),
    },
  };
}

/**
 * FR-008g / T037: colecao SEM o config do espelho.
 *
 * A producao do objeto novo é pura e mora aqui, mas remover é uma ESCRITA: passa pelo mesmo
 * backup byte a byte, escrita atomica e guarda do main. So o config que o app registrou como
 * espelho sai — o contrato proibe remover config que o app nao criou.
 */
export function removeMirror(input: MirrorRemovalInput): HeroGridResult<MirrorRemoval> {
  const { file, mirror, source } = input ?? ({} as MirrorRemovalInput);

  if (!file || !Array.isArray(file.configs)) {
    return fail('INVALID_JSON', 'Colecao de layouts invalida: `configs` nao é um array.');
  }
  const configs = file.configs;

  if (!mirror || !isIndex(mirror.index) || mirror.index >= configs.length) {
    return fail(
      'SOURCE_INDEX_GONE',
      `Nao ha layout na posicao ${String(mirror?.index)} para remover.`,
    );
  }

  // Preferencia corrompida (espelho apontando para a origem): remover ali apagaria o layout
  // do jogador. Aborta em vez de "consertar" sozinho.
  if (source && source.index === mirror.index) {
    return fail(
      'SOURCE_MUTATED',
      'A posicao registrada do espelho é a mesma da origem; remover apagaria o layout do jogador.',
    );
  }

  const removed = configs[mirror.index];
  const nextConfigs = configs.filter((_, index) => index !== mirror.index);

  return {
    success: true,
    data: {
      file: { ...file, configs: nextConfigs },
      removedIndex: mirror.index,
      removedName: removed?.config_name,
      // Remover um elemento antes da origem desloca o indice dela em um (N-1).
      source: source
        ? { index: source.index > mirror.index ? source.index - 1 : source.index, name: source.name }
        : null,
    },
  };
}
