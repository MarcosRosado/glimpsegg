import { describe, expect, it } from 'vitest';
import { translations } from '../../src/i18n/translations';
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TABS,
  firstTabWithError,
  tabsWithErrors,
  type SettingsTab,
} from '../../src/utils/settingsTabs';

/**
 * O que estes testes protegem: com o modal repartido em abas, um erro pode ficar fora de
 * vista e o Salvar parecer que nao fez nada. A marca na aba e o foco ao salvar sao a
 * compensacao, e vivem aqui porque o `.tsx` nao é testavel.
 */
describe('definicao das abas', () => {
  it('nao tem id repetido', () => {
    const ids = SETTINGS_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada aba tem rotulo nas DUAS locales', () => {
    for (const tab of SETTINGS_TABS) {
      expect(translations['pt-BR'][tab.labelKey], `pt-BR: ${tab.labelKey}`).toBeTruthy();
      expect(translations['en-US'][tab.labelKey], `en-US: ${tab.labelKey}`).toBeTruthy();
    }
  });

  it('a aba inicial é a primeira da lista', () => {
    expect(DEFAULT_SETTINGS_TAB).toBe(SETTINGS_TABS[0].id);
  });
});

describe('abas com erro', () => {
  it('sem erro nenhum, nenhuma aba é marcada', () => {
    for (const entrada of [null, undefined, {}, { steamId: null, heroGrid: null }]) {
      expect(tabsWithErrors(entrada)).toEqual([]);
      expect(firstTabWithError(entrada)).toBeNull();
    }
  });

  it('string vazia ou so espaco NAO é erro', () => {
    // O estado limpo de varios campos do modal é `''`, nao `null`. Tratar isso como erro
    // deixaria a marca acesa o tempo todo e ela pararia de significar alguma coisa.
    expect(tabsWithErrors({ steamId: '', heroGrid: '   ' })).toEqual([]);
  });

  it('mapeia cada erro para a sua aba', () => {
    expect(tabsWithErrors({ steamId: 'ID invalido' })).toEqual(['ACCOUNT']);
    expect(tabsWithErrors({ heroGrid: 'caminho invalido' })).toEqual(['HERO_GRID']);
  });

  it('com varios erros, devolve na ordem de exibicao das abas', () => {
    const ordem = SETTINGS_TABS.map((t) => t.id);
    const resultado = tabsWithErrors({ steamId: 'x', heroGrid: 'y' });

    expect(resultado).toEqual(['ACCOUNT', 'HERO_GRID']);
    // A ordem tem de ser a das abas, nao a de escrita do objeto de erros: o foco vai para
    // a PRIMEIRA da esquerda para a direita, que é o que a pessoa espera achar.
    const indices = resultado.map((id: SettingsTab) => ordem.indexOf(id));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it('o foco vai para a primeira aba com erro', () => {
    expect(firstTabWithError({ steamId: 'x', heroGrid: 'y' })).toBe('ACCOUNT');
    expect(firstTabWithError({ heroGrid: 'y' })).toBe('HERO_GRID');
  });

  it('toda aba citada existe em SETTINGS_TABS', () => {
    const conhecidas = new Set(SETTINGS_TABS.map((t) => t.id));
    for (const id of tabsWithErrors({ steamId: 'x', heroGrid: 'y' })) {
      expect(conhecidas.has(id)).toBe(true);
    }
  });
});
