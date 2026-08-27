import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Key,
  User,
  ExternalLink,
  Save,
  CheckCircle,
  Database,
  Sparkles,
  Globe,
  Star,
  HelpCircle,
  DownloadCloud,
  RefreshCw,
  LayoutGrid,
  HardDrive,
  FolderOpen,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  RotateCcw,
  ListOrdered,
  Trophy,
  Loader2,
} from 'lucide-react';
import { resolveSteamId } from '../../services/steamResolver';
import { useLanguage } from '../../context/LanguageContext';
import { ProfileHistoryItem } from '../../types/dota';
import { extractSteamIdFromStratzToken } from '../../utils/stratzToken';
import { useGamePatch } from '../../hooks/useGamePatch';
import { TranslationKey } from '../../i18n/translations';
import type { RankBracketBasic } from '../../utils/rankBracket';
import type {
  ConfigRef,
  GridBackupEntry,
  RankingCriterion,
  SteamAccountCandidate,
} from '../../types/heroGrid';
import {
  disableHeroGrid,
  HERO_GRID_DEFAULTS,
  loadHeroGridPreferences,
  saveHeroGridPreferences,
} from '../../utils/heroGrid/preferences';
import {
  isHeroGridFileAccessAvailable,
  listAccounts,
  listBackups,
  readFile,
  restoreBackup,
} from '../../services/heroGrid/heroGridBridge';
import { defaultMirrorName } from '../../utils/heroGrid/mirrorBuilder';
import {
  buildLayoutOptions,
  findLayoutOption,
  looksLikeGridFilePath,
  preselectAccount,
  preselectSourceRef,
  resolveGridFilePath,
  type LayoutOption,
} from '../../utils/heroGrid/settingsOptions';

/**
 * O que a tela entrega ao fluxo de escrita (T032/`useHeroGridSync`) quando o jogador
 * confirma FR-003.
 *
 * `mirrorName` viaja aqui, e nao pelas preferencias, de proposito: `contracts/config-keys.md`
 * nao define chave para o nome desejado do espelho — `heroGridMirror.name` é o *ultimo nome
 * visto no arquivo* (C-7), e gravar ali um nome que ainda nao existe no disco faria a
 * proxima sincronizacao interpretar como rename (N-3) e sobrescrever a escolha do jogador.
 */
