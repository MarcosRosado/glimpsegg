import React from 'react';
import { Hourglass } from 'lucide-react';
import { useGamePatch } from '../../hooks/useGamePatch';
import { useLanguage } from '../../context/LanguageContext';
import { getPatchTransition } from '../../utils/patchTransition';

interface PatchTransitionNoticeProps {
  /** `chip` cabe numa faixa de uma linha; `banner` traz o texto inteiro. */
  variant: 'chip' | 'banner';
}

/**
 * Aviso TEMPORARIO de que os agregados de meta ainda misturam o patch anterior.
 *
 * Nao renderiza nada fora da janela definida em `PATCH_TRANSITION`
 * (constants/gameVersion.ts) — é la que a transicao liga e desliga, nao aqui.
 */
export const PatchTransitionNotice: React.FC<PatchTransitionNoticeProps> = ({ variant }) => {
  const { t } = useLanguage();
  const { patch } = useGamePatch();
  const transition = getPatchTransition(patch);

  if (!transition) return null;

  if (variant === 'chip') {
    return (
      <span
        title={t('patchTransitionBody', { patch: transition })}
        className="inline-flex items-center gap-1 shrink-0 px-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300"
      >
        <Hourglass className="w-3 h-3" />
        {t('patchTransitionChip')}
      </span>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
      <Hourglass className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div>
        <h4 className="text-xs font-bold text-amber-200 mb-1">
          {t('patchTransitionTitle', { patch: transition })}
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('patchTransitionBody', { patch: transition })}
        </p>
      </div>
    </div>
  );
};
