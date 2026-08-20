import React from 'react';

/**
 * Wordmark GLIMPSE + GG. Antes duplicado no Navbar e no splash do App.
 */
interface BrandLockupProps {
  /** Classes do wrapper — use para tamanho e peso do texto. */
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ className }) => (
  <span className={className}>
    <span>GLIMPSE</span>
    <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
      GG
    </span>
  </span>
);
