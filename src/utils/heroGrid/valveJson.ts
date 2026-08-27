import type { HeroGridFile } from '../../types/heroGrid';

/**
 * Serializador e leitor do `hero_grid_config.json` no estilo da Valve
 * (specs/001-meta-hero-grid, contracts/hero-grid-file.md).
 *
 * Modulo PURO: recebe e devolve string, nao faz I/O. O `main.cjs` grava os bytes que
 * saem daqui sem serializar nada (GridWriteRequest.content).
 *
 * ## Por que nao `JSON.stringify`
 *
 * FR-007c / D-2: o arquivo pertence ao jogador e o cliente do Dota escreve nele com um
 * estilo proprio. `JSON.stringify` passaria no teste de igualdade profunda, mas reescreve
 * a formatacao inteira — o diff faria parecer que a ferramenta mexeu no layout de origem,
 * corroendo a confianca justamente na feature que promete NAO tocar nele. Aqui o objetivo
 * e o diff minimo: mudou a ordem de um `hero_ids`, so aquelas linhas mudam.
 *
 * ## Caracteristicas medidas no arquivo real (`__fixtures__/hero-grid-real.raw.txt`)
 *
 * Medidas com `cat -A` sobre o arquivo real da maquina do autor. As tres primeiras estao
 * no contrato; as demais NAO estavam e foram descobertas ao fechar o round-trip byte a
 * byte, por isso ficam registradas aqui:
 *
 * 1. Indentacao por TAB, um nivel por profundidade. Sem CR — LF puro.
 * 2. `[` de array em LINHA PROPRIA depois da chave (`"configs":` / `"categories":` /
 *    `"hero_ids":`), nunca colado nela. Cada `hero_id` em sua propria linha.
 * 3. Floats com exatamente 6 decimais (`43.478260`, `290.434784`).
 * 4. **Nao documentado no contrato**: os campos de geometria sao float SEMPRE, mesmo com
 *    valor inteiro — o arquivo real tem tres `0.000000` (em `y_position` e `x_position`).
 *    `JSON.parse` os entrega como `0`, e uma regra generica "inteiro sem decimal" imprimiria
 *    `0` e quebraria o byte a byte. Dai `ALWAYS_FLOAT_KEYS`. `version` e os `hero_ids`, ao
 *    contrario, sao inteiros e saem sem decimal.
 * 5. **Nao documentado**: `\t"version": 3,` — um unico espaco depois dos dois pontos, e
 *    nenhuma virgula sobrando no ultimo item de objeto ou array.
 * 6. **Nao documentado**: SEM newline final. O arquivo termina no `}` da raiz. Confirmado
 *    com `cat -A` (ultima linha sem `$`) — replicado aqui.
 * 7. **Nao documentado**: nao-ASCII vai literal em UTF-8 (`"Grupo Três"`), sem escape
 *    `\uXXXX`. `JSON.stringify` de string se comporta assim, entao ele serve para os
 *    valores de texto.
 *
 * ## Ordem das chaves e L-4
 *
 * `emitObject` itera `Object.keys(obj)` — a ordem de insercao do objeto, que para um objeto
 * vindo de `JSON.parse` e a ordem do arquivo. NAO existe lista fixa de campos aqui, e isso e
 * deliberado: e o que faz L-4 funcionar. Campo que a Valve acrescente num patch novo
 * (`future_valve_field`) sobrevive ao round-trip na posicao em que estava, porque escrevemos
 * as chaves que o objeto TEM em vez das chaves que conhecemos. Trocar isso por uma lista de
 * campos conhecidos e perda silenciosa de dado do jogador — `valveJson.test.ts` falha se
 * alguem "simplificar" nesse sentido.
 */

/** Um nivel de indentacao: TAB, como no arquivo real. */
const INDENT = '\t';

/**
 * Chaves impressas SEMPRE com decimal, mesmo quando o valor e inteiro (caracteristica 4).
 * Sao os quatro campos de geometria de `HeroGridCategory`; no arquivo da Valve eles vem de
 * floats impressos com `%f`, entao `0` aparece como `0.000000`.
 */
const ALWAYS_FLOAT_KEYS = new Set(['x_position', 'y_position', 'width', 'height']);

/** Casas decimais do estilo da Valve. */
const FLOAT_DECIMALS = 6;

export type HeroGridParseErrorCode = 'INVALID_JSON' | 'INVALID_CONFIGS';

/**
 * Erro de leitura, com codigo para quem chama distinguir "arquivo invalido" de "arquivo
 * vazio" (L-2, L-3). Essa distincao e o ponto: em arquivo invalido o app ABORTA e nao
 * sobrescreve nada — tratar como vazio destruiria os grids do jogador.
 *
 * Escolhemos lancar (em vez de devolver `{ ok: false }`) para manter `parseHeroGridFile`
 * componivel com `serializeHeroGridFile` no caminho felizo, seguindo o precedente de
 * `RateLimitedError` em `services/stratzHeroStats.ts`. O erro e tipado e esperado — quem
 * chama captura e mapeia para `HeroGridErrorCode.INVALID_JSON`.
 */
export class HeroGridParseError extends Error {
  readonly code: HeroGridParseErrorCode;

  constructor(code: HeroGridParseErrorCode, message: string) {
    super(message);
    this.name = 'HeroGridParseError';
    this.code = code;
  }
}

/** Type guard para quem captura sem depender de `instanceof` atravessando bundles. */
export function isHeroGridParseError(value: unknown): value is HeroGridParseError {
  return value instanceof HeroGridParseError;
}

