import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Botão de ícone do chrome. A mesma string de classe estava repetida no Navbar
 * (3x) e no MatchHeader.
 *
 * O `aria-label` não é opcional aqui: os botões icon-only do app tinham só
 * `title`, então leitor de tela anunciava "botão" sem nome.
 */
interface IconButtonProps {
  icon: LucideIcon;
  /** Serve de tooltip e de nome acessível. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'accent';
  /** Classes extras para o ícone (ex. `animate-spin` no refresh). */
  iconClassName?: string;
  className?: string;
  /** Conteúdo adicional à direita do ícone, como o hint de atalho. */
  children?: React.ReactNode;
}

const VARIANTS = {
  default:
    'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/60',
  accent:
    'bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border-cyan-500/40',
} as const;

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
  iconClassName,
  className,
  children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={cn(
      'flex items-center gap-1.5 shrink-0 p-1.5 rounded-lg border transition',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      VARIANTS[variant],
      className,
    )}
  >
    <Icon className={cn('w-3.5 h-3.5', iconClassName)} />
    {children}
  </button>
);
