import React from 'react';
import { Settings, Search, RefreshCw, ArrowLeft } from 'lucide-react';
import { PlayerProfileSummary } from '../../types/dota';
import { getRankTierInfo } from '../../constants/ranks';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { useGamePatch } from '../../hooks/useGamePatch';
import { IconButton } from '../ui/IconButton';
import { EstimateChip } from '../ui/EstimateChip';
import { PatchTransitionNotice } from '../ui/PatchTransitionNotice';

interface NavbarProps {
  profile: PlayerProfileSummary | null;
  isLoading: boolean;
  isViewingDifferentAccount?: boolean;
  configuredSteamId?: string;
  configuredProfileName?: string;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onReturnToConfiguredAccount?: () => void;
  onRefresh: () => void;
}

/**
 * Topo da moldura da 2.0: conta, patch, busca e ações. Nada além disso.
 *
 * A marca e a navegação foram para a `Sidebar`, e a antiga segunda faixa (`StatRail`: forma,
 * Glint, KDA, GPM) virou o cartão "Forma" do Início — docs/PROPOSTA-V2.md §3.1: "menos ruído
 * nas outras telas". O patch ficou aqui porque vale para todas as telas.
 */
export const Navbar: React.FC<NavbarProps> = ({
  profile,
  isLoading,
  isViewingDifferentAccount = false,
  configuredSteamId,
  configuredProfileName,
  onOpenSettings,
  onOpenSearch,
  onReturnToConfiguredAccount,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const { patch } = useGamePatch();
  const rankInfo = profile ? getRankTierInfo(profile.seasonRank, profile.leaderboardRank) : null;

  return (
    <header className="sticky top-0 z-40 bg-[#080c14]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="w-full px-4 sm:px-6 h-12 flex items-center gap-3">
        {/* `min-w-0` é o que permite o nome truncar em vez de empurrar as ações para fora. */}
        {profile && rankInfo && (
          <div className="flex items-center gap-2.5 min-w-0">
            {isViewingDifferentAccount && onReturnToConfiguredAccount && (
              <IconButton
                icon={ArrowLeft}
                label={`${t('returnToConfigured')}: ${configuredProfileName || configuredSteamId}`}
                onClick={onReturnToConfiguredAccount}
                variant="accent"
                className="p-1"
                iconClassName="w-3.5 h-3.5 text-cyan-400"
              />
            )}

            <div className="relative shrink-0">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-7 h-7 rounded-lg border border-slate-700 object-cover shadow-sm"
                onError={handleAvatarError}
              />
              {profile.leaderboardRank && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black px-1 rounded-full">
                  #{profile.leaderboardRank}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs font-black text-white truncate max-w-[9rem]"
                title={`${profile.name} · ID ${profile.steamAccountId}`}
              >
                {profile.name}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-[1px] rounded border shrink-0"
                style={{
                  backgroundColor: `${rankInfo.color}15`,
                  borderColor: `${rankInfo.color}40`,
                  color: rankInfo.color,
                }}
              >
                {rankInfo.fullName}
              </span>
              {/* O MMR sai da medalha por tabela fixa (`constants/ranks.ts`), não de medida:
                  tem de vir rotulado como estimativa. */}
              <span className="hidden md:inline-flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono text-amber-400/90 tabular-nums">
                  ~{rankInfo.approxMmr.toLocaleString()} MMR
                </span>
                <EstimateChip hint={t('mmrEstimateHint')} />
              </span>
            </div>
          </div>
        )}

        <div
          className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 shrink-0 pl-3 border-l border-slate-800"
          title={`${t('gamePatchTooltip')} (${patch})`}
        >
          <span className="text-slate-500">{t('gamePatch')}</span>
          <span className="text-slate-300 font-semibold tabular-nums">{patch}</span>
          <PatchTransitionNotice variant="chip" />
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Parece campo e abre a busca: aceita conta OU id de partida (Ctrl+K). */}
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={`${t('searchBarPlaceholder')} (${t('searchShortcut')})`}
            className="hidden md:flex items-center gap-6 rounded-lg border border-slate-700/70 bg-slate-900/60 hover:border-slate-600 px-3 py-1.5 text-xs text-slate-500 transition"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-cyan-400" aria-hidden />
              {t('searchBarPlaceholder')}
            </span>
            <kbd className="text-[10px] font-mono text-slate-500">{t('searchShortcut')}</kbd>
          </button>
          <IconButton
            icon={Search}
            label={`${t('searchBarPlaceholder')} (${t('searchShortcut')})`}
            onClick={onOpenSearch}
            className="md:hidden"
            iconClassName="text-cyan-400"
          />

          <IconButton
            icon={RefreshCw}
            label={t('refresh')}
            onClick={onRefresh}
            disabled={isLoading}
            iconClassName={isLoading ? 'animate-spin text-amber-400' : undefined}
          />

          <IconButton icon={Settings} label={t('settings')} onClick={onOpenSettings} />
        </div>
      </div>
    </header>
  );
};
