import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { BrandMark } from './components/brand/BrandMark';
import { BrandLockup } from './components/brand/BrandLockup';
import { StratzTrendsCard } from './components/dashboard/StratzTrendsCard';
import { StratzTeammatesCard } from './components/dashboard/StratzTeammatesCard';
import { RecentFormCard } from './components/dashboard/RecentFormCard';
import { MostPlayedHeroes } from './components/dashboard/MostPlayedHeroes';
import { MatchList } from './components/dashboard/MatchList';
import { ProfileHeader } from './components/dashboard/ProfileHeader';
import { ActivityHeatmap } from './components/dashboard/ActivityHeatmap';
import { PerformanceTrendChart } from './components/dashboard/PerformanceTrendChart';
import { MatchHeader } from './components/match/MatchHeader';
import { ScoreboardTable } from './components/match/ScoreboardTable';
import { AdvantageTimeline } from './components/match/AdvantageTimeline';
import { TeamOverviewCard } from './components/match/TeamOverviewCard';
import { PlayerPerformanceTab } from './components/performance/PlayerPerformanceTab';
import { WardMinimapTab } from './components/vision/WardMinimapTab';
import { CoachingInsightsTab } from './components/coaching/CoachingInsightsTab';
import { SettingsModal } from './components/settings/SettingsModal';
import { HeroGridTab } from './components/heroGrid/HeroGridTab';
import { SearchPlayerModal } from './components/search/SearchPlayerModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { MatchDetails, PlayerProfileSummary, ProfileHistoryItem } from './types/dota';
import { fetchMatchDetails, fetchPlayerProfile } from './services/stratzGql';
import { resolveSteamId } from './services/steamResolver';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
  Layers,
  Sparkles,
  BarChart2,
  Eye,
  Lightbulb,
  DownloadCloud,
} from 'lucide-react';

import { extractSteamIdFromStratzToken } from './utils/stratzToken';
import { useHeroGridSync } from './hooks/useHeroGridSync';

type MatchTab = 'OVERVIEW' | 'PERFORMANCE' | 'VISION' | 'COACHING';

