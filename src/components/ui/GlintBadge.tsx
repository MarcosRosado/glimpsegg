import React from 'react';
import { Zap, Star, Skull } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  GLINT_MODEL,
  GLINT_MEDIAN,
  formatGlint,
  getGlintBadgeStyle,
  getGlintIconKind,
  type GlintIconKind,
} from '../../utils/glint';

/**
 * O chip do Glint, em um lugar so — substitui o `ImpBadge` desde que a STRATZ saiu.
 *
 * A nota é EXPERIMENTAL (`utils/glint.ts`), e isso faz parte do chip, nao de quem o usa:
 * o `title` explica o que ela é e traz as metricas da conferencia, e o tamanho `md` mostra o
 * selo "beta" ao lado do numero. Quem renderiza nao consegue exibir a nota sem a
 * procedencia. `glint` nulo ou ausente nao renderiza nada — nunca "0".
 */
const ICONS: Record<GlintIconKind, typeof Zap> = { STAR: Star, SKULL: Skull, ZAP: Zap };

/**
 * Os numeros do tooltip, tirados do proprio modelo: mudam sozinhos a cada reajuste. O ρ é o da
 * LISTA (nota sem posicao), o mais fraco dos dois — o mesmo criterio conservador de antes, que
 * citava o "sem papel". É conferencia interna, nao a medida oficial (ver `utils/glint.ts`), e o
 * texto diz "ainda em ajuste" por isso.
 */
export function useGlintHint(): string {
  const { t, language } = useLanguage();
  const fmt = (n: number) => n.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t('glintHint', {
    rho: fmt(GLINT_MODEL.check.teamRhoList),
    kda: fmt(GLINT_MODEL.check.teamRhoKda),
    matches: GLINT_MODEL.check.matches,
    center: GLINT_MEDIAN,
  });
}

export const GlintBadge: React.FC<{
  glint: number | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ glint, size = 'md', className = '' }) => {
  const { t } = useLanguage();
  const hint = useGlintHint();
  if (typeof glint !== 'number') return null;
  const style = getGlintBadgeStyle(glint);
  const kind = getGlintIconKind(glint);
  const Icon = ICONS[kind];
  const small = size === 'sm';
  // Caveira so de traco, mais grossa: preenchida ela perde os vazados e vira um borrao.
  const isSkull = kind === 'SKULL';
  const iconSize = isSkull ? (small ? 'w-3.5 h-3.5' : 'w-4 h-4') : small ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div
      title={hint}
      aria-label={`${t('glintExperimental')}: ${formatGlint(glint)}`}
      className={`inline-flex items-center gap-1 border font-black leading-none cursor-help ${
        small ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-3 py-1 rounded-xl text-xs shadow-md'
      } ${style.bg} ${style.text} ${style.border} ${kind === 'ZAP' ? '' : 'ring-1 ring-fuchsia-400/40'} ${className}`}
    >
      <Icon
        className={`shrink-0 ${iconSize} ${kind === 'STAR' ? 'fill-current' : ''}`}
        strokeWidth={isSkull ? 2.5 : undefined}
        aria-hidden
      />
      <span className="leading-none">{formatGlint(glint)}</span>
      {!small && (
        <span className="leading-none text-[8px] font-bold uppercase tracking-wider opacity-60">{t('glintBeta')}</span>
      )}
    </div>
  );
};
