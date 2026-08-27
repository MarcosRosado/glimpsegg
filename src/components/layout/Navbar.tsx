import React from 'react';
import { Settings, Search, ShieldAlert, RefreshCw, ArrowLeft, LayoutGrid } from 'lucide-react';
import { PlayerProfileSummary } from '../../types/dota';
import { getRankTierInfo } from '../../constants/ranks';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { BrandMark } from '../brand/BrandMark';
import { BrandLockup } from '../brand/BrandLockup';
import { IconButton } from '../ui/IconButton';
import { StatRail } from './StatRail';

interface NavbarProps {
  profile: PlayerProfileSummary | null;
  hasApiKey: boolean;
  isLoading: boolean;
  isViewingDifferentAccount?: boolean;
  configuredSteamId?: string;
  configuredProfileName?: string;
  onGoHome: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onReturnToConfiguredAccount?: () => void;
  onRefresh: () => void;
  /** T036: o acesso a aba do layout espelho existe SO com a feature ativa. */
  heroGridEnabled?: boolean;
  isHeroGridOpen?: boolean;
  onToggleHeroGrid?: () => void;
}

/**
 * Topbar em duas faixas de hierarquia distinta:
 *   faixa 1 (h-11) chrome  — marca, identidade do jogador, ações
 *   faixa 2 (h-7)  contexto — StatRail com as métricas
 *
 * As duas vivem no MESMO container sticky de propósito: como faixas irmãs, a
 * segunda precisaria de um `top-[48px]` acoplado à altura da primeira.
 */
export const Navbar: React.FC<NavbarProps> = ({
  profile,
  hasApiKey,
  isLoading,
  isViewingDifferentAccount = false,
  configuredSteamId,
  configuredProfileName,
  onGoHome,
  onOpenSettings,
  onOpenSearch,
  onReturnToConfiguredAccount,
  onRefresh,
  heroGridEnabled = false,
  isHeroGridOpen = false,
  onToggleHeroGrid,
}) => {
  const { t } = useLanguage();
  const rankInfo = profile ? getRankTierInfo(profile.seasonRank, profile.leaderboardRank) : null;

  return (
    <header className="sticky top-0 z-40 bg-[#080c14]/95 backdrop-blur-md border-b border-slate-800/80">
      {/* ---------------------------------------------------------- faixa 1 */}
      <div className="w-full max-w-[1850px] mx-auto px-4 sm:px-6 h-11 flex items-center gap-3">
        {/* `min-w-0` é o que permite o nome truncar em vez de empurrar as ações
            para fora da tela. */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onGoHome}
            title={t('homeTooltip')}
            aria-label={t('homeTooltip')}
            className="flex items-center gap-2.5 cursor-pointer group select-none transition-all transform active:scale-95 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950 flex items-center justify-center shadow-md shadow-cyan-950/50 border border-cyan-500/40 group-hover:border-cyan-400 group-hover:scale-105 transition duration-200">
              <BrandMark className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
            </div>
            <BrandLockup className="hidden sm:flex items-center gap-0.5 font-black tracking-wider text-sm text-white group-hover:text-cyan-200 transition font-sans" />
          </button>

          {profile && rankInfo && (
            <div className="flex items-center gap-2.5 min-w-0 pl-3 border-l border-slate-800">
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

              {/* Uma linha só. Era o MMR numa segunda linha que fazia o topbar
                  crescer; trazê-lo para cá é o que paga a faixa 2. */}
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
                <span className="hidden md:inline text-[10px] font-mono text-amber-400/90 tabular-nums shrink-0">
                  ~{rankInfo.approxMmr.toLocaleString()} MMR
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Status só fala quando pede ação: no happy path ficava um pill "Live"
              que não pedia nada de ninguém. */}
          {!hasApiKey && (
            <button
              onClick={onOpenSettings}
              title={t('apiKeyMissing')}
              aria-label={t('apiKeyMissing')}
              className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition"
            >
              <ShieldAlert className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">{t('stratzDemo')}</span>
            </button>
          )}

          {/* Layout espelho de heróis. Renderizado só com a feature ativa: um botão
              permanente para algo desligado por padrão só ensinaria a ignorá-lo. */}
          {heroGridEnabled && onToggleHeroGrid && (
            <IconButton
              icon={LayoutGrid}
              label={t('heroGridTabTitle')}
              onClick={onToggleHeroGrid}
              variant={isHeroGridOpen ? 'accent' : undefined}
              className="p-1.5"
              iconClassName={`w-3.5 h-3.5 ${isHeroGridOpen ? 'text-cyan-300' : 'text-slate-400'}`}
            />
          )}

          {/* O atalho global já existe (App.tsx); mostrá-lo ensina, o label não. */}
          <IconButton
            icon={Search}
            label={`${t('searchBtn')} (${t('searchShortcut')})`}
            onClick={onOpenSearch}
            iconClassName="text-cyan-400"
          >
            <kbd className="hidden md:inline text-[10px] font-mono text-slate-500">
              {t('searchShortcut')}
            </kbd>
          </IconButton>

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

      {/* ---------------------------------------------------------- faixa 2 */}
      {profile && <StatRail profile={profile} />}
    </header>
  );
};
