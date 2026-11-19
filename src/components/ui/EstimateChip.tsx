import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';

/**
 * Selo de ESTIMATIVA: número comparado contra constante fixa, não contra dado medido.
 *
 * É o rótulo que a doutrina exige para `ROLE_BASELINE` (CLAUDE.md da raiz, "nunca inventar
 * dado"): o MMR que sai da medalha, o alvo do timer de itens (`ITEM_BENCHMARKS`) e o radar
 * (`ROLE_BASELINES`). A 1.0 mostrava os três sem selo — o item 1 do §1 da proposta da 2.0.
 *
 * `hint` diz DE ONDE vem a estimativa; ele vira o `title` e o nome acessível do selo.
 */
export const EstimateChip: React.FC<{ hint: string; className?: string }> = ({ hint, className }) => {
  const { t } = useLanguage();
  return (
    <span
      title={hint}
      aria-label={`${t('estimateChip')}: ${hint}`}
      className={cn(
        'inline-flex items-center shrink-0 cursor-help rounded border border-dashed border-orange-400/50 px-1 py-px',
        'text-[9px] font-bold uppercase tracking-wider text-orange-300/90 leading-none',
        className,
      )}
    >
      {t('estimateChip')}
    </span>
  );
};
