import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useLanguage } from '../../context/LanguageContext';

/**
 * A mensagem de "não carregou" dentro do cartão, com "tentar de novo".
 *
 * Cartão cuja chamada falhou sumia da tela: sem ele, a falha (o caso comum sob o limite de uso
 * da OpenDota) ficava igual a uma conta sem dado nenhum. O cartão fica, com o título, e diz que
 * faltou. Cartão que carregou e veio vazio é outra coisa e segue a regra de cada um.
 */
export const LoadErrorNotice: React.FC<{
  message: string;
  onRetry?: () => void;
  /** O novo pedido está em andamento: o botão gira e não aceita outro clique. */
  retrying?: boolean;
  className?: string;
}> = ({ message, onRetry, retrying = false, className }) => {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className={cn('flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200', className)}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-3 py-1.5 font-bold hover:bg-rose-500/20 disabled:opacity-60 shrink-0"
        >
          {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
          {t('parseRetryButton')}
        </button>
      )}
    </div>
  );
};

/** Cartão inteiro de falha: o título do cartão que não veio e a mensagem logo abaixo. */
export const LoadErrorCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}> = ({ title, icon, message, onRetry, retrying, className }) => (
  <section className={cn('glass-card rounded-2xl border border-slate-800 bg-[#0f1624] p-5 space-y-3', className)}>
    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
      {icon}
      {title}
    </h3>
    <LoadErrorNotice message={message} onRetry={onRetry} retrying={retrying} />
  </section>
);
