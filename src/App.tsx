import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { BrandMark } from './components/brand/BrandMark';
import { BrandLockup } from './components/brand/BrandLockup';
import { TrendsCard } from './components/dashboard/TrendsCard';
import { TeammatesCard } from './components/dashboard/TeammatesCard';
import { LOCAL_STORAGE_KEYS, migrateLegacyLocalStorage } from './utils/legacyStorage';
import { RecentFormCard } from './components/dashboard/RecentFormCard';
import { MostPlayedHeroes } from './components/dashboard/MostPlayedHeroes';
import { MatchList } from './components/dashboard/MatchList';
import { ProfileHeader } from './components/dashboard/ProfileHeader';
import { ActivityHeatmap } from './components/dashboard/ActivityHeatmap';
import { PerformanceTrendChart } from './components/dashboard/PerformanceTrendChart';
import { MatchHeader } from './components/match/MatchHeader';
import { ParseRequestCard, PARSE_POLL_DELAYS_MS, type ParseState } from './components/match/ParseRequestCard';
import { MatchTabs } from './components/match/MatchTabs';
import { MatchPlayerPicker } from './components/match/MatchPlayerPicker';
import { Sidebar, type AppSection } from './components/layout/Sidebar';
import { LastMatchCard } from './components/home/LastMatchCard';
import { classifySearchInput, initialMatchView, type MatchTab } from './utils/navigation';
import { ScoreboardTable } from './components/match/ScoreboardTable';
import { AdvantageTimeline } from './components/match/AdvantageTimeline';
import { TeamOverviewCard } from './components/match/TeamOverviewCard';
import { PlayerPerformanceTab } from './components/performance/PlayerPerformanceTab';
import { WardMinimapTab } from './components/vision/WardMinimapTab';
import { CoachingInsightsTab } from './components/coaching/CoachingInsightsTab';
import { SettingsModal } from './components/settings/SettingsModal';
import { HeroGridMirrorScreen } from './components/heroGrid/HeroGridMirrorScreen';
import { HeroGridTab } from './components/heroGrid/HeroGridTab';
import { Notice } from './components/heroGrid/primitives';
import { SearchPlayerModal } from './components/search/SearchPlayerModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { MatchDetails, PlayerProfileSummary, ProfileHistoryItem } from './types/dota';
import { fetchPlayerProfile } from './services/openDotaProfile';
import { fetchOpenDotaMatchDetails, requestOpenDotaParse } from './services/openDotaMatch';
import { resolveSteamId } from './services/steamResolver';
import { configuredProfileTier } from './utils/heroGrid/sourcePrecedence';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Sparkles, DownloadCloud, UserX } from 'lucide-react';

import { useHeroGridSync } from './hooks/useHeroGridSync';

/**
 * As duas telas do layout espelho, dentro da seção `HERO_GRID` da barra lateral.
 *
 * Uniao fechada e nao um booleano por tela: com dois booleanos existiria o estado "painel e
 * replica abertos ao mesmo tempo", que o ternario resolveria por ordem de escrita em vez de
 * por intencao. Com `strict: false`, uniao literal é praticamente a unica rede de tipos aqui.
 */
type HeroGridView = 'PANEL' | 'MIRROR';

/**
 * Seções sem dado proprio ainda (docs/PROPOSTA-V2.md §3.5): ficam fora da barra ate a lista
 * completa por periodo e patch chegar de `services/`. Seção sem dado some — inclusive da
 * navegação.
 */
const HIDDEN_SECTIONS: AppSection[] = ['HEROES'];

/** Abas da partida analisada que existem hoje. `FIGHTS` entra quando a metrica de luta existir. */
const ANALYZED_TABS: MatchTab[] = ['SUMMARY', 'MY_GAME', 'VISION', 'COACHING'];

