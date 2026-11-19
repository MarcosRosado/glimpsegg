import React from 'react';
import { Layers, User, Swords, Eye, Lightbulb, LucideIcon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { MatchTab } from '../../utils/navigation';
import { cn } from '../../utils/cn';

const TAB_META: Record<MatchTab, { icon: LucideIcon; label: TranslationKey }> = {
  SUMMARY: { icon: Layers, label: 'tabSummary' },
  MY_GAME: { icon: User, label: 'tabMyGame' },
  FIGHTS: { icon: Swords, label: 'tabFights' },
  VISION: { icon: Eye, label: 'tabVision' },
  COACHING: { icon: Lightbulb, label: 'tabCoaching' },
};

/**
 * A fileira de abas da partida ANALISADA: Resumo · Meu jogo · Lutas · Visão · Coaching
 * (docs/PROPOSTA-V2.md §3.4). Quem monta passa só as abas que têm o que mostrar — uma aba
 * sem dado não aparece desabilitada, ela simplesmente não está na lista.
 *
 * O seletor de jogador entra em `trailing`, fixo à direita, e vale para todas as abas.
 */
export const MatchTabs: React.FC<{
  tabs: MatchTab[];
  active: MatchTab;
  onChange: (tab: MatchTab) => void;
  trailing?: React.ReactNode;
}> = ({ tabs, active, onChange, trailing }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-2">
      <div role="tablist" aria-label={t('matchTabsLabel')} className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const { icon: Icon, label } = TAB_META[tab];
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tab)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition shrink-0',
                on
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
              )}
            >
              <Icon className="w-4 h-4" aria-hidden />
              <span>{t(label)}</span>
            </button>
          );
        })}
      </div>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
};
