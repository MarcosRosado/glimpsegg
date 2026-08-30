import React from 'react';
import { Zap, Star, Skull } from 'lucide-react';
import {
  getImpBadgeStyle,
  getImpIconKind,
  formatImp,
  type ImpIconKind,
} from '../../utils/dotaFormatters';

/**
 * O chip de IMP, em um lugar so.
 *
 * A marcacao estava duplicada na lista de partidas e no scoreboard, com sinal montado
 * na mao (`imp >= 0 ? '+' + imp : imp`) nos dois. Centralizar era pre-requisito para o
 * destaque de extremo aparecer nos dois sem alguem esquecer um.
 *
 * No extremo (|IMP| >= 50) mudam a cor (magenta, fora da escala verde/vermelha), o icone
 * e o simbolo no texto — tres sinais ao mesmo tempo, para o destaque sobreviver a
 * daltonismo e a captura em preto e branco.
 */
const ICONS: Record<ImpIconKind, typeof Zap> = {
  STAR: Star,
  SKULL: Skull,
  ZAP: Zap,
};

export const ImpBadge: React.FC<{
  imp: number;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ imp, size = 'md', className = '' }) => {
  const style = getImpBadgeStyle(imp);
  const kind = getImpIconKind(imp);
  const Icon = ICONS[kind];
  const small = size === 'sm';

  // `fill-current` SO na estrela. A estrela e uma silhueta macica e ganha peso quando
  // preenchida; a caveira tem olhos, nariz e dentes VAZADOS, e preencher apaga os
  // vazados — sobra um contorno arredondado que se le como lampada, nao como caveira.
  // Ela fica de traco, mais grosso e um pouco maior, que e o que sustenta a silhueta
  // nos 12-14px do chip.
  const isSkull = kind === 'SKULL';
  const iconSize = isSkull
    ? small
      ? 'w-3.5 h-3.5'
      : 'w-4 h-4'
    : small
      ? 'w-3 h-3'
      : 'w-3.5 h-3.5';

  return (
    <div
      className={`inline-flex items-center gap-1 border font-black leading-none ${
        small ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-3 py-1 rounded-xl text-xs shadow-md'
      } ${style.bg} ${style.text} ${style.border} ${
        kind === 'ZAP' ? '' : 'ring-1 ring-fuchsia-400/40'
      } ${className}`}
    >
      <Icon
        className={`shrink-0 ${iconSize} ${kind === 'STAR' ? 'fill-current' : ''}`}
        strokeWidth={isSkull ? 2.5 : undefined}
        aria-hidden
      />
      {/* `leading-none`: com a altura de linha padrao, a caixa do texto fica mais alta que
          o glifo, e `items-center` centraliza a CAIXA — o numero sobe alguns pixels em
          relacao ao icone. Zerando a entrelinha, glifo e icone centralizam juntos. */}
      <span className="leading-none">{formatImp(imp)}</span>
    </div>
  );
};
