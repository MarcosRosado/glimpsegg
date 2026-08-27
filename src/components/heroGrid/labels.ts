import type { TranslationKey } from '../../i18n/translations';
import type { NoDataReason, RankingCriterion } from '../../types/heroGrid';
import type { DaysSinceKind } from '../../utils/heroGrid/tabFormat';

/**
 * Tabelas enum -> chave i18n compartilhadas pelas duas telas da feature.
 *
 * Sao `Record<..., TranslationKey>` com literais explicitos porque a convencao do projeto
 * proibe montar chave em runtime (`t(`prefixo${x}`)`): o teste de chave orfa de
 * `i18n/translations.test.ts` só enxerga literais no codigo, e com `strict: false` o
 * `Record` de uniao fechada é a unica coisa que faz `tsc -b` reclamar de chave digitada
 * errada ou de valor de enum sem texto.
 *
 * Sairam do `HeroGridTab.tsx` quando a tela de replica passou a precisar das mesmas
 * decisoes — duplicar a tabela é como as duas telas comecariam a chamar a mesma coisa por
 * nomes diferentes.
 */

export const CRITERION_LABEL: Record<RankingCriterion, TranslationKey> = {
  COMBINED: 'heroGridCriterionCombined',
  META_ONLY: 'heroGridCriterionMetaOnly',
  PERSONAL_ONLY: 'heroGridCriterionPersonalOnly',
};

export const NO_DATA_LABEL: Record<NoDataReason, TranslationKey> = {
  NO_META: 'heroGridNoDataNoMeta',
  NO_PERSONAL_IN_PERSONAL_ONLY: 'heroGridNoDataNoPersonal',
  HERO_UNKNOWN: 'heroGridNoDataHeroUnknown',
};

/**
 * Nome da fonte de meta -> chave.
 *
 * Recebe `string` porque `HeroGridSyncReport.sourcesUsed`/`sourcesMissing` e
 * `SyncRecord.sourcesUsed` chegam como texto (o segundo vem de `localStorage`, onde o tipo
 * nao vale nada em runtime). Fonte desconhecida devolve `null` e o chamador exibe o valor
 * cru — que é o identificador da fonte, e portanto informacao honesta, nao invencao.
 */
export function metaSourceKey(value: string): TranslationKey | null {
  if (value === 'OPENDOTA_BRACKET') return 'heroGridSourceOpenDota';
  if (value === 'STRATZ_BRACKET') return 'heroGridSourceStratz';
  return null;
}

/**
 * "Quantos dias desde a ultima sincronizacao".
 *
 * `NEVER` é 'nunca sincronizado', e NAO '0 dias': zero dia soaria como "sincronizado hoje",
 * que é exatamente a leitura errada que FR-024a existe para evitar. Quem quiser omitir o
 * rotulo nesse caso trata o `kind` antes de consultar a tabela, em vez de reescrever a
 * escada de ternarios — que é como esta decisao ja existiu em tres copias.
 */
export const DAYS_SINCE_LABEL: Record<DaysSinceKind, TranslationKey> = {
  NEVER: 'heroGridNeverSynced',
  TODAY: 'heroGridDaysSinceToday',
  ONE: 'heroGridDaysSinceOne',
  MANY: 'heroGridDaysSinceMany',
};