export interface HeroGridSyncRequest {
  /** Caminho do `hero_grid_config.json` resolvido na tela (deteccao ou FR-006). */
  path: string;
  /** Origem por POSICAO (N-1). `name` é rotulo. */
  source: ConfigRef;
  /** Nome desejado para o espelho. Default de N-5: `"<origem> — GlimpseGG"`. */
  mirrorName: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  currentSteamId: string;
  profileHistory?: ProfileHistoryItem[];
  onSave: (apiKey: string, steamId: string) => Promise<void>;
  onOpenGuide?: () => void;
  /**
   * Opcional (T036): avisa o `App` que a feature de layout espelho ligou ou desligou, para
   * ele mostrar/esconder a aba e parar o agendador. A persistencia NAO depende deste
   * gancho — quem grava é `preferences.ts`, e o agendador lê `heroGridEnabled` do config
   * (C-3). Ausente => a tela funciona igual, só sem notificar ninguem.
   */
  onHeroGridEnabledChange?: (enabled: boolean) => void;
  /**
   * Opcional (T032/T037): dispara a primeira sincronizacao logo depois da confirmacao de
   * FR-003. Ausente => a tela apenas persiste a configuracao, e a sincronizacao acontece
   * pelo caminho normal (aba da feature ou agendador). A tela NUNCA escreve arquivo por
   * conta propria.
   */
  onHeroGridSyncRequest?: (request: HeroGridSyncRequest) => void | Promise<void>;
  /**
   * Opcional (T037): remove o layout espelho. Remover é uma ESCRITA (backup byte a byte,
   * escrita atomica e guarda do main), então mora no fluxo de escrita — nao aqui. Ausente
   * => o botao aparece desabilitado, dizendo onde a remocao fica.
   */
  onHeroGridRemoveMirror?: () => void | Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Tabelas enum -> chave i18n
 *
 * `Record` fechado com literais explicitos, nunca `t(\`prefixo${x}\`)`: chave montada em
 * runtime escapa do teste de chave orfa, e valor novo no enum sem entrada aqui quebra o
 * `tsc -b` — que com `strict: false` é a unica rede de tipos disponivel.
 * ------------------------------------------------------------------ */

const CRITERION_ORDER: readonly RankingCriterion[] = ['COMBINED', 'META_ONLY', 'PERSONAL_ONLY'];

const CRITERION_LABEL_KEYS: Record<RankingCriterion, TranslationKey> = {
  COMBINED: 'heroGridCriterionCombined',
  META_ONLY: 'heroGridCriterionMetaOnly',
  PERSONAL_ONLY: 'heroGridCriterionPersonalOnly',
};

const CRITERION_DESC_KEYS: Record<RankingCriterion, TranslationKey> = {
  COMBINED: 'heroGridCriterionCombinedDesc',
  META_ONLY: 'heroGridCriterionMetaOnlyDesc',
  PERSONAL_ONLY: 'heroGridCriterionPersonalOnlyDesc',
};

const BRACKET_ORDER: readonly RankBracketBasic[] = [
  'UNCALIBRATED',
  'HERALD_GUARDIAN',
  'CRUSADER_ARCHON',
  'LEGEND_ANCIENT',
  'DIVINE_IMMORTAL',
  'ALL',
];

const BRACKET_LABEL_KEYS: Record<RankBracketBasic, TranslationKey> = {
  UNCALIBRATED: 'heroGridBracketUncalibrated',
  HERALD_GUARDIAN: 'heroGridBracketHeraldGuardian',
  CRUSADER_ARCHON: 'heroGridBracketCrusaderArchon',
  LEGEND_ANCIENT: 'heroGridBracketLegendAncient',
  DIVINE_IMMORTAL: 'heroGridBracketDivineImmortal',
  ALL: 'heroGridBracketAll',
};

/** Valor do `<select>` para "derivar do perfil" (`bracket: null`). */
const BRACKET_AUTO = 'AUTO';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentApiKey,
  currentSteamId,
  profileHistory = [],
  onSave,
  onOpenGuide,
  onHeroGridEnabledChange,
  onHeroGridSyncRequest,
  onHeroGridRemoveMirror,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [steamInput, setSteamInput] = useState(currentSteamId);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);
  const { patch: dotaPatch } = useGamePatch(apiKey);

  useEffect(() => {
    if (isOpen) {
      setApiKey(currentApiKey);
      setSteamInput(currentSteamId);
      setResolveError(null);
      setSavedSuccess(false);
      setUpdateStatusText(null);

      // Load app version if running in Electron
      if (window.api && typeof window.api.getVersion === 'function') {
        window.api.getVersion().then((v) => {
          if (v) setAppVersion(v);
        }).catch(() => {});
      }
    }
  }, [isOpen, currentApiKey, currentSteamId]);

  /* ================================================================== *
   * Bloco da feature de layout espelho de herois (specs/001-meta-hero-grid)
   *
   * Estado proprio, persistido por `utils/heroGrid/preferences.ts` — de proposito, para o
   * `App.tsx` nao precisar carregar mais nada nem a assinatura de `onSave` mudar.
   *
   * FR-002 / C-3: com a opcao DESMARCADA nenhum codigo de arquivo da feature roda
   * automaticamente. Por isso os efeitos que listam contas e leem a colecao de layouts
   * exigem `hgEnabled`. As unicas operacoes de arquivo possiveis com a feature desligada
   * sao as que o jogador clica explicitamente no painel de desativacao (FR-004 manda a
   * restauracao continuar disponivel depois de desmarcar).
   * ================================================================== */

  /**
   * Modo browser (`npm run dev`): `window.api` nao existe, logo nao ha acesso a disco.
   * A tela mostra o bloco e diz que NAO escreve layout neste modo — nunca simula sucesso.
   */
  const gridFileAccess = useMemo(() => isHeroGridFileAccessAvailable(), []);

  const [hgEnabled, setHgEnabled] = useState(HERO_GRID_DEFAULTS.enabled);
  const [hgSteamId3, setHgSteamId3] = useState<string | null>(null);
  /** Texto do campo de FR-006, enquanto é digitado. */
  const [hgManualPath, setHgManualPath] = useState('');
  /** O caminho já confirmado (blur/Enter). É ele que dispara leitura, nao cada tecla. */
  const [hgManualPathSaved, setHgManualPathSaved] = useState('');
  const [hgCriterion, setHgCriterion] = useState<RankingCriterion>(HERO_GRID_DEFAULTS.criterion);
  const [hgBracket, setHgBracket] = useState<RankBracketBasic | null>(HERO_GRID_DEFAULTS.bracket);
  const [hgMirror, setHgMirror] = useState<ConfigRef | null>(null);
  const [hgSavedSource, setHgSavedSource] = useState<ConfigRef | null>(null);
  const [hgAccounts, setHgAccounts] = useState<SteamAccountCandidate[]>([]);
  const [hgLayouts, setHgLayouts] = useState<LayoutOption[]>([]);
  /** `false` é estado APRESENTAVEL, nao erro (I-27): o arquivo só nasce com um grid criado. */
  const [hgGridFileExists, setHgGridFileExists] = useState<boolean | null>(null);
  const [hgSourceIndex, setHgSourceIndex] = useState<number | null>(null);
  const [hgMirrorName, setHgMirrorName] = useState('');
  const [hgMirrorNameTouched, setHgMirrorNameTouched] = useState(false);
  const [hgLoading, setHgLoading] = useState(false);
  const [hgBusy, setHgBusy] = useState(false);
  /** Mensagem CRUA vinda do main/ponte. Nao é texto de UI — é diagnostico, como `resolveError`. */
  const [hgError, setHgError] = useState<string | null>(null);
  const [hgNotice, setHgNotice] = useState<TranslationKey | null>(null);
  /** FR-003: o dialogo de confirmacao explicita, antes da PRIMEIRA escrita. */
  const [hgConfirmOpen, setHgConfirmOpen] = useState(false);
  /** FR-004: painel que aparece ao desmarcar, com remocao do espelho e restauracao. */
  const [hgDisabledPanel, setHgDisabledPanel] = useState(false);
  const [hgBackups, setHgBackups] = useState<GridBackupEntry[] | null>(null);

  // Carrega as preferencias ao abrir. C-1: chave ausente lê como default, então quem
  // atualiza de uma versao anterior do app cai em `enabled: false` (FR-001).
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;

    loadHeroGridPreferences()
      .then((prefs) => {
        if (!alive) return;
        setHgEnabled(prefs.enabled);
        setHgSteamId3(prefs.steamId3);
        setHgManualPath(prefs.gridFilePath ?? '');
        setHgManualPathSaved(prefs.gridFilePath ?? '');
        setHgCriterion(prefs.criterion);
        setHgBracket(prefs.bracket);
        setHgMirror(prefs.mirror);
        setHgSavedSource(prefs.source);
        setHgSourceIndex(prefs.source ? prefs.source.index : null);
        // C-8: prefere o nome DESEJADO persistido; cai no ultimo nome visto no arquivo, e
        // depois no default de N-5 (calculado em `hgEffectiveMirrorName`).
        setHgMirrorName(prefs.mirrorName || (prefs.mirror ? prefs.mirror.name : ''));
        setHgMirrorNameTouched(!!prefs.mirrorName);
        setHgConfirmOpen(false);
        setHgDisabledPanel(false);
        setHgBackups(null);
        setHgError(null);
        setHgNotice(null);
      })
      .catch(() => {
        // Config ilegivel lê como config vazio (a propria `preferences.ts` faz isso).
        // Falhar aqui deixaria o jogador sem tela de configuracao.
      });

    return () => {
      alive = false;
    };
  }, [isOpen]);

  // Contas Steam da maquina (FR-005). Só com a feature marcada — antes disso seria leitura
  // de disco com a opcao desmarcada.
  useEffect(() => {
    if (!isOpen || !hgEnabled || !gridFileAccess) return;
    let alive = true;
    setHgLoading(true);

    listAccounts()
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          setHgAccounts(res.data);
          // Pre-selecao: escolha salva > perfil já configurado no app > candidata unica.
          // A escolha salva entra pelo updater (`current`) em vez de por dependencia do
          // efeito: incluir `hgSteamId3` nas deps releria a lista de contas da maquina a
          // cada troca de selecao, e a lista nao depende dela.
          setHgSteamId3((current) => preselectAccount(res.data, current)?.steamId3 ?? current);
        } else {
          setHgAccounts([]);
          setHgError(res.error);
        }
      })
      .finally(() => {
        if (alive) setHgLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, hgEnabled, gridFileAccess]);

  const hgSelectedAccount = useMemo(
    () => hgAccounts.find((candidate) => candidate.steamId3 === hgSteamId3) ?? null,
    [hgAccounts, hgSteamId3]
  );

  /** FR-006: caminho manual vence a deteccao automatica. */
  const hgGridPath = useMemo(
    () => resolveGridFilePath(hgSelectedAccount, hgManualPathSaved),
    [hgSelectedAccount, hgManualPathSaved]
  );

  // Lê a colecao de layouts do caminho resolvido (FR-005a).
  useEffect(() => {
    if (!isOpen || !hgEnabled || !gridFileAccess || !hgGridPath) {
      setHgLayouts([]);
      setHgGridFileExists(null);
      return;
    }
    let alive = true;
    setHgLoading(true);

    readFile({ path: hgGridPath })
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          setHgGridFileExists(res.data.exists);
          const options = buildLayoutOptions(res.data.file);
          setHgLayouts(options);
          // N-3: posicao guardada que ainda existe continua valendo, e o nome exibido vem do
          // arquivo (rename é rename, nao layout novo). N-4: posicao que sumiu devolve
          // `null`, e a tela pede nova origem — nunca adivinha por nome.
          //
          // A posicao entra pelo updater em vez de por dependencia: `hgSavedSource` nas deps
          // faria o arquivo ser relido a cada gravacao de preferencia.
          setHgSourceIndex((current) => {
            const ref = preselectSourceRef(
              options,
              current === null ? null : { index: current, name: '' }
            );
            return ref ? ref.index : null;
          });
          setHgError(null);
        } else {
          setHgLayouts([]);
          setHgGridFileExists(null);
          setHgError(res.error);
        }
      })
      .finally(() => {
        if (alive) setHgLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, hgEnabled, gridFileAccess, hgGridPath]);

  const hgSourceOption = useMemo(
    () => findLayoutOption(hgLayouts, hgSourceIndex),
    [hgLayouts, hgSourceIndex]
  );

  /**
   * N-5: `"<origem> — GlimpseGG"`, editavel.
   *
   * Precedencia: o que o jogador digitou > o nome que o espelho registrado já tem (ele pode
   * ter renomeado no jogo, FR-008h) > o default de N-5 a partir da origem.
   */
  const hgEffectiveMirrorName = useMemo(() => {
    const typed = hgMirrorName.trim();
    if (hgMirrorNameTouched && typed.length > 0) return typed;
    if (hgMirror && hgMirror.name) return hgMirror.name;
    return hgSourceOption ? defaultMirrorName(hgSourceOption.name) : '';
  }, [hgMirrorName, hgMirrorNameTouched, hgMirror, hgSourceOption]);

  if (!isOpen) return null;

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    const autoSteamId = extractSteamIdFromStratzToken(val);
    if (autoSteamId && !steamInput.trim()) {
      setSteamInput(autoSteamId);
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.api?.updater?.check) {
      setUpdateStatusText('Auto-update disponível apenas na versão empacotada.');
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateStatusText(t('checkingUpdates'));

    try {
      const res = await window.api.updater.check();
      if (res?.dev) {
        setUpdateStatusText('Ambiente de desenvolvimento (sem updates)');
      } else if (res?.updateInfo) {
        setUpdateStatusText(`${t('updateAvailable').replace('{version}', res.updateInfo.version)}`);
      } else {
        setUpdateStatusText(t('noUpdatesAvailable'));
      }
    } catch (e: any) {
      setUpdateStatusText(t('updateError'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setResolveError(null);

    try {
      // Resolve Steam ID if provided
      let finalSteamId = steamInput.trim();
      if (finalSteamId) {
        const res = await resolveSteamId(finalSteamId);
        if (res.success && res.steamAccountId) {
          finalSteamId = res.steamAccountId;
        } else {
          setResolveError(res.error || t('steamIdResolveError'));
          setIsSaving(false);
          return;
        }
      }

      await onSave(apiKey.trim(), finalSteamId);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      setResolveError(t('saveConfigError'));
    } finally {
      setIsSaving(false);
    }
  };

  const loadDemoPreset = (steamId: string) => {
    setSteamInput(steamId);
  };

  /* ------------------------------------------------------------------ *
   * Handlers do bloco de layout espelho
   * ------------------------------------------------------------------ */

  const hgManualPathLooksValid = hgManualPath.trim().length === 0 || looksLikeGridFilePath(hgManualPath);

  /**
   * FR-004: o painel de desativacao aparece ao desmarcar, e continua aparecendo nas aberturas
   * seguintes enquanto houver espelho registrado com a feature desligada — a remocao e a
   * restauracao tem de continuar alcancaveis, nao só na sessao em que se desmarcou. É C-4 no
   * lado da UI: preservar `heroGridMirror` só serve se a tela ainda oferecer o que fazer com ele.
   */
  const hgShowDisabledPanel = hgDisabledPanel || (!hgEnabled && hgMirror !== null);

  /** FR-001 / FR-004: marcar e desmarcar a opcao. */
  const handleHgToggle = async (next: boolean) => {
    setHgError(null);
    setHgNotice(null);
    setHgEnabled(next);

    if (next) {
      setHgDisabledPanel(false);
      await saveHeroGridPreferences({ enabled: true });
    } else {
      setHgConfirmOpen(false);
      // C-4: `disableHeroGrid()` grava SÓ `heroGridEnabled: false`.
      //
      // `heroGridMirror` e `heroGridSource` ficam INTACTOS, e isso nao é descuido: sem a
      // referencia (posicao + ultimo nome) o app deixa de saber qual dos `configs` é o
      // espelho dele, e o layout gerado ficaria orfao no jogo para sempre — a remocao
      // viraria impossivel. Nao limpar essas chaves aqui.
      await disableHeroGrid();
      setHgDisabledPanel(true);
    }

    onHeroGridEnabledChange?.(next);
  };

  const handleHgAccountChange = async (steamId3: string) => {
    setHgSteamId3(steamId3);
    setHgError(null);
    // Conta nova => a origem guardada aponta para o arquivo de outra conta. Descarta a
    // pre-selecao em vez de reaproveitar a posicao (N-4: posicao de outro arquivo nao é a
    // mesma origem, mesmo que o nome coincida).
    setHgSavedSource(null);
    setHgSourceIndex(null);
    await saveHeroGridPreferences({ steamId3 });
  };

  /** FR-006: confirma o caminho manual (blur/Enter) e persiste em `heroGridFilePath`. */
  const handleHgManualPathCommit = async () => {
    const value = hgManualPath.trim();
    if (value === hgManualPathSaved) return;
    setHgManualPathSaved(value);
    setHgSavedSource(null);
    setHgSourceIndex(null);
    setHgError(null);
    await saveHeroGridPreferences({ gridFilePath: value.length > 0 ? value : null });
  };

  const handleHgSourceChange = (rawValue: string) => {
    // A identidade é a POSICAO (N-1). O `<select>` carrega o `index`, nunca o nome.
    const parsed = Number.parseInt(rawValue, 10);
    setHgSourceIndex(Number.isInteger(parsed) ? parsed : null);
    setHgMirrorNameTouched(false);
    setHgNotice(null);
  };

  const handleHgCriterionChange = async (criterion: RankingCriterion) => {
    setHgCriterion(criterion);
    await saveHeroGridPreferences({ criterion });
  };

  const handleHgBracketChange = async (rawValue: string) => {
    const bracket = rawValue === BRACKET_AUTO ? null : (rawValue as RankBracketBasic);
    setHgBracket(bracket);
    await saveHeroGridPreferences({ bracket });
  };

  /**
   * FR-003: só depois desta confirmacao a feature fica habilitada para escrever.
   *
   * O mecanismo é `heroGridSource`: sem ele o construtor do espelho recusa
   * (`SOURCE_INDEX_GONE`), então nenhuma escrita é possivel antes daqui. Por isso a origem
   * escolhida no `<select>` só é persistida neste ponto, e nao no `onChange`.
   */
  const handleHgConfirm = async () => {
    if (!hgSourceOption || !hgGridPath) return;
    const source: ConfigRef = { index: hgSourceOption.index, name: hgSourceOption.name };

    setHgBusy(true);
    setHgError(null);
    try {
      await saveHeroGridPreferences({
        enabled: true,
        steamId3: hgSteamId3,
        gridFilePath: hgManualPathSaved.length > 0 ? hgManualPathSaved : null,
        source,
        // C-8: o nome DESEJADO é persistido em `heroGridMirrorName`, chave propria. Sem isso
        // ele valeria so na primeira sincronizacao (a que sai deste clique) e as automaticas
        // cairiam no default de N-5, trocando o nome do layout nas costas do jogador. Nao vai
        // para `heroGridMirror.name`, que é o ultimo nome VISTO no arquivo: um nome ausente do
        // disco ali seria lido como rename (N-3) e descartaria a escolha.
        mirrorName: hgEffectiveMirrorName.trim().length > 0 ? hgEffectiveMirrorName.trim() : null,
        criterion: hgCriterion,
        bracket: hgBracket,
      });
      setHgSavedSource(source);
      setHgConfirmOpen(false);
      setHgNotice('heroGridConfirmedNotice');
      // A tela nao escreve arquivo. Quem grava é o fluxo de escrita (T032/T037), com backup
      // byte a byte, escrita atomica e a guarda de igualdade profunda do main.
      await onHeroGridSyncRequest?.({ path: hgGridPath, source, mirrorName: hgEffectiveMirrorName });
    } catch (err) {
      setHgError(err instanceof Error ? err.message : String(err));
    } finally {
      setHgBusy(false);
    }
  };

  /**
   * Caminho do arquivo para uma acao que o jogador clicou (FR-004: restauracao continua
   * disponivel depois de desmarcar).
   *
   * Só aqui a listagem de contas roda com a feature desligada, e é legitimo: C-3 proibe
   * codigo de arquivo AUTOMATICO com a opcao desmarcada, nao a acao que o jogador pediu.
   */
  const resolveHgPathForAction = async (): Promise<string | null> => {
    if (hgGridPath) return hgGridPath;
    if (hgManualPathSaved.length > 0) return hgManualPathSaved;

    const res = await listAccounts();
    if (!res.success) {
      setHgError(res.error);
      return null;
    }
    setHgAccounts(res.data);
    const chosen = preselectAccount(res.data, hgSteamId3);
    if (!chosen) return null;
    setHgSteamId3(chosen.steamId3);
    return chosen.gridFilePath;
  };

  const handleHgListBackups = async () => {
    setHgBusy(true);
    setHgError(null);
    setHgNotice(null);
    try {
      const path = await resolveHgPathForAction();
      if (!path) {
        setHgBackups([]);
        return;
      }
      const res = await listBackups({ path });
      if (res.success) {
        setHgBackups(res.data);
      } else {
        setHgBackups(null);
        setHgError(res.error);
      }
    } finally {
      setHgBusy(false);
    }
  };

  const handleHgRestoreLatest = async () => {
    setHgBusy(true);
    setHgError(null);
    setHgNotice(null);
    try {
      const path = await resolveHgPathForAction();
      if (!path) return;
      // Sem `backupPath`: o main restaura o backup mais recente que ele mesmo criou.
      const res = await restoreBackup({ path });
      if (res.success) {
        setHgNotice('heroGridRestoreDone');
      } else {
        setHgError(res.error);
      }
    } finally {
      setHgBusy(false);
    }
  };

  const handleHgRemoveMirror = async () => {
    if (!onHeroGridRemoveMirror) return;
    setHgBusy(true);
    setHgError(null);
    setHgNotice(null);
    try {
      await onHeroGridRemoveMirror();
      setHgNotice('heroGridMirrorRemoved');
    } catch (err) {
      setHgError(err instanceof Error ? err.message : String(err));
    } finally {
      setHgBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-card rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl bg-[#0f1522] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#101726] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{t('settingsTitle')}</h3>
              <p className="text-[11px] text-slate-400">{t('settingsSubtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Language Selection Setting */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('languageSetting')}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('pt-BR')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'pt-BR'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇧🇷 Português (Brasil)</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en-US')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'en-US'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇺🇸 English (US)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">{t('languageDesc')}</p>
          </div>

          {/* STRATZ API Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>{t('stratzApiKey')}</span>
                {apiKey ? (
                  <span className="text-[10px] text-emerald-400 font-normal">{t('activeShort')}</span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-normal">{t('apiKeyRequired')}</span>
                )}
              </label>

              <div className="flex items-center gap-2">
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{t('howToGetKey')}</span>
                  </button>
                )}
                <a
                  href="https://stratz.com/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>stratz.com/api</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={t('stratzTokenPlaceholder')}
              className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono transition"
            />
            <p className="text-[10px] text-slate-400">
              {t('stratzApiKeyDesc')}
            </p>

            {/* Privacy Disclaimer Card */}
            <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-[11px] text-slate-300 leading-relaxed mt-2">
              <strong className="text-cyan-300 font-bold block mb-0.5">{t('privacyDisclaimerTitle')}</strong>
              {t('privacyDisclaimerText')}
            </div>
          </div>

          {/* Steam Account ID / Vanity URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('steamAccount')}</span>
            </label>

            <input
              type="text"
              value={steamInput}
              onChange={(e) => setSteamInput(e.target.value)}
              placeholder={t('steamAccountPlaceholder')}
              className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono transition"
            />

            {resolveError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                {resolveError}
              </div>
            )}
            <p className="text-[10px] text-slate-400">{t('steamAccountDesc')}</p>
          </div>

          {/* Quick Profiles from History & Favorites */}
          {profileHistory && profileHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('quickProfiles')}</span>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-0.5">
                {profileHistory.slice(0, 8).map((p) => {
                  const isSelected = steamInput === p.steamAccountId;
                  return (
                    <button
                      key={p.steamAccountId}
                      type="button"
                      onClick={() => loadDemoPreset(p.steamAccountId)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm'
                          : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                      title={`ID: ${p.steamAccountId}`}
                    >
                      {p.isFavorite ? (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[120px]">{p.name || p.steamAccountId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hero Grid Mirror Layout (specs/001-meta-hero-grid) */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('heroGridSetting')}</span>
                </label>
                <p className="text-[10px] text-slate-400">{t('heroGridDesc')}</p>
              </div>

              {/* FR-001: DESMARCADO por padrao — em instalacao nova e em atualizacao. */}
              <button
                type="button"
                role="switch"
                aria-checked={hgEnabled}
                onClick={() => handleHgToggle(!hgEnabled)}
                className={`shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 ${
                  hgEnabled
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${hgEnabled ? 'bg-cyan-400' : 'bg-slate-600'}`}
                />
                <span>{t('heroGridEnableLabel')}</span>
              </button>
            </div>

            {/* Modo browser: o bloco aparece, mas dizendo que NAO escreve layout aqui. */}
            {!gridFileAccess && (
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{t('heroGridBrowserModeNotice')}</span>
              </div>
            )}

            {!hgEnabled && !hgShowDisabledPanel && (
              <p className="text-[10px] text-slate-500">{t('heroGridDisabledHint')}</p>
            )}

            {hgLoading && (
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>{t('heroGridLoading')}</span>
              </div>
            )}

            {hgEnabled && gridFileAccess && (
              <div className="space-y-3">
                {/* Conta Steam — FR-005 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('heroGridAccountLabel')}</span>
                  </label>

                  {hgAccounts.length === 0 ? (
                    <p className="text-[10px] text-slate-400">{t('heroGridAccountNone')}</p>
                  ) : (
                    <select
                      value={hgSteamId3 ?? ''}
                      onChange={(e) => handleHgAccountChange(e.target.value)}
                      className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 transition"
                    >
                      {hgAccounts.map((candidate) => (
                        <option key={candidate.steamId3} value={candidate.steamId3}>
                          {candidate.gridFileExists
                            ? t('heroGridAccountOptionWithGrid', { id: candidate.steamId3 })
                            : t('heroGridAccountOptionWithoutGrid', { id: candidate.steamId3 })}
                          {candidate.isConfiguredProfile
                            ? ` · ${t('heroGridAccountConfigured')}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-400">{t('heroGridAccountDesc')}</p>

                  {/* I-27: arquivo ausente é estado APRESENTAVEL, nao erro. */}
                  {hgGridFileExists === false && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      {t('heroGridNoFileHint')}
                    </div>
                  )}
                </div>

                {/* Caminho manual — FR-006 (T034) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('heroGridManualPathLabel')}</span>
                  </label>
                  <input
                    type="text"
                    value={hgManualPath}
                    onChange={(e) => setHgManualPath(e.target.value)}
                    onBlur={handleHgManualPathCommit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleHgManualPathCommit();
                      }
                    }}
                    placeholder={t('heroGridManualPathPlaceholder')}
                    className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono transition"
                  />
                  {/* Checagem de FORMATO, só para retorno imediato. A guarda de verdade (S-1)
                      é a do processo main, em `electron/heroGrid/pathGuard.cjs`. */}
                  {!hgManualPathLooksValid && (
                    <p className="text-[10px] text-amber-300">{t('heroGridManualPathFormatWarning')}</p>
                  )}
                  <p className="text-[10px] text-slate-400">{t('heroGridManualPathDesc')}</p>
                </div>

                {/* Layout de origem — FR-005a, identidade por POSICAO (N-1) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('heroGridSourceLabel')}</span>
                  </label>

                  {hgLayouts.length === 0 ? (
                    <p className="text-[10px] text-slate-400">{t('heroGridNoLayouts')}</p>
                  ) : (
                    <select
                      value={hgSourceIndex === null ? '' : String(hgSourceIndex)}
                      onChange={(e) => handleHgSourceChange(e.target.value)}
                      className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 transition"
                    >
                      <option value="">{t('heroGridSourcePlaceholder')}</option>
                      {hgLayouts.map((option) => (
                        // `value` é o INDEX: nome nunca identifica layout. A posicao e a
                        // quantidade de grupos vao no rotulo justamente para dois layouts
                        // homonimos ficarem distinguiveis na lista.
                        <option key={option.index} value={String(option.index)}>
                          {option.name
                            ? t('heroGridLayoutOption', {
                                name: option.name,
                                position: option.index + 1,
                                groups: option.groupCount,
                              })
                            : t('heroGridLayoutOptionUnnamed', {
                                position: option.index + 1,
                                groups: option.groupCount,
                              })}
                        </option>
                      ))}
                    </select>
                  )}

                  {hgLayouts.some((option) => option.isNameAmbiguous) && (
                    <p className="text-[10px] text-amber-300">{t('heroGridDuplicateNameHint')}</p>
                  )}

                  {/* N-4: posicao guardada sumiu. Pede nova origem, sem adivinhar por nome. */}
                  {hgSavedSource && !findLayoutOption(hgLayouts, hgSavedSource.index) && hgLayouts.length > 0 && (
                    <p className="text-[10px] text-rose-300">{t('heroGridSourceGoneWarning')}</p>
                  )}

                  <p className="text-[10px] text-slate-400">{t('heroGridSourceDesc')}</p>
                </div>

                {/* Nome do espelho — N-5 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('heroGridMirrorNameLabel')}</span>
                  </label>
                  <input
                    type="text"
                    value={hgMirrorNameTouched ? hgMirrorName : hgEffectiveMirrorName}
                    onChange={(e) => {
                      setHgMirrorNameTouched(true);
                      setHgMirrorName(e.target.value);
                    }}
                    // Commit em blur/Enter, nao a cada tecla: gravar por caractere seria um
                    // IPC por tecla. Depois do aceite de FR-003 o nome ja esta persistido, e
                    // uma edicao posterior tem de chegar as sincronizacoes automaticas — senao
                    // a proxima delas renomearia o layout de volta ao default (C-8).
                    onBlur={() => {
                      if (!hgEnabled) return;
                      const typed = hgMirrorName.trim();
                      void saveHeroGridPreferences({ mirrorName: typed.length > 0 ? typed : null });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition"
                  />
                  <p className="text-[10px] text-slate-400">{t('heroGridMirrorNameDesc')}</p>
                </div>

                {/* FR-003: confirmacao explicita ANTES da primeira escrita */}
                {hgConfirmOpen ? (
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                    <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t('heroGridConfirmTitle')}</span>
                    </div>
                    <ul className="text-[11px] text-slate-300 leading-relaxed space-y-1 list-disc pl-4">
                      <li>{t('heroGridConfirmAppend', { mirror: hgEffectiveMirrorName })}</li>
                      <li>{t('heroGridConfirmSourceUntouched', { source: hgSourceOption ? hgSourceOption.name : '' })}</li>
                      <li>{t('heroGridConfirmBackup')}</li>
                    </ul>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={hgBusy}
                        onClick={handleHgConfirm}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold transition disabled:opacity-50"
                      >
                        {t('heroGridConfirmAccept')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHgConfirmOpen(false)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white transition"
                      >
                        {t('heroGridConfirmDecline')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={!hgSourceOption || !hgGridPath || hgBusy}
                      onClick={() => setHgConfirmOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t('heroGridEnableWriteButton')}</span>
                    </button>

                    {hgSavedSource && findLayoutOption(hgLayouts, hgSavedSource.index) && (
                      <p className="text-[10px] text-emerald-400">
                        {t('heroGridReadyLabel', {
                          name: hgSavedSource.name,
                          position: hgSavedSource.index + 1,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FR-004: painel de desativacao */}
            {hgShowDisabledPanel && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-200">
                  {t('heroGridDisabledTitle')}
                </div>
                <p className="text-[11px] text-slate-300">{t('heroGridDisabledBody')}</p>
                {/* A garantia mais importante da feature, dita na tela. */}
                <p className="text-[11px] text-emerald-300 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{t('heroGridSourceUntouched')}</span>
                </p>

                {hgMirror ? (
                  <p className="text-[11px] text-slate-300">
                    {t('heroGridMirrorStillThere', {
                      name: hgMirror.name,
                      position: hgMirror.index + 1,
                    })}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">{t('heroGridNoMirrorYet')}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {hgMirror && (
                    <button
                      type="button"
                      // Remover é uma ESCRITA e mora no fluxo de escrita (T037). Sem o
                      // gancho, o botao fica desabilitado dizendo onde a acao esta — nao
                      // finge que removeu.
                      disabled={!onHeroGridRemoveMirror || !gridFileAccess || hgBusy}
                      onClick={handleHgRemoveMirror}
                      title={!onHeroGridRemoveMirror ? t('heroGridRemoveMirrorUnavailable') : undefined}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('heroGridRemoveMirror')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!gridFileAccess || hgBusy}
                    onClick={handleHgListBackups}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('heroGridBackupsCheck')}</span>
                  </button>

                  {hgBackups && hgBackups.length > 0 && (
                    <button
                      type="button"
                      disabled={!gridFileAccess || hgBusy}
                      onClick={handleHgRestoreLatest}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t('heroGridRestoreLatest')}</span>
                    </button>
                  )}
                </div>

                {hgBackups && (
                  <p className="text-[10px] text-slate-400">
                    {hgBackups.length === 0
                      ? t('heroGridBackupsNone')
                      : t('heroGridBackupsFound', {
                          count: hgBackups.length,
                          date: new Date(
                            Math.max(...hgBackups.map((entry) => entry.at))
                          ).toLocaleString(language),
                        })}
                  </p>
                )}

                {!onHeroGridRemoveMirror && hgMirror && (
                  <p className="text-[10px] text-slate-500">{t('heroGridRemoveMirrorUnavailable')}</p>
                )}
              </div>
            )}

            {/* Criterio de ordenacao — FR-030 / FR-031 (T063) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('heroGridCriterionLabel')}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CRITERION_ORDER.map((criterion) => (
                  <button
                    key={criterion}
                    type="button"
                    onClick={() => handleHgCriterionChange(criterion)}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition ${
                      hgCriterion === criterion
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {t(CRITERION_LABEL_KEYS[criterion])}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">{t(CRITERION_DESC_KEYS[hgCriterion])}</p>
            </div>

            {/* Ranque de referencia — FR-033, com a honestidade de FR-020 / I-13 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('heroGridBracketLabel')}</span>
              </label>
              <select
                value={hgBracket === null ? BRACKET_AUTO : hgBracket}
                onChange={(e) => handleHgBracketChange(e.target.value)}
                className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 transition"
              >
                <option value={BRACKET_AUTO}>{t('heroGridBracketAuto')}</option>
                {BRACKET_ORDER.map((bracket) => (
                  <option key={bracket} value={bracket}>
                    {t(BRACKET_LABEL_KEYS[bracket])}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">{t('heroGridBracketDesc')}</p>
              {/* FR-020 / I-13: ranque que a fonte nao segmenta cai em "media geral". A tela
                  NUNCA pode dizer "no seu ranque" com numero geral. */}
              <p className="text-[10px] text-amber-300">{t('heroGridBracketFallbackNote')}</p>
            </div>

            {hgNotice && (
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{t(hgNotice)}</span>
              </div>
            )}

            {hgError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] break-words">
                {hgError}
              </div>
            )}
          </div>

          {/* Auto Updater & Version Section */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-slate-400">
                <span>
                  {t('appVersion')}: <strong className="text-slate-200">v{appVersion}</strong>
                </span>
                <span className="hidden sm:inline text-slate-700">·</span>
                <span title={t('gamePatchTooltip')}>
                  {t('gamePatch')}: <strong className="text-cyan-300">{dotaPatch}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdate}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-cyan-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>{t('checkForUpdates')}</span>
              </button>
            </div>

            {updateStatusText && (
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 flex items-center gap-2">
                <DownloadCloud className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{updateStatusText}</span>
              </div>
            )}
          </div>

          {/* Footer Save Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-slate-950" />
                  <span>{t('settingsSavedAlert')}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('saveSettings')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
