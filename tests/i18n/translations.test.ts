import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { translations } from '../../src/i18n/translations';

/**
 * O gate de compilacao no fim de `translations.ts` garante que as duas locales
 * tenham o MESMO conjunto de chaves. O que ele nao ve:
 *
 * - placeholder divergente (`{count}` no pt e `{n}` no en) — o `t()` substitui por
 *   nome, entao o lado divergente renderiza `{n}` literal na tela;
 * - valor vazio, que cai no fallback e mostra o nome da chave.
 */
const pt = translations['pt-BR'] as Record<string, string>;
const en = translations['en-US'] as Record<string, string>;

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('paridade dos dicionarios de traducao', () => {
  it('as duas locales tem exatamente as mesmas chaves', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  it('nenhuma entrada esta vazia', () => {
    for (const [key, value] of [...Object.entries(pt), ...Object.entries(en)]) {
      expect(value.trim(), `chave vazia: ${key}`).not.toBe('');
    }
  });

  it('cada chave usa os mesmos placeholders nas duas locales', () => {
    for (const key of Object.keys(pt)) {
      expect(placeholders(en[key]), `placeholders divergentes em "${key}"`).toEqual(
        placeholders(pt[key]),
      );
    }
  });
});

/**
 * Guard de chave orfa.
 *
 * O gate de compilacao pega chave USADA que nao existe. O contrario — chave que existe
 * e ninguem usa — acumulava em silencio: eram 75 quando esta suite entrou, varias delas
 * porque o componente tinha o texto cravado no JSX enquanto a traducao ficava desligada
 * do lado do dicionario.
 *
 * Depende da convencao de nunca montar chave em runtime (`t(`prefixo${x}`)`): todas as
 * tabelas de chave dinamica sao `Record<..., TranslationKey>` com literais explicitos,
 * que este scan enxerga. Se algum dia for preciso montar chave concatenando, este teste
 * acusa — e a correcao é a tabela explicita, nao afrouxar o guard.
 */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSources(full, out);
    else if (/\.tsx?$/.test(entry) && !full.includes('i18n')) out.push(full);
  }
  return out;
}

const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('chaves de traducao orfas', () => {
  it('toda chave do dicionario é referenciada em algum lugar de src/', () => {
    const blob = collectSources('src')
      .map((f) => stripComments(readFileSync(f, 'utf8')))
      .join('\n');

    const referenced = new Set(
      [...blob.matchAll(/['"`]([A-Za-z0-9_]+)['"`]/g)].map((m) => m[1]),
    );

    const orphans = Object.keys(pt).filter((key) => !referenced.has(key));
    expect(orphans, `chaves sem uso: ${orphans.join(', ')}`).toEqual([]);
  });
});