function MainAppContent() {
  const { t } = useLanguage();
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [configuredSteamId, setConfiguredSteamId] = useState<string>('');
  const [currentSteamId, setCurrentSteamId] = useState<string>('');
  const [profile, setProfile] = useState<PlayerProfileSummary | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);
  const [selectedPlayerSlot, setSelectedPlayerSlot] = useState<number>(0);
  const [activeMatchTab, setActiveMatchTab] = useState<MatchTab>('OVERVIEW');
  /**
   * A aba do layout espelho é uma view de nivel de painel, nao uma aba de partida: ela nao
   * depende de partida selecionada nenhuma. Fica visivel so com a feature ativa (T036).
   */
  const [isHeroGridOpen, setIsHeroGridOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [onboardingMode, setOnboardingMode] = useState<'onboarding' | 'guide'>('onboarding');
  const [downloadedUpdateVersion, setDownloadedUpdateVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Clicar num heroi em "Mais Jogados" filtra a lista de partidas. Antes o
  // handler era um no-op e o clique nao fazia nada.
  const [heroFilterId, setHeroFilterId] = useState<number | null>(null);

  /**
   * UMA instancia de `useHeroGridSync` para todo o app.
   *
   * O hook arma o timer de 5 min e guarda a trava de escrita do renderer, entao duas
   * instancias seriam dois agendadores disputando a mesma sincronizacao. Ela é passada para
   * a aba (que exibe) e para o modal de configuracoes (que dispara) — nenhum dos dois chama
   * o hook por conta propria.
   */
  const heroGridSync = useHeroGridSync(
    apiKey,
    configuredSteamId,
    // `seasonRank` é medalha*10+estrelas; o bracket vem de floor(rank/10).
    profile?.seasonRank ? Math.floor(profile.seasonRank / 10) : null,
  );
  const heroGridEnabled = !!heroGridSync.preferences?.enabled;

  // Helper to persist profile history in store or localStorage
  const saveProfileHistory = useCallback(async (newHistory: ProfileHistoryItem[]) => {
    setProfileHistory(newHistory);
    if (window.api && typeof window.api.store?.set === 'function') {
      try {
        await window.api.store.set('profileHistory', newHistory);
      } catch (e) {
        console.warn('Could not save profileHistory to store:', e);
      }
    } else {
      localStorage.setItem('stratz_profile_history', JSON.stringify(newHistory));
    }
  }, []);

  // Upsert profile in history
  const upsertProfileHistory = useCallback(
    (profileData: PlayerProfileSummary) => {
      setProfileHistory((prevHistory) => {
        const id = profileData.steamAccountId;
        if (!id || id === '0') return prevHistory;

        const existing = prevHistory.find((p) => p.steamAccountId === id);
        const updatedItem: ProfileHistoryItem = {
          steamAccountId: id,
          steamId64: profileData.steamId64,
          name: profileData.name || existing?.name || `Player ${id}`,
          avatar: profileData.avatar || existing?.avatar || '',
          seasonRank: profileData.seasonRank ?? existing?.seasonRank,
          leaderboardRank: profileData.leaderboardRank ?? existing?.leaderboardRank,
          lastSearched: Date.now(),
          isFavorite: existing ? existing.isFavorite : false,
        };

        const filtered = prevHistory.filter((p) => p.steamAccountId !== id);
        const newHistory = [updatedItem, ...filtered].slice(0, 30);

        // Async save
        if (window.api && typeof window.api.store?.set === 'function') {
          window.api.store.set('profileHistory', newHistory).catch((err) => {
            console.warn('Failed saving profileHistory:', err);
          });
        } else {
          localStorage.setItem('stratz_profile_history', JSON.stringify(newHistory));
        }

        return newHistory;
      });
    },
    []
  );

  // Initialize config and history on mount
  useEffect(() => {
    async function init() {
      setIsAppInitializing(true);
      setIsLoading(true);
      let loadedApiKey = '';
      let loadedSteamId = '';
      let loadedHistory: ProfileHistoryItem[] = [];

      if (window.api && typeof window.api.store?.getAll === 'function') {
        try {
          const config = await window.api.store.getAll();
          if (config.stratzApiKey) loadedApiKey = config.stratzApiKey;
          if (config.steamAccountId) loadedSteamId = config.steamAccountId;
          if (Array.isArray(config.profileHistory)) loadedHistory = config.profileHistory;
        } catch (e) {
          console.warn('Could not load Electron store config:', e);
        }
      } else {
        // LocalStorage fallback
        const savedKey = localStorage.getItem('stratz_api_key');
        const savedSteam = localStorage.getItem('stratz_steam_id');
        const savedHistoryStr = localStorage.getItem('stratz_profile_history');
        if (savedKey) loadedApiKey = savedKey;
        if (savedSteam) loadedSteamId = savedSteam;
        if (savedHistoryStr) {
          try {
            const parsed = JSON.parse(savedHistoryStr);
            if (Array.isArray(parsed)) loadedHistory = parsed;
          } catch (e) {
            console.warn('Could not parse local profile history:', e);
          }
        }
      }

      setProfileHistory(loadedHistory);

      // If user has a token configured, attempt to load their account
      const cleanToken = (loadedApiKey || '').trim();
      if (cleanToken) {
        setApiKey(cleanToken);
        const resolvedSteamId = loadedSteamId.trim() || extractSteamIdFromStratzToken(cleanToken) || '';
        
        if (resolvedSteamId) {
          setConfiguredSteamId(resolvedSteamId);
          setCurrentSteamId(resolvedSteamId);

          try {
            const profileData = await fetchPlayerProfile(resolvedSteamId, cleanToken);
            if (profileData && profileData.steamAccountId) {
              setProfile(profileData);
              upsertProfileHistory(profileData);
              setIsOnboardingOpen(false);
              setIsAppInitializing(false);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.warn('Failed to load profile on startup:', err);
          }
        }
      }

      // If no token exists or token validation failed to fetch profile, open onboarding
      setIsOnboardingOpen(true);
      setOnboardingMode('onboarding');
      setProfile(null);
      setIsAppInitializing(false);
      setIsLoading(false);
    }

    init();
  }, [upsertProfileHistory]);

  // Auto updater status listener
  useEffect(() => {
    if (window.api?.updater?.onStatus) {
      const unsubscribe = window.api.updater.onStatus((data) => {
        if (data.status === 'downloaded' && data.version) {
          setDownloadedUpdateVersion(data.version);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Global shortcut: Ctrl+K / Cmd+K to open Search Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadProfileData = async (steamId: string, token: string) => {
    setIsLoading(true);
    try {
      const data = await fetchPlayerProfile(steamId, token);
      setProfile(data);
      if (data && data.steamAccountId && token) {
        upsertProfileHistory(data);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMatch = async (matchId: string) => {
    setIsLoading(true);
    try {
      const match = await fetchMatchDetails(matchId, apiKey);
      // `fetchMatchDetails` devolvia o dataset de demonstracao quando a API falhava,
      // entao este caminho nunca existia: a tela abria com a partida errada em vez de
      // avisar. Agora a falha é `null` e fica visivel.
      if (!match) {
        showToast(t('matchLoadError'));
        return;
      }
      setSelectedMatch(match);
      // Auto select the primary user player slot if found
      const userPlayer = match.players.find(
        (p) => p.steamAccountId === currentSteamId || p.steamAccountId === profile?.steamAccountId
      );
      setSelectedPlayerSlot(userPlayer ? userPlayer.playerSlot : match.players[0]?.playerSlot || 0);
      setActiveMatchTab('OVERVIEW');
    } catch (err) {
      console.error('Error loading match details:', err);
      showToast(t('matchLoadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSteamId = async (input: string) => {
    setIsLoading(true);
    try {
      const res = await resolveSteamId(input);
      if (res.success && res.steamAccountId) {
        setCurrentSteamId(res.steamAccountId);
        await loadProfileData(res.steamAccountId, apiKey);
        setSelectedMatch(null);
        showToast(t('profileLoaded', { name: res.personaname || res.steamAccountId }));
      } else {
        showToast(res.error || t('playerNotFound'));
      }
    } catch (err) {
      showToast(t('playerSearchError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProfileFromHistory = async (steamAccountId: string) => {
    if (steamAccountId === currentSteamId) return;
    setCurrentSteamId(steamAccountId);
    setSelectedMatch(null);
    await loadProfileData(steamAccountId, apiKey);
  };

  const handleToggleFavoriteProfile = (steamAccountId: string) => {
    const updated = profileHistory.map((p) =>
      p.steamAccountId === steamAccountId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    saveProfileHistory(updated);
  };

  const handleRemoveHistoryProfile = (steamAccountId: string) => {
    const updated = profileHistory.filter((p) => p.steamAccountId !== steamAccountId);
    saveProfileHistory(updated);
  };

  const handleClearHistory = () => {
    // Keep favorites, clear the rest
    const favoritesOnly = profileHistory.filter((p) => p.isFavorite);
    saveProfileHistory(favoritesOnly);
    showToast(t('historyCleared'));
  };

  const handleReturnToConfigured = async () => {
    if (!configuredSteamId || currentSteamId === configuredSteamId) return;
    setCurrentSteamId(configuredSteamId);
    setSelectedMatch(null);
    await loadProfileData(configuredSteamId, apiKey);
    showToast(t('returnedToPrimary'));
  };

  const handleSaveSettings = async (newApiKey: string, newSteamId: string) => {
    setApiKey(newApiKey);
    setConfiguredSteamId(newSteamId);
    setCurrentSteamId(newSteamId);

    if (window.api && typeof window.api.store?.set === 'function') {
      await window.api.store.set('stratzApiKey', newApiKey);
      await window.api.store.set('steamAccountId', newSteamId);
    } else {
      localStorage.setItem('stratz_api_key', newApiKey);
      localStorage.setItem('stratz_steam_id', newSteamId);
    }

    showToast('Configurações salvas com sucesso!');
    await loadProfileData(newSteamId, newApiKey);
  };

  const handleOnboardingComplete = async (newApiKey: string, newSteamId: string) => {
    setIsOnboardingOpen(false);
    await handleSaveSettings(newApiKey, newSteamId);
    showToast('Bem-vindo(a) ao GlimpseGG!');
  };

  const handleOpenGuide = () => {
    setOnboardingMode('guide');
    setIsOnboardingOpen(true);
    setIsSettingsOpen(false);
  };

  const handleRestartAndInstallUpdate = () => {
    if (window.api?.updater?.quitAndInstall) {
      window.api.updater.quitAndInstall();
    }
  };

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const activeMatchPlayer = selectedMatch?.players.find((p) => p.playerSlot === selectedPlayerSlot) || selectedMatch?.players[0];

  // Fullscreen Initial Splash Loader
  if (isAppInitializing) {
    return (
      <div className="min-h-screen bg-[#070a10] flex flex-col items-center justify-center space-y-6 select-none animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950 border border-cyan-500/50 flex items-center justify-center shadow-2xl shadow-cyan-950/80">
            <BrandMark className="w-10 h-10 text-cyan-400 animate-pulse" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-lg -z-10 animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-black text-white tracking-wider flex items-center justify-center gap-1">
            <BrandLockup className="flex items-center gap-1" />
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-400/90 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{t('appInitializing')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Auto Update Notification Banner */}
      {downloadedUpdateVersion && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 border-b border-emerald-500/50 px-4 py-2 text-xs flex items-center justify-between text-emerald-200 z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span>
              {t('updateDownloaded')} (<strong>v{downloadedUpdateVersion}</strong>)
            </span>
          </div>
          <button
            onClick={handleRestartAndInstallUpdate}
            className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition shadow-md shadow-emerald-950/40"
          >
            {t('restartAndInstall')}
          </button>
        </div>
      )}

      {/* Top Navbar with Integrated Profile Header & Statuses */}
      <Navbar
        profile={profile}
        hasApiKey={!!apiKey}
        isLoading={isLoading}
        isViewingDifferentAccount={!!configuredSteamId && currentSteamId !== configuredSteamId}
        configuredSteamId={configuredSteamId}
        configuredProfileName={currentSteamId === configuredSteamId ? profile?.name : undefined}
        onGoHome={() => {
          setSelectedMatch(null);
          setIsHeroGridOpen(false);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        heroGridEnabled={heroGridEnabled}
        isHeroGridOpen={isHeroGridOpen}
        onToggleHeroGrid={() => setIsHeroGridOpen((open) => !open)}
        onReturnToConfiguredAccount={handleReturnToConfigured}
        onRefresh={() => {
          if (selectedMatch) handleSelectMatch(selectedMatch.id);
          else if (currentSteamId || configuredSteamId) loadProfileData(currentSteamId || configuredSteamId, apiKey);
        }}
      />

      {/* Main Content Area (Fluid Widescreen Layout up to 1920px) */}
      <main className="flex-1 w-full max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        {/* Toast alert */}
        {statusMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#0e1726] border border-cyan-500/50 text-cyan-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {isHeroGridOpen && heroGridEnabled ? (
          /* =========================================================================
             HERO GRID VIEW — layout espelho ordenado por winrate do meta
             ========================================================================= */
          <div className="animate-in fade-in duration-200">
            <HeroGridTab sync={heroGridSync} />
          </div>
        ) : !selectedMatch ? (
          !profile ? (
            /* Empty Setup State when no profile is loaded yet */
            <div className="flex flex-col items-center justify-center py-28 text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 border border-cyan-500/40 flex items-center justify-center shadow-2xl shadow-cyan-950/60">
                <Sparkles className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-bold text-white">{t('noProfileTitle')}</h2>
                <p className="text-xs text-slate-400">{t('noProfileDesc')}</p>
              </div>
              <button
                onClick={() => {
                  setIsOnboardingOpen(true);
                  setOnboardingMode('onboarding');
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-cyan-950/50"
              >
                {t('configureStratzKey')}
              </button>
            </div>
          ) : (
            /* =========================================================================
               DASHBOARD VIEW (FULL-SCREEN FLUID ASYMMETRIC GRID)
               ========================================================================= */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Identidade, rank e KPIs de carreira */}
              <ProfileHeader profile={profile} />

              {/* Top Grid: Main Stage (Match History) + Right Sidebar (Tendências & Heróis) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7/8 cols: Main Stage - Detailed Recent Match History */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                  {/* `selectedMatchId` e sempre null aqui: a dashboard so
                      existe quando nenhuma partida esta aberta. */}
                  {profile && (
                    <MatchList
                      matches={profile.recentMatches}
                      selectedMatchId={null}
                      heroFilterId={heroFilterId}
                      onClearHeroFilter={() => setHeroFilterId(null)}
                      onSelectMatch={handleSelectMatch}
                    />
                  )}

                  {/* Atividade dos ultimos 30 dias — o dado ja era calculado e
                      nunca chegava a ser exibido. Fica na coluna larga porque
                      precisa de 30 colunas. */}
                  {profile && profile.activityDays && profile.activityDays.length > 0 && (
                    <ActivityHeatmap activityDays={profile.activityDays} />
                  )}

                  {/* Leitura temporal que o sunburst nao da: evolucao ao longo
                      da janela, nao composicao. */}
                  {profile && profile.recentMatches.length > 1 && (
                    <PerformanceTrendChart
                      matches={profile.recentMatches}
                      onSelectMatch={handleSelectMatch}
                    />
                  )}
                </div>

                {/* Right 5/4 cols: Side Widgets - Forma Recente, Tendências, Heróis & Companheiros */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-5">
                  {/* 1. Forma Recente (10 Matches Sequence - Posicionado antes do gráfico) */}
                  {profile && (
                    <RecentFormCard
                      recentMatches={profile.recentMatches}
                      onSelectMatch={handleSelectMatch}
                    />
                  )}

                  {/* 2. Tendências Card (Sunburst + Bipolar Up/Down Equalizer + Lane History) */}
                  {profile && (
                    <StratzTrendsCard
                      matches={profile.recentMatches}
                      seasonRank={profile.seasonRank}
                      leaderboardRank={profile.leaderboardRank}
                      onSelectMatch={handleSelectMatch}
                    />
                  )}

                  {/* 3. Heróis Mais Jogados */}
                  {profile && (
                    <MostPlayedHeroes
                      heroes={profile.mostPlayedHeroes}
                      onFilterHero={(heroId) =>
                        setHeroFilterId((current) => (current === heroId ? null : heroId))
                      }
                    />
                  )}

                  {/* 4. Companheiros de Equipe (Na lateral direita, abaixo dos outros campos) */}
                  {profile && profile.peers && profile.peers.length > 0 && (
                    <StratzTeammatesCard peers={profile.peers} />
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          /* =========================================================================
             MATCH ANALYSIS VIEW (POST-GAME BREAKDOWN)
             ========================================================================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Match Header & Score Banner */}
            <MatchHeader
              match={selectedMatch}
              onBack={() => setSelectedMatch(null)}
            />

            {/* Match View Sub-Navigation Tabs */}
            <div className="flex border border-cyan-500/20 bg-[#090d16]/90 backdrop-blur-md rounded-xl p-1.5 gap-1.5 overflow-x-auto shadow-lg shadow-black/40">
              <button
                onClick={() => setActiveMatchTab('OVERVIEW')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
                  activeMatchTab === 'OVERVIEW'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{t('tabOverview')}</span>
              </button>

              <button
                onClick={() => setActiveMatchTab('PERFORMANCE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
                  activeMatchTab === 'PERFORMANCE'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>{t('tabPerformance')}</span>
              </button>

              <button
                onClick={() => setActiveMatchTab('VISION')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
                  activeMatchTab === 'VISION'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>{t('tabVision')}</span>
              </button>

              <button
                onClick={() => setActiveMatchTab('COACHING')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
                  activeMatchTab === 'COACHING'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>{t('tabCoaching')}</span>
              </button>
            </div>

            {/* Tab 1: Overview & Scoreboard & Team Awards */}
            {activeMatchTab === 'OVERVIEW' && (
              <div className="space-y-6">
                {/* Team Awards Podium & Comparative Dashboard */}
                <TeamOverviewCard
                  match={selectedMatch}
                  selectedPlayerSlot={selectedPlayerSlot}
                  onSelectPlayer={(slot) => {
                    setSelectedPlayerSlot(slot);
                  }}
                />

                {/* Advantage Gold/XP Curve */}
                <AdvantageTimeline timeline={selectedMatch.advantageTimeline} />

                {/* Scoreboard Table with in-place inspection and dedicated performance redirect */}
                <ScoreboardTable
                  players={selectedMatch.players}
                  selectedPlayerSlot={selectedPlayerSlot}
                  onSelectPlayer={(slot) => {
                    setSelectedPlayerSlot(slot);
                  }}
                  onNavigateToPerformance={(slot) => {
                    setSelectedPlayerSlot(slot);
                    setActiveMatchTab('PERFORMANCE');
                  }}
                  didRadiantWin={selectedMatch.didRadiantWin}
                />
              </div>
            )}

            {/* Tab 2: Player Performance & 5-Axis Radar */}
            {activeMatchTab === 'PERFORMANCE' && activeMatchPlayer && (
              <div className="space-y-6">
                {/* Player Quick Switcher */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-slate-400 font-mono">{t('inspectingLabel')}</span>
                  {selectedMatch.players.map((p) => (
                    <button
                      key={p.playerSlot}
                      onClick={() => setSelectedPlayerSlot(p.playerSlot)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 ${
                        p.playerSlot === selectedPlayerSlot
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950/30'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({p.role.replace('POSITION_', 'Pos ')})</span>
                    </button>
                  ))}
                </div>

                <PlayerPerformanceTab
                  player={activeMatchPlayer}
                  match={selectedMatch}
                />
              </div>
            )}

            {/* Tab 3: Vision & Minimap Tracker */}
            {activeMatchTab === 'VISION' && activeMatchPlayer && (
              <WardMinimapTab
                player={activeMatchPlayer}
                match={selectedMatch}
              />
            )}

            {/* Tab 4: Coaching determinístico (motor de regras + dados do patch) */}
            {activeMatchTab === 'COACHING' && activeMatchPlayer && (
              <CoachingInsightsTab
                player={activeMatchPlayer}
                match={selectedMatch}
                apiKey={apiKey}
              />
            )}
          </div>
        )}
      </main>

      {/* Onboarding & How-To-Get-Key Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        mode={onboardingMode}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
        initialApiKey={apiKey}
        initialSteamId={configuredSteamId}
      />

      {/* Search & Player History Modal */}
      <SearchPlayerModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentSteamId={currentSteamId}
        configuredSteamId={configuredSteamId}
        configuredProfileName={currentSteamId === configuredSteamId ? profile?.name : undefined}
        profileHistory={profileHistory}
        onSearch={handleSearchSteamId}
        onSelectProfile={handleSelectProfileFromHistory}
        onToggleFavorite={handleToggleFavoriteProfile}
        onRemoveHistory={handleRemoveHistoryProfile}
        onClearHistory={handleClearHistory}
        onReturnToConfigured={handleReturnToConfigured}
        isLoading={isLoading}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentApiKey={apiKey}
        currentSteamId={configuredSteamId}
        profileHistory={profileHistory}
        onSave={handleSaveSettings}
        onOpenGuide={handleOpenGuide}
        onHeroGridEnabledChange={(enabled) => {
          void heroGridSync.reloadPreferences();
          // Desmarcar fecha a aba: deixa-la aberta mostraria o estado DISABLED sem que o
          // jogador tenha pedido para ver isso.
          if (!enabled) setIsHeroGridOpen(false);
        }}
        onHeroGridSyncRequest={(request) => heroGridSync.syncNow({ mirrorName: request.mirrorName })}
        onHeroGridRemoveMirror={() => heroGridSync.removeMirrorNow()}
      />
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <MainAppContent />
    </LanguageProvider>
  );
}

export default App;
