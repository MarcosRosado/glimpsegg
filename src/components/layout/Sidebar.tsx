import React, { useEffect, useState } from 'react';
import {
  Home,
  ListOrdered,
  Swords,
  UserCircle2,
  LayoutGrid,
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { cn } from '../../utils/cn';
import { BrandMark } from '../brand/BrandMark';
import { BrandLockup } from '../brand/BrandLockup';

/**
 * As seções da moldura da 2.0 (docs/PROPOSTA-V2.md §3.1, decisão do dono: barra lateral que
 * recolhe em trilho — opção C dos wireframes).
 *
 * `HERO_GRID` agrupa o painel e a réplica do layout espelho: as duas telas são da mesma
 * feature, e a entrada lateral só existe com ela ligada.
 */
export type AppSection = 'HOME' | 'MATCHES' | 'HEROES' | 'ACCOUNT' | 'HERO_GRID';

const ITEMS: { id: Exclude<AppSection, 'HERO_GRID'>; icon: LucideIcon; label: TranslationKey }[] = [
  { id: 'HOME', icon: Home, label: 'navHome' },
  { id: 'MATCHES', icon: ListOrdered, label: 'navMatches' },
  { id: 'HEROES', icon: Swords, label: 'navHeroes' },
  { id: 'ACCOUNT', icon: UserCircle2, label: 'navAccount' },
];

/** Chave do caminho browser. No Electron, a mesma preferência vai para o config (`sidebarCollapsed`). */
const LOCAL_KEY = 'glimpsegg_sidebar_collapsed';
const STORE_KEY = 'sidebarCollapsed';

/** Abaixo disto a barra recolhe sozinha: espremer o placar de 10 jogadores é pior que esconder rótulo. */
const NARROW_QUERY = '(max-width: 1023px)';

/**
 * Preferência de barra recolhida, persistida. Ler ou gravar pode falhar (janela privada,
 * store indisponível) e isso nunca impede a barra de funcionar: ela só não lembra.
 */
function useCollapsedPreference(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (window.api?.store?.get) {
          const v = await window.api.store.get(STORE_KEY);
          if (alive && typeof v === 'boolean') setCollapsed(v);
        } else {
          const v = localStorage.getItem(LOCAL_KEY);
          if (alive && v !== null) setCollapsed(v === '1');
        }
      } catch {
        /* sem preferência salva: começa aberta */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const update = (v: boolean) => {
    setCollapsed(v);
    try {
      if (window.api?.store?.set) void window.api.store.set(STORE_KEY, v).catch(() => undefined);
      else localStorage.setItem(LOCAL_KEY, v ? '1' : '0');
    } catch {
      /* não lembra, mas funciona */
    }
  };

  return [collapsed, update];
}

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/**
 * Um item da barra. Componente de topo de módulo de propósito: declarado dentro da `Sidebar`
 * ele seria um tipo novo a cada render, o React remontaria o botão e o foco de teclado se
 * perderia ao trocar de seção.
 */
const NavButton: React.FC<{
  id: AppSection;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate: (section: AppSection) => void;
  disabled?: boolean;
  hint?: string;
}> = ({ id, icon: Icon, label, active, collapsed, onNavigate, disabled, hint }) => (
  <button
    type="button"
    onClick={() => onNavigate(id)}
    disabled={disabled}
    title={hint ?? (collapsed ? label : undefined)}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex items-center gap-3 rounded-lg border text-sm font-semibold transition',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      collapsed ? 'w-10 h-10 justify-center mx-auto' : 'w-full px-3 py-2',
      active
        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
        : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
    )}
  >
    <Icon className="w-4 h-4 shrink-0" aria-hidden />
    {!collapsed && <span className="truncate">{label}</span>}
  </button>
);

interface SidebarProps {
  section: AppSection;
  onNavigate: (section: AppSection) => void;
  heroGridEnabled: boolean;
  /** Vendo outra conta, a entrada do hero grid fica desativada com o motivo — não some. */
  heroGridDisabledReason?: string | null;
  /**
   * Seções que ainda não têm o que mostrar e por isso não entram na barra. Seção sem dado
   * some (§1 da proposta) — inclusive da navegação, em vez de abrir uma casca vazia.
   */
  hiddenSections?: AppSection[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  section,
  onNavigate,
  heroGridEnabled,
  heroGridDisabledReason,
  hiddenSections = [],
}) => {
  const { t } = useLanguage();
  const [userCollapsed, setUserCollapsed] = useCollapsedPreference();
  const narrow = useIsNarrow();
  // Janela estreita recolhe sem gravar preferência: alargar de novo devolve o que a pessoa escolheu.
  const collapsed = userCollapsed || narrow;

  return (
    <nav
      aria-label={t('navLabel')}
      className={cn(
        'sticky top-0 h-screen shrink-0 flex flex-col gap-1 border-r border-slate-800/80 bg-[#080c14] py-3 transition-[width] duration-150',
        collapsed ? 'w-16 px-0' : 'w-52 px-2.5',
      )}
    >
      <button
        type="button"
        onClick={() => onNavigate('HOME')}
        title={t('homeTooltip')}
        aria-label={t('homeTooltip')}
        className={cn('flex items-center gap-2.5 mb-4 group select-none', collapsed ? 'mx-auto' : 'px-1.5')}
      >
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950 flex items-center justify-center border border-cyan-500/40 group-hover:border-cyan-400 transition shrink-0">
          <BrandMark className="w-4 h-4 text-cyan-400" />
        </span>
        {!collapsed && (
          <BrandLockup className="flex items-center gap-0.5 font-black tracking-wider text-sm text-white" />
        )}
      </button>

      {ITEMS.filter((it) => !hiddenSections.includes(it.id)).map((it) => (
        <NavButton
          key={it.id}
          id={it.id}
          icon={it.icon}
          label={t(it.label)}
          active={section === it.id}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}

      {heroGridEnabled && (
        <>
          <div className={cn('border-t border-slate-800 my-2', collapsed ? 'mx-3' : 'mx-1')} />
          <NavButton
            active={section === 'HERO_GRID'}
            collapsed={collapsed}
            onNavigate={onNavigate}
            id="HERO_GRID"
            icon={LayoutGrid}
            // "Sincronização do grid" não cabe na barra e aparecia cortado; o título da tela fica.
            label={t('navHeroGrid')}
            disabled={!!heroGridDisabledReason}
            hint={heroGridDisabledReason ? `${t('navHeroGrid')}: ${heroGridDisabledReason}` : undefined}
          />
        </>
      )}

      {/* Sem botão em janela estreita: lá a barra está recolhida por largura, e o botão
          prometeria abrir algo que a largura fecharia de novo. */}
      {!narrow && (
        <button
          type="button"
          onClick={() => setUserCollapsed(!userCollapsed)}
          title={collapsed ? t('navExpand') : t('navCollapse')}
          aria-label={collapsed ? t('navExpand') : t('navCollapse')}
          aria-expanded={!collapsed}
          className={cn(
            'mt-auto flex items-center gap-2 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition',
            collapsed ? 'w-10 h-10 justify-center mx-auto' : 'px-3 py-2',
          )}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          {!collapsed && <span>{t('navCollapse')}</span>}
        </button>
      )}
    </nav>
  );
};