function MainAppContent() {
  const { t } = useLanguage();
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);
  const [configuredSteamId, setConfiguredSteamId] = useState<string>('');
  const [currentSteamId, setCurrentSteamId] = useState<string>('');
  /**
   * `seasonRank` da conta CONFIGURADA, guardado à parte de `profile`.
   *
   * `profile` segue a conta VISUALIZADA, que a busca de jogadores pode apontar para
   * qualquer um. Derivar o ranque de referência do espelho dali fazia o layout da conta do
   * dono ser gravado com a medalha de outra pessoa, em silêncio. Só é escrito quando o
   * perfil que chegou é o da conta configurada — ver `configuredProfileTier`.
   */
  const [configuredSeasonRank, setConfiguredSeasonRank] = useState<number | null>(null);
  const [profile, setProfile] = useState<PlayerProfileSummary | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);
  const [selectedPlayerSlot, setSelectedPlayerSlot] = useState<number>(0);
  const [activeMatchTab, setActiveMatchTab] = useState<MatchTab>('SUMMARY');
  /**
   * As telas do layout espelho sao views de nivel de painel, nao abas de partida: nao
   * dependem de partida selecionada nenhuma. Visiveis so com a feature ativa (T036).
   */
  const [section, setSection] = useState<AppSection>('HOME');
  const [heroGridView, setHeroGridView] = useState<HeroGridView>('PANEL');
  /** Partida aberta pelo "Pedir análise" do Início: o pedido sai assim que ela abrir. */
  const [pendingParseFor, setPendingParseFor] = useState<string | null>(null);
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
    configuredSteamId,
    // O tier sai de `configuredSeasonRank`, NUNCA de `profile` — ver o estado acima.
    configuredProfileTier({
      profileSteamId: configuredSteamId,
      configuredSteamId,
      seasonRank: configuredSeasonRank,
    }),
  );
  const heroGridEnabled = !!heroGridSync.preferences?.enabled;

  /**
   * Ver outra conta desativa as ENTRADAS do layout espelho, não a sincronização.
   *
   * A sincronização continua correta: escreve na conta configurada, com o bracket dela. O
   * que confunde é a tela, que fala em "seu winrate" enquanto o perfil na frente é de
   * outra pessoa. Desativar com explicação, e não esconder — botão que some faz a pessoa
   * achar que a feature quebrou.
   */
  const isViewingDifferentAccount = !!configuredSteamId && currentSteamId !== configuredSteamId;

  /**
   * O aviso para quem JA estava com uma das telas do grid aberta quando trocou de perfil.
   *
   * Fechar a tela na cara da pessoa seria pior que explicar: as entradas ja ficam
   * desativadas, e aqui o que falta é dizer por que o que ela está vendo pertence a outra
   * conta, com o caminho de volta ao lado.
   */
  const heroGridOtherAccountNotice = isViewingDifferentAccount ? (
    <Notice
      tone="warn"
      icon={<UserX className="w-4 h-4 text-amber-400" />}
      title={t('viewingDifferentAccount')}
    >
      <div className="space-y-2">
        <p>{t('heroGridOtherAccountBody')}</p>
        <button
          type="button"
          onClick={() => void handleReturnToConfigured()}
          className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-bold transition"
        >
          {t('returnToConfigured')}
        </button>
      </div>
    </Notice>
  ) : null;

  /**
   * Feature desligada fecha as telas dela, venha o desligamento de onde vier.
   *
   * O handler das configuracoes ja manda para o Início, mas ele cobre so aquele
   * caminho: `preferences` tambem é relida do config, e um `enabled` que vire `false` por
   * fora deixaria `section` presa numa tela que o render nao mostra mais — e reativar a
   * feature devolveria o jogador à replica sem ele ter pedido. Aqui a categoria inteira
   * fecha, em vez de o buraco conhecido ser tapado.
   */
  useEffect(() => {
    if (!heroGridEnabled) setSection((s) => (s === 'HERO_GRID' ? 'HOME' : s));
  }, [heroGridEnabled]);

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
      localStorage.setItem(LOCAL_STORAGE_KEYS.profileHistory, JSON.stringify(newHistory));
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
          localStorage.setItem(LOCAL_STORAGE_KEYS.profileHistory, JSON.stringify(newHistory));
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
      let loadedSteamId = '';
      let loadedHistory: ProfileHistoryItem[] = [];

      if (window.api && typeof window.api.store?.getAll === 'function') {
        try {
          const config = await window.api.store.getAll();
          if (config.steamAccountId) loadedSteamId = config.steamAccountId;
          if (Array.isArray(config.profileHistory)) loadedHistory = config.profileHistory;
        } catch (e) {
          console.warn('Could not load Electron store config:', e);
        }
      } else {
        // LocalStorage fallback. As chaves eram `stratz_*` ate a 2.0: copiadas uma vez.
        try {
          migrateLegacyLocalStorage(localStorage);
        } catch {
          // `localStorage` inacessivel: o app abre sem conta salva
        }
        const savedSteam = localStorage.getItem(LOCAL_STORAGE_KEYS.steamId);
        const savedHistoryStr = localStorage.getItem(LOCAL_STORAGE_KEYS.profileHistory);
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

      // O app nao usa token nenhum desde 2026-11-19 (docs/PLANO-OPENDOTA.md): basta o Steam
      // ID. A chave `stratzApiKey` que possa existir no config NAO é lida nem regravada
      // aqui — os scripts de medicao de `scripts/` ainda a leem daquele arquivo.
      const resolvedSteamId = loadedSteamId.trim();
      if (resolvedSteamId) {
        setConfiguredSteamId(resolvedSteamId);
        setCurrentSteamId(resolvedSteamId);

        try {
          const profileData = await fetchPlayerProfile(resolvedSteamId);
          if (profileData && profileData.steamAccountId) {
            setProfile(profileData);
            // Aqui `resolvedSteamId === configuredSteamId` por construção.
            setConfiguredSeasonRank(profileData.seasonRank ?? null);
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

      // Sem Steam ID configurado, ou o perfil nao carregou: onboarding.
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

  /**
   * `configuredIdOverride` existe por causa do `handleSaveSettings`: ele chama esta função
   * no mesmo tique em que faz `setConfiguredSteamId`, então `configuredSteamId` aqui ainda
   * seria o valor ANTIGO e o `seasonRank` da conta nova não seria guardado.
   */
  const loadProfileData = async (steamId: string, configuredIdOverride?: string) => {
    setIsLoading(true);
    try {
      const data = await fetchPlayerProfile(steamId);
      setProfile(data);
      // Só o perfil da conta configurada alimenta o ranque de referência do espelho.
      if (steamId === (configuredIdOverride ?? configuredSteamId)) {
        setConfiguredSeasonRank(data?.seasonRank ?? null);
      }
      if (data && data.steamAccountId) {
        upsertProfileHistory(data);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Abre uma partida. `keepView` (atualizar a partida aberta) mantém aba e jogador;
   * `requestParse` (o "Pedir análise" do Início) dispara o pedido assim que ela abrir — e só
   * se ela de fato estiver sem análise.
   */
  const handleSelectMatch = async (
    matchId: string,
    opts: { keepView?: boolean; requestParse?: boolean } = {},
  ) => {
    setIsLoading(true);
    try {
      const match = await fetchOpenDotaMatchDetails(matchId);
      // `fetchMatchDetails` devolvia o dataset de demonstracao quando a API falhava,
      // entao este caminho nunca existia: a tela abria com a partida errada em vez de
      // avisar. Agora a falha é `null` e fica visivel.
      if (!match) {
        showToast(t('matchLoadError'));
        return;
      }
      setSelectedMatch(match);
      if (!opts.keepView) {
        // Slot e aba inicial: "Meu jogo" só quando o slot achado é da conta configurada e a
        // partida foi analisada; senão "Resumo" (decisão do dono, 2026-11-19).
        const view = initialMatchView(match, configuredSteamId, currentSteamId);
        setSelectedPlayerSlot(view.slot);
        setActiveMatchTab(view.tab);
      }
      if (opts.requestParse && !match.availability.parsed) setPendingParseFor(match.id);
    } catch (err) {
      console.error('Error loading match details:', err);
      showToast(t('matchLoadError'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * A busca (Ctrl+K) aceita conta OU partida. Id que só pode ser partida (acima de 32 bits)
   * ou link de partida abre a partida; o resto vai para o resolvedor de conta. O caso
   * ambíguo (número que cabe em 32 bits) é conta aqui, e o modal oferece "abrir como
   * partida" ao lado — ver `classifySearchInput`.
   */
  const handleSearchSteamId = async (input: string) => {
    const intent = classifySearchInput(input);
    if (intent.kind === 'MATCH') {
      await handleSelectMatch(intent.matchId);
      return;
    }
    setIsLoading(true);
    try {
      const res = await resolveSteamId(input);
      if (res.success && res.steamAccountId) {
        setCurrentSteamId(res.steamAccountId);
        await loadProfileData(res.steamAccountId);
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
    await loadProfileData(steamAccountId);
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
    await loadProfileData(configuredSteamId);
    showToast(t('returnedToPrimary'));
  };

  const handleSaveSettings = async (newSteamId: string) => {
    setConfiguredSteamId(newSteamId);
    setCurrentSteamId(newSteamId);
    // Conta nova, ranque desconhecido até o perfil chegar. Manter o anterior derivaria o
    // bracket da conta antiga — o mesmo erro, só que mais difícil de ver.
    if (newSteamId !== configuredSteamId) setConfiguredSeasonRank(null);

    // So o Steam ID. `stratzApiKey` nao é escrito de proposito: ver o comentario em `init`.
    if (window.api && typeof window.api.store?.set === 'function') {
      await window.api.store.set('steamAccountId', newSteamId);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEYS.steamId, newSteamId);
    }

    showToast(t('settingsSavedAlert'));
    await loadProfileData(newSteamId, newSteamId);
  };

  const handleOnboardingComplete = async (newSteamId: string) => {
    setIsOnboardingOpen(false);
    await handleSaveSettings(newSteamId);
    showToast(t('welcomeToast'));
  };

  /**
   * Partida nao parseada: pede o parse do replay e acompanha a PARTIDA (nao o job — o
   * estado do job volta `null` tanto para "terminou" quanto para "nao existe").
   *
   * So no clique: cada pedido conta como 10 chamadas no limite da OpenDota. A espera tem
   * recuo e teto (`PARSE_POLL_DELAYS_MS`, ~5 min); passou disso a tela avisa e o jogador
   * pode tentar de novo — parse de replay antigo pode simplesmente nao acontecer.
   */
  const [parseState, setParseState] = useState<ParseState>('idle');
  const parseRunRef = React.useRef(0);
  useEffect(() => {
    // Trocou de partida (ou voltou para a dashboard): a espera anterior nao vale mais.
    parseRunRef.current += 1;
    setParseState('idle');
  }, [selectedMatch?.id]);

  // Declarado DEPOIS do efeito acima de propósito: os dois rodam no mesmo commit quando a
  // partida abre, e o reset tem de vir antes do pedido — na ordem inversa ele cancelaria a
  // espera que acabou de começar.
  useEffect(() => {
    if (!pendingParseFor || selectedMatch?.id !== pendingParseFor) return;
    setPendingParseFor(null);
    void handleRequestParse(pendingParseFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParseFor, selectedMatch?.id]);

  const handleRequestParse = async (matchIdOverride?: string) => {
    const matchId = matchIdOverride ?? selectedMatch?.id;
    if (!matchId) return;
    const run = ++parseRunRef.current;
    setParseState('requesting');
    const res = await requestOpenDotaParse(matchId);
    if (parseRunRef.current !== run) return;
    if (!res.success) {
      setParseState('error');
      return;
    }
    setParseState('waiting');
    for (const delay of PARSE_POLL_DELAYS_MS) {
      await new Promise((r) => setTimeout(r, delay));
      if (parseRunRef.current !== run) return;
      const fresh = await fetchOpenDotaMatchDetails(matchId);
      if (parseRunRef.current !== run) return;
      if (fresh && fresh.availability.parsed) {
        setSelectedMatch(fresh);
        // A partida virou "analisada": a aba inicial passa a valer como se tivesse aberto
        // agora — "Meu jogo" se o jogador em foco é a conta configurada.
        setActiveMatchTab(initialMatchView(fresh, configuredSteamId, currentSteamId).tab);
        showToast(t('parseReadyToast'));
        return;
      }
    }
    setParseState('timeout');
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

  // Trocar de seção, de partida ou de conta começa do topo: a rolagem da tela anterior
  // deixava a conta de um companheiro abrir no meio da página.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section, selectedMatch?.id, currentSteamId]);

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

  const navigate = (next: AppSection) => {
    setSelectedMatch(null);
    if (next === 'HERO_GRID' && section !== 'HERO_GRID') setHeroGridView('PANEL');
    setSection(next);
  };

  /** Partida aberta: sem análise é o "modo placar" — outra forma de tela, não um aviso por cima. */
  const isScoreboardMode = !!selectedMatch && !selectedMatch.availability.parsed;
  const lastMatch = profile?.recentMatches?.[0] ?? null;

  const renderMatch = (match: MatchDetails) => (
    <div className="space-y-5 animate-in fade-in duration-200">
      <MatchHeader match={match} onBack={() => setSelectedMatch(null)} />

      {isScoreboardMode ? (
        /* MODO PLACAR (decisão 2 do dono): aviso + pedido de análise, destaques que só
           dependem do placar, Glint beta e o placar completo. Sem abas, sem linha de
           vantagem, sem comparativo, sem "quem liderou" e sem melhor por posição. */
        <>
          <ParseRequestCard state={parseState} onRequest={() => void handleRequestParse()} />
          <TeamOverviewCard
            match={match}
            variant="scoreboard"
            selectedPlayerSlot={selectedPlayerSlot}
            onSelectPlayer={setSelectedPlayerSlot}
          />
          <ScoreboardTable
            players={match.players}
            selectedPlayerSlot={selectedPlayerSlot}
            onSelectPlayer={setSelectedPlayerSlot}
            didRadiantWin={match.didRadiantWin}
          />
        </>
      ) : (
        <>
          <MatchTabs
            tabs={ANALYZED_TABS}
            active={activeMatchTab}
            onChange={setActiveMatchTab}
            trailing={
              activeMatchTab !== 'SUMMARY' ? (
                <MatchPlayerPicker
                  match={match}
                  selectedSlot={selectedPlayerSlot}
                  onSelect={setSelectedPlayerSlot}
                  configuredSteamId={configuredSteamId}
                />
              ) : null
            }
          />

          {activeMatchTab === 'SUMMARY' && (
            <div className="space-y-6">
              <TeamOverviewCard
                match={match}
                selectedPlayerSlot={selectedPlayerSlot}
                onSelectPlayer={setSelectedPlayerSlot}
              />
              <AdvantageTimeline timeline={match.advantageTimeline} />
              <ScoreboardTable
                players={match.players}
                selectedPlayerSlot={selectedPlayerSlot}
                onSelectPlayer={setSelectedPlayerSlot}
                onNavigateToPerformance={(slot) => {
                  setSelectedPlayerSlot(slot);
                  setActiveMatchTab('MY_GAME');
                }}
                didRadiantWin={match.didRadiantWin}
              />
            </div>
          )}

          {activeMatchTab === 'MY_GAME' && activeMatchPlayer && (
            <PlayerPerformanceTab player={activeMatchPlayer} match={match} />
          )}

          {activeMatchTab === 'VISION' && activeMatchPlayer && (
            <WardMinimapTab player={activeMatchPlayer} match={match} />
          )}

          {activeMatchTab === 'COACHING' && activeMatchPlayer && (
            <CoachingInsightsTab player={activeMatchPlayer} match={match} />
          )}
        </>
      )}
    </div>
  );

  const renderSection = (p: PlayerProfileSummary) => {
    switch (section) {
      case 'MATCHES':
        return (
          <MatchList
            matches={p.recentMatches}
            selectedMatchId={null}
            heroFilterId={heroFilterId}
            onClearHeroFilter={() => setHeroFilterId(null)}
            onSelectMatch={(id) => void handleSelectMatch(id)}
          />
        );
      case 'ACCOUNT':
        return (
          <div className="space-y-6">
            <ProfileHeader
              profile={p}
              heroGridEnabled={heroGridEnabled}
              lastMirrorSyncAt={heroGridSync.mirrorSnapshot?.at ?? null}
              isViewingDifferentAccount={isViewingDifferentAccount}
              onOpenHeroGridMirror={() => {
                setHeroGridView('MIRROR');
                setSection('HERO_GRID');
              }}
            />
            <div className="max-w-2xl">
              <TrendsCard
                part="account"
                matches={p.recentMatches}
                seasonRank={p.seasonRank}
                leaderboardRank={p.leaderboardRank}
                onSelectMatch={(id) => void handleSelectMatch(id)}
              />
            </div>
          </div>
        );
      case 'HOME':
      default:
        /* Início, opção A dos wireframes: última partida no topo, depois forma e tendência,
           por último os cards menores (docs/PROPOSTA-V2.md §3.2). */
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch">
              <div className="xl:col-span-3 [&>*]:h-full">
                {lastMatch && (
                  <LastMatchCard
                    match={lastMatch}
                    onOpen={(id) => void handleSelectMatch(id)}
                    onOpenAndRequestParse={(id) => void handleSelectMatch(id, { requestParse: true })}
                  />
                )}
              </div>
              <div className="xl:col-span-2">
                <RecentFormCard
                  recentMatches={p.recentMatches}
                  onSelectMatch={(id) => void handleSelectMatch(id)}
                />
              </div>
            </div>

            {/* Tendência: a curva por partida na largura inteira — ela é a leitura de
                "estou melhorando?" e espremida perde o eixo. */}
            {p.recentMatches.length > 1 && (
              <PerformanceTrendChart
                matches={p.recentMatches}
                onSelectMatch={(id) => void handleSelectMatch(id)}
              />
            )}

            {/* Os cards menores, em colunas que acomodam alturas diferentes sem buraco. */}
            <div className="columns-1 lg:columns-2 2xl:columns-3 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
              <TrendsCard
                part="trend"
                matches={p.recentMatches}
                seasonRank={p.seasonRank}
                leaderboardRank={p.leaderboardRank}
                onSelectMatch={(id) => void handleSelectMatch(id)}
              />
              <MostPlayedHeroes
                heroes={p.mostPlayedHeroes}
                onFilterHero={(heroId) => {
                  // O clique no herói abre Partidas já filtrada por ele.
                  setHeroFilterId(heroId);
                  setSection('MATCHES');
                }}
              />
              {p.activityDays && p.activityDays.length > 0 && <ActivityHeatmap activityDays={p.activityDays} />}
              {p.peers && p.peers.length > 0 && (
                <TeammatesCard
                  peers={p.peers}
                  onOpenPeer={(accountId) => void handleSelectProfileFromHistory(accountId)}
                />
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex font-sans selection:bg-cyan-500 selection:text-black">
      <Sidebar
        section={section}
        onNavigate={navigate}
        heroGridEnabled={heroGridEnabled}
        heroGridDisabledReason={isViewingDifferentAccount ? t('heroGridOtherAccountBody') : null}
        hiddenSections={HIDDEN_SECTIONS}
      />

      <div className="flex-1 min-w-0 flex flex-col">
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

        <Navbar
          profile={profile}
          isLoading={isLoading}
          isViewingDifferentAccount={isViewingDifferentAccount}
          configuredSteamId={configuredSteamId}
          configuredProfileName={currentSteamId === configuredSteamId ? profile?.name : undefined}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onReturnToConfiguredAccount={handleReturnToConfigured}
          onRefresh={() => {
            if (selectedMatch) void handleSelectMatch(selectedMatch.id, { keepView: true });
            else if (currentSteamId || configuredSteamId) loadProfileData(currentSteamId || configuredSteamId);
          }}
        />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
          {/* Toast alert */}
          {statusMessage && (
            <div className="fixed bottom-5 right-5 z-50 bg-[#0e1726] border border-cyan-500/50 text-cyan-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {selectedMatch ? (
            renderMatch(selectedMatch)
          ) : section === 'HERO_GRID' && heroGridEnabled ? (
            /* HERO GRID — painel (sincronização, diagnóstico, ranking) ou réplica do layout */
            <div className="animate-in fade-in duration-200 space-y-4">
              {heroGridOtherAccountNotice}
              {heroGridView === 'MIRROR' ? (
                <HeroGridMirrorScreen
                  sync={heroGridSync}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenPanel={() => setHeroGridView('PANEL')}
                />
              ) : (
                <HeroGridTab sync={heroGridSync} onOpenMirror={() => setHeroGridView('MIRROR')} />
              )}
            </div>
          ) : !profile ? (
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
                {t('configureSteamAccount')}
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">{renderSection(profile)}</div>
          )}
        </main>
      </div>

      {/* Onboarding e ajuda de conta Steam */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        mode={onboardingMode}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
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
        onOpenMatch={(id) => void handleSelectMatch(id)}
        isLoading={isLoading}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSteamId={configuredSteamId}
        profileHistory={profileHistory}
        onSave={handleSaveSettings}
        onOpenGuide={handleOpenGuide}
        onHeroGridEnabledChange={(enabled) => {
          void heroGridSync.reloadPreferences();
          // Desmarcar fecha a aba: deixa-la aberta mostraria o estado DISABLED sem que o
          // jogador tenha pedido para ver isso.
          if (!enabled) setSection((s) => (s === 'HERO_GRID' ? 'HOME' : s));
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
