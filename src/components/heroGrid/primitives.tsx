import React from 'react';

import { useLanguage } from '../../context/LanguageContext';
import type { ConfigRef } from '../../types/heroGrid';

/**
 * As tres pecas de UI compartilhadas pelas duas telas da feature de layout espelho.
 *
 * Nasceram locais no `HeroGridTab.tsx` e sairam de la quando a tela de replica
 * (`HeroGridMirrorScreen.tsx`) passou a precisar das mesmas — o mesmo caminho do
 * `ui/IconButton.tsx`, que virou componente depois de a terceira copia aparecer. Ficam
 * aqui, e nao em `components/ui/`, porque `LayoutRef` conhece `ConfigRef` e a chave i18n
 * `heroGridLayoutPosition`: é peca da feature, nao primitiva de design.
 *
 * A tipografia usa a escala em `rem` do app (`text-xs` = 0.75rem, que com o `font-size` de
 * 17.5px do `html` dá ~13px), e nao px absoluto. Foi a troca que consertou o "esta pagina tem
 * fonte menor que as outras": `text-[11px]` nao escala com o `html`, entao ele nasce ~17%
 * menor que qualquer `text-xs` vizinho.
 *
 * Nenhuma delas decide nada — cor, rotulo e conteudo vem de quem chama. A decisao de *o
 * que* dizer mora na tela, e a de *como formatar* mora em `utils/heroGrid/`, que o vitest
 * alcanca (`.tsx` nao é testavel neste projeto: o vitest roda em `environment: 'node'`).
 */

/** Aviso em bloco. `tone` só muda a cor — o texto é que carrega o peso. */
export const Notice: React.FC<{
  tone: 'info' | 'warn' | 'danger';
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}> = ({ tone, icon, title, children }) => {
  const accent =
    tone === 'danger'
      ? 'border-rose-500/30 bg-rose-950/25'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-950/20'
        : 'border-slate-700/70 bg-slate-900/50';
  const titleColor =
    tone === 'danger' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-200';

  return (
    <div className={`glass-card rounded-xl p-4 border ${accent} flex items-start gap-3`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <h4 className={`text-xs font-bold mb-1 ${titleColor}`}>{title}</h4>
        {children && <div className="text-xs text-slate-400 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
};

/** Chip neutro de rotulo curto. */
export const Chip: React.FC<{ children: React.ReactNode; muted?: boolean; title?: string }> = ({
  children,
  muted,
  title,
}) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border ${
      muted
        ? 'text-slate-400 border-slate-700 bg-slate-900/60'
        : 'text-cyan-300/90 border-cyan-500/30 bg-cyan-950/40'
    }`}
  >
    {children}
  </span>
);

/** Rotulo de um layout: nome + POSICAO, porque a posicao é a identidade (N-1). */
export const LayoutRef: React.FC<{
  label: string;
  configRef: ConfigRef | null;
  emptyLabel: string;
}> = ({ label, configRef, emptyLabel }) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
        {label}
      </span>
      {configRef ? (
        <>
          <span className="text-xs font-bold text-slate-200 truncate">{configRef.name}</span>
          <Chip muted>{t('heroGridLayoutPosition', { index: configRef.index })}</Chip>
        </>
      ) : (
        <span className="text-xs text-slate-500 italic">{emptyLabel}</span>
      )}
    </div>
  );
};
