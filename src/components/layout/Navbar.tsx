import React from 'react';
import {
  Swords,
  Settings,
  Search,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Globe,
  Trophy,
  Flame,
  Zap,
  Coins,
  Crosshair,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import { PlayerProfileSummary } from '../../types/dota';
import { getRankTierInfo } from '../../constants/ranks';
import { formatPercent } from '../../utils/dotaFormatters';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

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
}

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
}) => {
  const { language, setLanguage, t } = useLanguage();
  const rankInfo = profile ? getRankTierInfo(profile.seasonRank, profile.leaderboardRank) : null;

  const toggleLanguage = () => {
    setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR');
  };

  // Recent 10 games deep aggregated stats
  const recent10 = profile?.recentMatches.slice(0, 10) || [];
  const recentWins = recent10.filter((m) => m.isVictory).length;
  const recentLosses = recent10.length - recentWins;
  const recentWinRate = recent10.length > 0 ? Math.round((recentWins / recent10.length) * 100) : 0;

  const avgImp10 = recent10.length > 0
    ? Math.round(recent10.reduce((sum, m) => sum + (m.imp || 0), 0) / recent10.length)
    : 0;

  const avgKills10 = recent10.length > 0
    ? (recent10.reduce((sum, m) => sum + (m.kills || 0), 0) / recent10.length).toFixed(1)
    : '0';

  const avgDeaths10 = recent10.length > 0
    ? (recent10.reduce((sum, m) => sum + (m.deaths || 0), 0) / recent10.length).toFixed(1)
    : '0';

  const avgAssists10 = recent10.length > 0
    ? (recent10.reduce((sum, m) => sum + (m.assists || 0), 0) / recent10.length).toFixed(1)
    : '0';

  const avgGpm10 = recent10.length > 0
    ? Math.round(recent10.reduce((sum, m) => sum + (m.goldPerMinute || 0), 0) / recent10.length)
    : 0;

  const avgKdaRatio = recent10.length > 0
    ? (
        (recent10.reduce((sum, m) => sum + (m.kills || 0) + (m.assists || 0), 0) /
          Math.max(1, recent10.reduce((sum, m) => sum + (m.deaths || 0), 0)))
      ).toFixed(2)
    : '0';

  return (
    <header className="border-b border-slate-800/80 bg-[#080c14]/95 backdrop-blur-md px-4 sm:px-6 py-2 sticky top-0 z-40">
      <div className="w-full max-w-[1850px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left Side: Brand Logo + Integrated Profile Info */}
        <div className="flex items-center gap-3">
          {/* Brand & Logo */}
          <div
            onClick={onGoHome}
            className="flex items-center gap-2.5 cursor-pointer group select-none transition-all transform active:scale-95 shrink-0"
            title="GlimpseGG Home"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950 flex items-center justify-center shadow-md shadow-cyan-950/50 border border-cyan-500/40 group-hover:border-cyan-400 group-hover:scale-105 transition duration-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-500/10 rounded-xl blur-[2px]" />
              <svg className="w-4.5 h-4.5 relative z-10 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {/* Temporal rewind loop forming dynamic G with aperture */}
                <path d="M12 2a10 10 0 1 0 10 10c0-2.5-1-4.8-2.5-6.5L16 9" className="stroke-cyan-400" />
                <path d="M22 2v7h-7" className="stroke-cyan-300" />
                <circle cx="12" cy="12" r="3" className="stroke-violet-400 fill-violet-950/40" />
                <circle cx="12" cy="12" r="1" className="fill-white" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-wider text-sm sm:text-base text-white group-hover:text-cyan-200 transition font-sans flex items-center gap-0.5">
                  <span>GLIMPSE</span>
                  <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">GG</span>
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                  7.38c
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Profile Info in Topbar */}
          {profile && rankInfo && (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
              {/* Quick Return to Configured Account Icon Button (placed BEFORE avatar) */}
              {isViewingDifferentAccount && onReturnToConfiguredAccount && (
                <button
                  onClick={onReturnToConfiguredAccount}
                  className="p-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-500/40 transition shadow-sm shrink-0"
                  title={`${t('returnToConfigured')}: ${configuredProfileName || configuredSteamId}`}
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              )}

              {/* Avatar */}
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

              {/* Player Name & Medal */}
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">{profile.name}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.2 rounded border"
                    style={{
                      backgroundColor: `${rankInfo.color}15`,
                      borderColor: `${rankInfo.color}40`,
                      color: rankInfo.color,
                    }}
                  >
                    {rankInfo.fullName}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400 font-semibold">~{rankInfo.approxMmr.toLocaleString()} MMR</span>
                  <span>•</span>
                  <span>ID: {profile.steamAccountId}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Rich Live Tactical Badges (Form, IMP, KDA, GPM, Career Record) */}
        {profile && (
          <div className="hidden xl:flex items-center gap-2.5 text-xs font-mono">
            {/* 1. Forma Recente (10J) */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800"
              title="Histórico dos últimos 10 jogos"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-slate-400">Recente (10J):</span>
              <span className="text-emerald-400 font-bold">{recentWins}V</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-400 font-bold">{recentLosses}D</span>
              <span className="text-amber-400 font-bold">({recentWinRate}%)</span>
            </div>

            {/* 2. IMP Rating Médio */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800"
              title="Média de impacto individual nos últimos jogos"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">IMP:</span>
              <span className={`font-bold ${avgImp10 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {avgImp10 >= 0 ? `+${avgImp10}` : avgImp10}
              </span>
            </div>

            {/* 3. KDA Médio */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800"
              title={`Média K/D/A: ${avgKills10} / ${avgDeaths10} / ${avgAssists10}`}
            >
              <Crosshair className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-400">KDA:</span>
              <span className="text-teal-300 font-bold">{avgKdaRatio}</span>
              <span className="text-slate-500 text-[11px]">({avgKills10}/{avgDeaths10}/{avgAssists10})</span>
            </div>

            {/* 4. GPM Médio */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800"
              title="Média de Ouro por Minuto nos últimos jogos"
            >
              <Coins className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-slate-400">Farm:</span>
              <span className="text-yellow-300 font-bold">{avgGpm10} GPM</span>
            </div>

            {/* 5. Carreira e Vitórias Totais */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800"
              title="Taxa de vitória geral na carreira"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Carreira:</span>
              <span className="text-emerald-400 font-bold">{formatPercent(profile.winRate)}</span>
              <span className="text-slate-500">({profile.totalMatches.toLocaleString()} Jogos)</span>
            </div>
          </div>
        )}

        {/* Right Side: Search Modal Trigger, Language, Status, Refresh & Settings */}
        <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0">
          {/* Search Player Modal Trigger Button (with icon + localized word) */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-xs font-semibold"
            title={`${t('searchBtn')} (${t('searchShortcut')})`}
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('searchBtn')}</span>
          </button>

          {/* Language Switcher Quick Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white border border-slate-700/60 transition"
            title={language === 'pt-BR' ? 'Mudar para Inglês (EN-US)' : 'Switch to Portuguese (PT-BR)'}
          >
            <Globe className="w-3 h-3 text-amber-400" />
            <span className="text-[10px]">{language === 'pt-BR' ? 'PT' : 'EN'}</span>
          </button>

          {/* API Status Badge */}
          <div
            onClick={onOpenSettings}
            className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border transition hover:opacity-85"
            style={{
              backgroundColor: hasApiKey ? 'rgba(52, 211, 153, 0.08)' : 'rgba(251, 191, 36, 0.08)',
              borderColor: hasApiKey ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)',
              color: hasApiKey ? '#34d399' : '#fbbf24',
            }}
            title={hasApiKey ? 'STRATZ API Token Active' : 'Running with Demo dataset'}
          >
            {hasApiKey ? <CheckCircle2 className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
            <span className="hidden sm:inline">{hasApiKey ? 'Live' : t('stratzDemo')}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
            title={t('settings')}
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