/**
 * Formata um numero no estilo da Valve: inteiro sem decimal, float com 6 decimais.
 *
 * `forceFloat` existe para a caracteristica 4 (geometria e float mesmo valendo `0`).
 *
 * Precisao: se `toFixed(6)` NAO reproduzir o valor original, imprimimos a representacao
 * completa. Arquivo real da Valve so tem 6 decimais, entao esse ramo nunca dispara com ele;
 * o ramo existe porque truncar seria mutacao silenciosa de dado da origem, e a guarda E-3
 * (igualdade profunda entre o que foi lido e o que vai para o disco) abortaria a escrita com
 * `SOURCE_MUTATED` — falha correta, mas sem motivo.
 *
 * `NaN` e `Infinity` LANCAM: nao tem representacao em JSON e `JSON.stringify` os troca por
 * `null`, o que viraria geometria corrompida no arquivo do jogador. Falhar alto e a saida
 * honesta.
 */
export function formatValveNumber(value: number, forceFloat = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`valor numerico nao finito no hero grid: ${String(value)}`);
  }
  if (Number.isInteger(value) && !forceFloat) {
    // Inteiro grande demais sai em notacao exponencial (`1e+21`), que ainda e JSON valido.
    return String(value);
  }
  const fixed = value.toFixed(FLOAT_DECIMALS);
  return Number(fixed) === value ? fixed : String(value);
}

function pad(depth: number): string {
  return INDENT.repeat(depth);
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

/** Escalar inline: `"texto"`, numero, `true`, `null`. */
function formatScalar(value: unknown, forceFloat: boolean): string {
  if (typeof value === 'number') return formatValveNumber(value, forceFloat);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return 'null';
  // Tipo que nao existe em JSON (function, symbol, bigint). Nao inventamos representacao.
  throw new TypeError(`valor nao serializavel no hero grid: ${typeof value}`);
}

function emitValue(value: unknown, depth: number, suffix: string, out: string[]): void {
  if (Array.isArray(value)) {
    emitArray(value, depth, suffix, out);
    return;
  }
  emitObject(value as Record<string, unknown>, depth, suffix, out);
}

function emitArray(items: unknown[], depth: number, suffix: string, out: string[]): void {
  out.push(`${pad(depth)}[`);
  items.forEach((item, index) => {
    const comma = index < items.length - 1 ? ',' : '';
    if (isContainer(item)) {
      emitValue(item, depth + 1, comma, out);
    } else {
      out.push(`${pad(depth + 1)}${formatScalar(item, false)}${comma}`);
    }
  });
  // Array vazio fecha na linha seguinte ao `[`. Sintaxe valida, e e o caso de
  // `hero_ids: []` (categoria vazia existe no arquivo do jogador).
  out.push(`${pad(depth)}]${suffix}`);
}

function emitObject(
  obj: Record<string, unknown>,
  depth: number,
  suffix: string,
  out: string[],
): void {
  out.push(`${pad(depth)}{`);
  // Ordem de insercao, sem lista fixa de campos — ver "Ordem das chaves e L-4" no topo.
  // `undefined` e omitido, como faz o JSON.stringify: nao ha literal para ele em JSON.
  const keys = Object.keys(obj).filter((key) => obj[key] !== undefined);
  keys.forEach((key, index) => {
    const comma = index < keys.length - 1 ? ',' : '';
    const label = `${pad(depth + 1)}${JSON.stringify(key)}:`;
    const value = obj[key];
    if (isContainer(value)) {
      // Chave sozinha na linha; o `[` ou `{` vem na linha seguinte (caracteristica 2).
      out.push(label);
      emitValue(value, depth + 1, comma, out);
    } else {
      out.push(`${label} ${formatScalar(value, ALWAYS_FLOAT_KEYS.has(key))}${comma}`);
    }
  });
  out.push(`${pad(depth)}}${suffix}`);
}

/**
 * Serializa o arquivo no estilo da Valve. Sem newline final (caracteristica 6).
 *
 * O parametro e tipado como `HeroGridFile`, mas a implementacao e generica de proposito:
 * campo desconhecido presente no objeto em runtime e escrito igual (L-4).
 */
export function serializeHeroGridFile(file: HeroGridFile): string {
  if (!isContainer(file) || Array.isArray(file)) {
    throw new TypeError('hero grid a serializar nao e um objeto');
  }
  const out: string[] = [];
  emitObject(file as unknown as Record<string, unknown>, 0, '', out);
  return out.join('\n');
}

/**
 * Le o texto do arquivo. Lanca `HeroGridParseError` em:
 *
 * - L-2: JSON sintaticamente invalido → codigo `INVALID_JSON`.
 * - L-3: `configs` ausente ou nao-array (inclui `'{}'` e raiz que nao e objeto) → codigo
 *   `INVALID_CONFIGS`. Regra de L-3: e ARQUIVO INVALIDO, nunca "arquivo vazio". Quem chama
 *   nao pode seguir para a escrita.
 *
 * Nao validamos nada alem disso: `version` e os campos de cada `config`/`category` sao
 * preservados como estao (I-3, L-4). Validacao a mais aqui viraria recusa de arquivo de
 * patch futuro que o Dota 2 aceita.
 */
export function parseHeroGridFile(text: string): HeroGridFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new HeroGridParseError(
      'INVALID_JSON',
      `hero_grid_config.json invalido: ${(error as Error).message}`,
    );
  }
  if (!isContainer(data) || Array.isArray(data)) {
    throw new HeroGridParseError('INVALID_CONFIGS', 'hero_grid_config.json: raiz nao e um objeto');
  }
  if (!Array.isArray((data as { configs?: unknown }).configs)) {
    throw new HeroGridParseError(
      'INVALID_CONFIGS',
      'hero_grid_config.json: campo "configs" ausente ou nao-array (L-3)',
    );
  }
  return data as unknown as HeroGridFile;
}
