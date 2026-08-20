import React from 'react';

/**
 * Monograma da marca: o "G" como fita temporal, varrido no anti-horário (rewind).
 *
 * Contrapartida do ícone de app em `build/icon.svg` — alterar um exige revisar o
 * outro. Não é derivado dele: a grade de 24px pede stroke de espessura constante,
 * enquanto o master de 512px usa um path preenchido com afunilamento real.
 *
 * Monocromático de propósito. O master usa um gradiente ciano→violeta, mas aqui
 * `currentColor` deixa o consumidor colorir via Tailwind e evita colisão de `id`
 * de gradiente quando há várias instâncias no DOM.
 */
interface BrandMarkProps {
  className?: string;
  strokeWidth?: number;
  /** Quando ausente, o SVG é decorativo e sai do fluxo de leitores de tela. */
  title?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  className,
  strokeWidth = 2.2,
  title,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    className={className}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title ? <title>{title}</title> : null}
    {/* Arco de 320°, de θ=40° até θ=0°, no sentido anti-horário. */}
    <path d="M 16.9 7.89 A 6.4 6.4 0 1 0 18.4 12" />
    {/* Barra do G, entrando por dentro. */}
    <path d="M 18.4 12 L 13.4 12" />
    {/* Núcleo: ponto focal, ecoando o do master. */}
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
