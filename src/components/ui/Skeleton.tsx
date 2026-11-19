import React from 'react';
import { cn } from '../../utils/cn';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Bloco de carregamento com o formato do que vai chegar.
 *
 * O spinner centralizado ("Carregando…") deixava a tela vazia e depois empurrava tudo quando o
 * dado chegava. O skeleton reserva o espaço com a forma do conteúdo, então a troca não pula.
 * Só aparece na **primeira** carga: recarga com dado na tela segue o padrão `opacity-60`.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-md bg-slate-800/70 animate-pulse', className)} aria-hidden />
);

/**
 * Moldura de cartão com o anúncio para leitor de tela. O texto fica escondido da vista: quem vê
 * a forma do cartão já entende que está carregando.
 */
export const SkeletonCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const { t } = useLanguage();
  return (
    <div role="status" aria-busy className={cn('glass-card rounded-2xl border border-slate-800 bg-[#0f1624] p-5', className)}>
      <span className="sr-only">{t('matchesLoading')}</span>
      {children}
    </div>
  );
};

/** Linhas de lista (partida, herói): ícone, duas linhas de texto e números à direita. */
export const SkeletonRows: React.FC<{ rows?: number; avatar?: 'square' | 'wide'; className?: string }> = ({
  rows = 6,
  avatar = 'wide',
  className,
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className={avatar === 'wide' ? 'w-12 h-7 shrink-0' : 'w-8 h-8 shrink-0 rounded-lg'} />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
      </div>
    ))}
  </div>
);
