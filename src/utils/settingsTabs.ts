import type { TranslationKey } from '../i18n/translations';

/**
 * As abas do modal de configuracoes, e qual delas guarda cada erro.
 *
 * O modal tinha 1287 linhas numa coluna de 512px, e a saida foi reparti-lo em abas. A
 * repartição criou um risco que a coluna unica nao tinha: **erro em aba escondida**. Antes,
 * um Steam ID invalido ficava visivel ao lado do campo; com abas, ele pode estar duas abas
 * atras e o Salvar simplesmente nao faz nada aparente. Este modulo é o que impede isso —
 * `tabsWithErrors` diz onde marcar, e o modal leva o foco para a primeira aba culpada.
 *
 * Mora em `utils/` e nao no `.tsx` porque `.tsx` nao tem teste neste projeto (vitest em
 * `environment: 'node'`). A tabela de rotulos é `Record<..., TranslationKey>` com literais
 * explicitos — chave montada em runtime some do guard de chave orfa de
 * `i18n/translations.test.ts`.
 */
export type SettingsTab = 'ACCOUNT' | 'STRATZ' | 'HERO_GRID' | 'APP';

export interface SettingsTabDef {
  id: SettingsTab;
  labelKey: TranslationKey;
}

/** Ordem de exibicao. A primeira é a aba inicial do modal. */
export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  { id: 'ACCOUNT', labelKey: 'settingsTabAccount' },
  { id: 'STRATZ', labelKey: 'settingsTabStratz' },
  { id: 'HERO_GRID', labelKey: 'settingsTabHeroGrid' },
  { id: 'APP', labelKey: 'settingsTabApp' },
];

export const DEFAULT_SETTINGS_TAB: SettingsTab = SETTINGS_TABS[0].id;

/**
 * Erros do formulario, por origem. Cada campo é a mensagem ja resolvida ou vazio/nulo.
 *
 * Um objeto e nao uma lista de abas porque quem chama tem os erros na mao por CAMPO; mapear
 * campo -> aba aqui mantem a decisao num lugar só, e é ela que envelhece quando uma seção
 * muda de aba.
 */
export interface SettingsErrors {
  steamId?: string | null;
  heroGrid?: string | null;
}

/** Abas com pelo menos um erro, na ordem de `SETTINGS_TABS`. */
export function tabsWithErrors(errors: SettingsErrors | null | undefined): SettingsTab[] {
  if (!errors) return [];

  const hit = new Set<SettingsTab>();
  // String vazia e espaco em branco NAO sao erro: o estado limpo do campo é `''` em vez de
  // `null` em varios pontos do modal, e marcar a aba por causa disso acenderia a marca
  // permanentemente.
  if (errors.steamId?.trim()) hit.add('ACCOUNT');
  if (errors.heroGrid?.trim()) hit.add('HERO_GRID');

  return SETTINGS_TABS.filter((tab) => hit.has(tab.id)).map((tab) => tab.id);
}

/** A aba para onde levar o foco ao tentar salvar com erro. `null` quando nao ha erro. */
export function firstTabWithError(errors: SettingsErrors | null | undefined): SettingsTab | null {
  return tabsWithErrors(errors)[0] ?? null;
}
