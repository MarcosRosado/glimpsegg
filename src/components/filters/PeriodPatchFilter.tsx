import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PatchWindow, PlayerMatchFilters } from '../../types/dota';
import { fetchPatchCatalog, patchWindows } from '../../services/openDotaProfile';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { cn } from '../../utils/cn';

/** Janelas de período do filtro. `null` = tudo. */
export type PeriodDays = 30 | 90 | 365 | null;

const PERIODS: { days: PeriodDays; label: TranslationKey }[] = [
  { days: 30, label: 'period30d' },
  { days: 90, label: 'period3m' },
  { days: 365, label: 'period1y' },
  { days: null, label: 'periodAll' },
];

/**
 * Catálogo de patches para o filtro. O serviço guarda cache de 7 dias; falha deixa a lista
 * vazia e o seletor de patch simplesmente não aparece.
 */
export function usePatchWindows(): PatchWindow[] {
  const [windows, setWindows] = useState<PatchWindow[]>([]);
  useEffect(() => {
    let alive = true;
    void fetchPatchCatalog().then((catalog) => {
      if (alive && catalog) setWindows(patchWindows(catalog));
    });
    return () => {
      alive = false;
    };
  }, []);
  return windows;
}

/** Junta período e patch no formato que os serviços pedem. */
export function toMatchFilters(days: PeriodDays, patch: PatchWindow | null): PlayerMatchFilters {
  return { ...(days ? { days } : {}), ...(patch ? { patch } : {}) };
}

/**
 * Filtro de período e patch, compartilhado por Partidas e Heróis (docs/PROPOSTA-V2.md §3.3 e
 * §3.5). Só apresentação: quem monta guarda o estado e chama o serviço — o `?patch=` da
 * OpenDota não conhece o patch mais novo, e o serviço é quem sabe contornar isso.
 */
export const PeriodPatchFilter: React.FC<{
  days: PeriodDays;
  onDaysChange: (d: PeriodDays) => void;
  patch: PatchWindow | null;
  onPatchChange: (p: PatchWindow | null) => void;
  windows: PatchWindow[];
}> = ({ days, onDaysChange, patch, onPatchChange, windows }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label={t('periodLabel')} className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={days === p.days}
            onClick={() => onDaysChange(p.days)}
            className={cn(
              'px-3 py-1.5 rounded transition border',
              days === p.days
                ? 'bg-cyan-500/15 text-cyan-200 font-bold border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 border-transparent',
            )}
          >
            {t(p.label)}
          </button>
        ))}
      </div>

      {windows.length > 0 && (
        <label className="relative inline-flex items-center gap-2 text-xs text-slate-400">
          <span>{t('patchFilterLabel')}</span>
          <select
            value={patch ? String(patch.id) : ''}
            onChange={(e) => onPatchChange(windows.find((w) => String(w.id) === e.target.value) ?? null)}
            className="appearance-none rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-600 pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-cyan-500/60"
          >
            <option value="">{t('patchFilterAll')}</option>
            {windows.slice(0, 12).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none" aria-hidden />
        </label>
      )}
    </div>
  );
};
