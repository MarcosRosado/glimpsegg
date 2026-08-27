import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  formatValveNumber,
  HeroGridParseError,
  isHeroGridParseError,
  parseHeroGridFile,
  serializeHeroGridFile,
} from './valveJson';
import type { HeroGridFile } from '../../types/heroGrid';

/**
 * O que este arquivo protege (specs/001-meta-hero-grid):
 *
 * - **FR-007c**: o diff no arquivo do jogador tem de ser minimo. O teste byte a byte contra
 *   o `.raw.txt` real e a unica prova disso — igualdade profunda passaria com
 *   `JSON.stringify`, que reescreve o arquivo inteiro.
 * - **I-3**: `version` e o valor LIDO. A anti-fixture tem `version: 4` de proposito.
 * - **L-4**: campo desconhecido que a Valve acrescente sobrevive a escrita, na posicao
 *   original. Nao ha tipo que garanta isso (as interfaces de `types/heroGrid.ts` nao tem
 *   index signature, deliberadamente) — quem garante e este round-trip.
 * - **L-2 / L-3**: arquivo invalido e distinguivel de arquivo vazio. Confundir os dois
 *   levaria a sobrescrever os grids do jogador com um arquivo "vazio".
 *
 * As fixtures sao lidas com `readFileSync` em vez de `import ... from '*.json'` porque o
 * que esta em teste inclui a ORDEM das chaves: ler o texto e chamar `JSON.parse` mantem a
 * ordem do arquivo sem depender do loader de JSON do bundler.
 */

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../../services/__fixtures__/${name}`, import.meta.url));

const readFixture = (name: string) => readFileSync(fixturePath(name), 'utf8');

const REAL_RAW = readFixture('hero-grid-real.raw.txt');
const REAL_JSON_TEXT = readFixture('hero-grid-real.json');
const ADVERSE_JSON_TEXT = readFixture('hero-grid-adverse.json');

/** Copia nova a cada uso, para nenhum teste ver objeto tocado por outro. */
const realFile = () => JSON.parse(REAL_JSON_TEXT) as HeroGridFile;
const adverseFile = () => JSON.parse(ADVERSE_JSON_TEXT) as HeroGridFile;

describe('serializeHeroGridFile — round-trip profundo', () => {
  it('preserva a fixture real em profundidade', () => {
    const original = realFile();
    expect(parseHeroGridFile(serializeHeroGridFile(original))).toEqual(original);
  });

  it('preserva a anti-fixture em profundidade', () => {
    const original = adverseFile();
    expect(parseHeroGridFile(serializeHeroGridFile(original))).toEqual(original);
  });

  it('nao muta o objeto de entrada', () => {
    const original = adverseFile();
    const snapshot = JSON.stringify(original);
    serializeHeroGridFile(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('serializeHeroGridFile — round-trip byte a byte (FR-007c)', () => {
  it('reproduz o arquivo real caractere por caractere quando o conteudo nao muda', () => {
    expect(serializeHeroGridFile(parseHeroGridFile(REAL_RAW))).toBe(REAL_RAW);
  });

  it('parte do .json e chega ao mesmo texto do .raw.txt', () => {
    // Prova que o estilo nao depende de o objeto ter vindo do texto original: o `.json`
    // perdeu os zeros a direita (`43.47826`, `0.0`) e o serializador os recompoe.
    expect(serializeHeroGridFile(realFile())).toBe(REAL_RAW);
  });

  it('usa TAB, mantem `[` em linha propria e nao escreve newline final', () => {
    const text = serializeHeroGridFile(realFile());
    expect(text.startsWith('{\n\t"version": 3,\n\t"configs":\n\t[\n')).toBe(true);
    expect(text.includes('  ')).toBe(false);
    expect(text.includes('\r')).toBe(false);
    expect(text.endsWith('\n')).toBe(false);
    expect(text.endsWith('\n}')).toBe(true);
  });

  it('escreve geometria com 6 decimais mesmo quando o valor e inteiro', () => {
    // Caracteristica medida no arquivo real e ausente do contrato: `y_position` valendo 0
    // aparece como `0.000000`. `JSON.parse` entrega `0`, e imprimir `0` quebraria o diff.
    const text = serializeHeroGridFile(realFile());
    expect(text).toContain('"y_position": 0.000000,');
    expect(text).not.toContain('"y_position": 0,');
  });

  it('altera apenas as linhas dos hero_ids reordenados', () => {
    // O ponto de FR-007c: reordenar um grupo nao pode fazer o arquivo inteiro virar diff.
    const file = realFile();
    file.configs[0].categories[0].hero_ids.reverse();
    const before = REAL_RAW.split('\n');
    const after = serializeHeroGridFile(file).split('\n');
    expect(after).toHaveLength(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    // 17 herois no grupo (o do meio cai na mesma posicao ao inverter), entao no maximo as
    // 17 linhas do proprio grupo mudam — nada fora dele. E pelo menos uma muda, senao o
    // teste passaria sem exercitar nada.
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThanOrEqual(17);
  });
});

describe('I-3 — version vem do arquivo, nao e fixado', () => {
  it('mantem version 4 da anti-fixture no round-trip', () => {
    const text = serializeHeroGridFile(adverseFile());
    expect(text).toContain('\t"version": 4,');
    expect(parseHeroGridFile(text).version).toBe(4);
  });

  it('mantem um version de patch futuro que o app nunca viu', () => {
    const file = adverseFile();
    file.version = 99;
    expect(parseHeroGridFile(serializeHeroGridFile(file)).version).toBe(99);
  });
});

describe('L-4 — campo desconhecido da Valve sobrevive a escrita', () => {
  it('preserva o campo desconhecido de um config, na posicao original', () => {
    const reparsed = parseHeroGridFile(serializeHeroGridFile(adverseFile()));
    const config = reparsed.configs[1] as unknown as Record<string, unknown>;
    expect(config.future_valve_config_field).toBe('reservado');
    // Posicao, nao so presenca: entre `config_name` e `categories`, como no arquivo.
    expect(Object.keys(config)).toEqual([
      'config_name',
      'future_valve_config_field',
      'categories',
    ]);
  });

  it('preserva o campo desconhecido de uma category, na posicao original', () => {
    const reparsed = parseHeroGridFile(serializeHeroGridFile(adverseFile()));
    const category = reparsed.configs[0].categories[1] as unknown as Record<string, unknown>;
    expect(category.future_valve_field).toBe(7);
    expect(Object.keys(category)).toEqual([
      'category_name',
      'x_position',
      'y_position',
      'width',
      'height',
      'future_valve_field',
      'hero_ids',
    ]);
  });

  it('preserva campo desconhecido de qualquer tipo, inclusive aninhado', () => {
    const file = adverseFile();
    const config = file.configs[0] as unknown as Record<string, unknown>;
    config.future_flag = true;
    config.future_null = null;
    config.future_object = { a: 1, b: ['x', 2.5] };
    const reparsed = parseHeroGridFile(serializeHeroGridFile(file));
    const back = reparsed.configs[0] as unknown as Record<string, unknown>;
    expect(back.future_flag).toBe(true);
    expect(back.future_null).toBeNull();
    expect(back.future_object).toEqual({ a: 1, b: ['x', 2.5] });
  });
});

describe('L-3 — configs ausente ou nao-array e arquivo INVALIDO', () => {
  const invalidos: Array<[string, string]> = [
    ['objeto vazio', '{}'],
    ['sem configs', '{ "version": 3 }'],
    ['configs como objeto', '{ "version": 3, "configs": { "0": {} } }'],
    ['configs como string', '{ "version": 3, "configs": "Layout1" }'],
    ['configs nulo', '{ "version": 3, "configs": null }'],
    ['raiz que nao e objeto', '[]'],
  ];

  it.each(invalidos)('rejeita %s com codigo INVALID_CONFIGS', (_nome, texto) => {
    let caught: unknown;
    try {
      parseHeroGridFile(texto);
    } catch (error) {
      caught = error;
    }
    expect(isHeroGridParseError(caught)).toBe(true);
    expect((caught as HeroGridParseError).code).toBe('INVALID_CONFIGS');
  });

  it('aceita configs vazio — arquivo valido, sem layout nenhum', () => {
    // A distincao que L-3 exige: `configs: []` e um arquivo VALIDO e vazio; `configs`
    // ausente e um arquivo invalido. Confundir os dois levaria a sobrescrever grids.
    const file = parseHeroGridFile('{ "version": 3, "configs": [] }');
    expect(file.configs).toEqual([]);
    expect(serializeHeroGridFile(file)).toBe('{\n\t"version": 3,\n\t"configs":\n\t[\n\t]\n}');
  });
});

describe('L-2 — JSON invalido e distinguivel e nao vaza SyntaxError', () => {
  const quebrados = ['{ "version": 3,, }', '', 'não é json', '{ "version": 3, "configs": [', '{,}'];

  it.each(quebrados)('rejeita %j com codigo INVALID_JSON', (texto) => {
    let caught: unknown;
    try {
      parseHeroGridFile(texto);
    } catch (error) {
      caught = error;
    }
    expect(isHeroGridParseError(caught)).toBe(true);
    expect(caught).toBeInstanceOf(HeroGridParseError);
    expect((caught as HeroGridParseError).code).toBe('INVALID_JSON');
    // O SyntaxError cru nao chega a quem chama: ele viria sem codigo e o caminho de
    // escrita nao teria como distinguir "invalido" de qualquer outra falha.
    expect((caught as Error).name).toBe('HeroGridParseError');
  });
});

describe('formatValveNumber', () => {
  it('imprime inteiro sem decimal', () => {
    expect(formatValveNumber(3)).toBe('3');
    expect(formatValveNumber(0)).toBe('0');
    expect(formatValveNumber(155)).toBe('155');
    expect(formatValveNumber(-3)).toBe('-3');
  });

  it('imprime float com exatamente 6 decimais', () => {
    expect(formatValveNumber(43.47826)).toBe('43.478260');
    expect(formatValveNumber(290.434784)).toBe('290.434784');
    expect(formatValveNumber(0.869565)).toBe('0.869565');
    expect(formatValveNumber(-12.5)).toBe('-12.500000');
  });

  it('forca decimal quando o campo e de geometria', () => {
    expect(formatValveNumber(0, true)).toBe('0.000000');
    expect(formatValveNumber(632, true)).toBe('632.000000');
  });

  it('preserva precisao maior que a da Valve em vez de truncar', () => {
    // Truncar seria mutacao silenciosa da origem, e a guarda E-3 (igualdade profunda entre
    // o lido e o gravado) abortaria a escrita com SOURCE_MUTATED sem motivo.
    const preciso = 0.12345678;
    expect(Number(formatValveNumber(preciso))).toBe(preciso);
  });

  it('mantem inteiro gigante em notacao exponencial, que e JSON valido', () => {
    expect(formatValveNumber(1e21)).toBe('1e+21');
    expect(JSON.parse(`[${formatValveNumber(1e21)}]`)).toEqual([1e21]);
  });

  it('lanca em NaN e Infinity em vez de virar null no arquivo', () => {
    // `JSON.stringify` trocaria por `null`, o que gravaria geometria corrompida no
    // arquivo do jogador. Falhar alto e a saida honesta.
    expect(() => formatValveNumber(NaN)).toThrow(TypeError);
    expect(() => formatValveNumber(Infinity)).toThrow(TypeError);
    expect(() => formatValveNumber(-Infinity)).toThrow(TypeError);
  });
});

describe('bordas de estrutura', () => {
  it('serializa categoria com hero_ids vazio sem produzir sintaxe invalida', () => {
    const file = adverseFile();
    const vazia = file.configs[0].categories[2];
    expect(vazia.hero_ids).toEqual([]);
    const text = serializeHeroGridFile(file);
    expect(text).toContain('\t"hero_ids":\n\t\t\t\t\t[\n\t\t\t\t\t]\n');
    const reparsed = parseHeroGridFile(text);
    expect(reparsed.configs[0].categories[2].hero_ids).toEqual([]);
    expect(reparsed.configs[0].categories[2].category_name).toBe('grupo Vazio');
  });

  it('serializa layout sem categoria nenhuma', () => {
    const file = adverseFile();
    file.configs[2].categories = [];
    const reparsed = parseHeroGridFile(serializeHeroGridFile(file));
    expect(reparsed.configs[2].categories).toEqual([]);
    expect(reparsed.configs).toHaveLength(3);
  });

  it('preserva nome com acento e id fora do catalogo', () => {
    const reparsed = parseHeroGridFile(serializeHeroGridFile(adverseFile()));
    expect(reparsed.configs[1].categories[0].category_name).toBe('Só um grupo');
    // L-5: id desconhecido pelo catalogo do app e preservado, nao filtrado.
    expect(reparsed.configs[1].categories[0].hero_ids).toContain(9999);
  });

  it('escreve nome com aspas e barra sem escapar acentuacao', () => {
    const file = realFile();
    file.configs[0].config_name = 'Meu "layout" \\ 1';
    const text = serializeHeroGridFile(file);
    expect(text).toContain('"config_name": "Meu \\"layout\\" \\\\ 1",');
    expect(parseHeroGridFile(text).configs[0].config_name).toBe('Meu "layout" \\ 1');
  });

  it('mantem nomes de layout repetidos como dois configs distintos', () => {
    // Identidade e a POSICAO: dois `Meta Espelho` existem no arquivo e continuam dois.
    const reparsed = parseHeroGridFile(serializeHeroGridFile(adverseFile()));
    expect(reparsed.configs.map((c) => c.config_name)).toEqual([
      'Meta Espelho',
      'Meta Espelho',
      'Outro layout',
    ]);
  });
});
