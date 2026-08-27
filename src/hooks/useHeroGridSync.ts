import { useCallback, useEffect, useRef, useState } from 'react';

import {
  GridBackupEntry,
  HeroGridErrorCode,
  HeroGridFile,
  HeroGridPreferences,
  HeroScore,
  SyncFreshness,
  MetaSource,
  SyncOutcome,
  SyncPhase,
  SyncState,
} from '../types/heroGrid';
import {
  loadHeroGridPreferences,
  loadSyncState,
  saveHeroGridPreferences,
  saveSyncState,
} from '../utils/heroGrid/preferences';
import { buildMirror, removeMirror } from '../utils/heroGrid/mirrorBuilder';
import { MirrorGroupReport } from '../types/heroGrid';
import { rankHeroes } from '../utils/heroGrid/ranking';
import {
  openDotaSourceInput,
  resolveMetaBracket,
  resolveMetaWinrates,
} from '../utils/heroGrid/sourcePrecedence';
import {
  recordSyncOutcome,
  shouldSyncNow,
  syncFreshness,
  syncPhase,
} from '../utils/heroGrid/syncScheduler';
import { serializeHeroGridFile } from '../utils/heroGrid/valveJson';
import { fetchOpenDotaMetaWinrates } from '../services/heroGrid/openDotaWinrates';
import { fetchPersonalWinrates } from '../services/heroGrid/personalWinrates';
import { fetchStratzWinrates } from '../services/heroGrid/stratzWinrates';
import { RateLimitedError } from '../services/stratzHeroStats';
import {
  isHeroGridFileAccessAvailable,
  listAccounts,
  listBackups,
  readFile,
  restoreBackup,
  writeFile,
} from '../services/heroGrid/heroGridBridge';
import { getCachedGamePatch } from '../services/gameVersionService';
import { HEROES_MAP } from '../constants/heroes';

/**
 * Orquestracao da sincronizacao do layout espelho (specs/001-meta-hero-grid).
 *
 * Este hook é o UNICO lugar onde as pecas se encontram, e é de proposito o unico lugar que
 * lê o relogio: `syncScheduler.ts` é puro e recebe `now` por parametro, o que é o que torna
 * os casos de salto de relogio testaveis sem esperar 24h.
 *
 * A sequencia é sempre a mesma: ler o grid -> buscar as fontes -> ranquear -> construir o
 * espelho -> serializar -> gravar pela ponte. Nenhuma etapa decide nada sobre a proxima
 * fora dessa ordem, e a escrita é a ultima.
 */

/** Motivos de nao dar para sincronizar que a UI precisa distinguir para dizer a coisa certa. */
export type HeroGridBlocker =
  | 'DISABLED'
  | 'BROWSER_MODE'
  | 'NO_ACCOUNT'
  | 'NO_SOURCE'
  | 'FILE_MISSING'
  | 'INVALID_JSON'
  | 'NO_PERMISSION'
  | 'SOURCE_INDEX_GONE'
  | 'NAME_COLLISION'
  | 'DOTA_RUNNING'
  | 'RATE_LIMITED'
  | 'SOURCE_MUTATED'
  | 'ALL_SOURCES_DOWN'
  | 'WRITE_FAILED';

/**
 * Um grupo do espelho, como a aba precisa ver.
 *
 * Existe porque `perGroup` sozinho conta quantos herois foram ordenados, mas nao diz QUAIS
 * nem em que ordem — e T035 pede o ranking POR GRUPO. Sem isto a aba so conseguia mostrar
 * uma lista unica, perdendo justamente a estrutura que o espelho reproduz.
 */
export interface HeroGridGroupView {
  /** I-4a: a identidade é a posicao. Dois grupos podem ter o mesmo nome. */
  categoryIndex: number;
  categoryName: string;
  /** `hero_ids` na ORDEM do espelho — é o que o jogador vai ver no jogo. */
  heroIds: number[];
  ordered: number;
  withoutData: number;
}

export interface HeroGridSyncReport {
  outcome: SyncOutcome;
  /**
   * Fontes que contribuiram, e as que faltaram — o rotulo de FR-016.
   * `MetaSource[]`, nao `string[]`, para casar com `SyncRecord` e a aba nao precisar de
   * fallback para valor cru desconhecido.
   */
  sourcesUsed: MetaSource[];
  sourcesMissing: MetaSource[];
  heroesOrdered: number;
  structureChanged: boolean;
  /** FR-035a: herois do ranking fora do layout de origem. Informativo. */
  outsideSource: number[];
  /** Os bytes chegaram ao disco? `false` num relatorio existente = ordenado, mas recusado. */
  written: boolean;
  backupPath?: string;
}

export interface UseHeroGridSyncResult {
  preferences: HeroGridPreferences | null;
  syncState: SyncState | null;
  phase: SyncPhase;
  freshness: SyncFreshness | null;
  /** `true` enquanto uma sincronizacao roda. Trava do renderer (a do main é a garantia). */
  isSyncing: boolean;
  /** Ultimo motivo de bloqueio, para a UI explicar em vez de mostrar erro generico. */
  blocker: HeroGridBlocker | null;
  blockerDetail: string | null;
  lastReport: HeroGridSyncReport | null;
  /** Ranking exibido na aba — existe mesmo no modo browser, onde a escrita nao existe. */
  scores: HeroScore[];
  /**
   * O ranking POR GRUPO, na ordem do espelho. Preenchido assim que o espelho é construido,
   * ANTES da escrita — entao sobrevive a uma escrita recusada, que é justamente quando o
   * jogador mais precisa ver o que teria sido gravado.
   */
  groups: HeroGridGroupView[];
  bracketIsPlayerSpecific: boolean;
  backups: GridBackupEntry[];
  fileAccessAvailable: boolean;
  /** Dispara sincronizacao manual. `allowWhileDotaRunning` vem da confirmacao do jogador. */
  /** Limpa o aviso de bloqueio depois que o jogador o leu (ex.: "adiar" no Dota aberto). */
  clearBlocker: () => void;
  syncNow: (options?: {
    allowWhileDotaRunning?: boolean;
    /** C-8: nome desejado, quando o jogador acabou de escolher e ainda nao foi persistido. */
    mirrorName?: string | null;
  }) => Promise<void>;
  /** FR-008g: remover o espelho é uma ESCRITA — passa pelo mesmo backup e pela mesma guarda. */
  removeMirrorNow: (options?: { allowWhileDotaRunning?: boolean }) => Promise<void>;
  restoreLatestBackup: (backupPath?: string) => Promise<void>;
  refreshBackups: () => Promise<void>;
  reloadPreferences: () => Promise<void>;
}

/** T044: verificacao a cada 5 min, e nao um `setTimeout` de 24h. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Todos os hero_ids do layout de origem, sem repetir — a entrada do ranking. */
function heroIdsOf(file: HeroGridFile, sourceIndex: number): number[] {
  const config = file.configs[sourceIndex];
  if (!config) return [];
  const seen = new Set<number>();
  for (const category of config.categories || []) {
    for (const id of category.hero_ids || []) {
      if (typeof id === 'number') seen.add(id);
    }
  }
  return [...seen];
}

/**
 * Monta a visao por grupo a partir do espelho construido.
 *
 * Le as categorias do ESPELHO (nao da origem) porque é lá que os `hero_ids` ja estao na
 * ordem final — é literalmente o que o jogador vera no jogo.
 */
function groupViewsOf(
  mirrorFile: HeroGridFile,
  mirrorIndex: number,
  perGroup: MirrorGroupReport[],
): HeroGridGroupView[] {
  const config = mirrorFile.configs[mirrorIndex];
  if (!config) return [];
  return (config.categories || []).map((category, i) => {
    const report = perGroup[i];
    return {
      categoryIndex: i,
      categoryName: category.category_name,
      heroIds: [...(category.hero_ids || [])],
      ordered: report ? report.ordered : 0,
      withoutData: report ? report.withoutData : 0,
    };
  });
}

/** Mapeia o codigo da ponte/main no motivo que a UI sabe explicar. */
function blockerForCode(code: HeroGridErrorCode | undefined): HeroGridBlocker {
  switch (code) {
    case 'FILE_NOT_FOUND':
      return 'FILE_MISSING';
    case 'INVALID_JSON':
      return 'INVALID_JSON';
    case 'NO_PERMISSION':
      return 'NO_PERMISSION';
    case 'SOURCE_INDEX_GONE':
      return 'SOURCE_INDEX_GONE';
    case 'NAME_COLLISION':
      return 'NAME_COLLISION';
    case 'DOTA_RUNNING':
      return 'DOTA_RUNNING';
    case 'SOURCE_MUTATED':
      return 'SOURCE_MUTATED';
    case 'UNAVAILABLE':
      return 'BROWSER_MODE';
    default:
      return 'WRITE_FAILED';
  }
}

export function useHeroGridSync(
  apiKey?: string,
  steamAccountId?: string,
  profileTier?: number | null,
): UseHeroGridSyncResult {
  const [preferences, setPreferences] = useState<HeroGridPreferences | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [blocker, setBlocker] = useState<HeroGridBlocker | null>(null);
  const [blockerDetail, setBlockerDetail] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<HeroGridSyncReport | null>(null);
  const [scores, setScores] = useState<HeroScore[]>([]);
  const [groups, setGroups] = useState<HeroGridGroupView[]>([]);
  const [bracketIsPlayerSpecific, setBracketIsPlayerSpecific] = useState(false);
  const [backups, setBackups] = useState<GridBackupEntry[]>([]);

  /**
   * T046: trava de single-flight no renderer.
   *
   * É `useRef`, nao estado: um `setState` só vale no render seguinte, e duas chamadas no
   * mesmo tique passariam as duas pela checagem. A garantia real contra escrita concorrente
   * é a trava do main (`electron/heroGrid/gridFile.cjs`, E-5) — esta aqui evita gastar duas
   * rodadas de requisicao e evita a UI piscar dois estados de progresso.
   */
  const inFlight = useRef(false);
  const fileAccessAvailable = isHeroGridFileAccessAvailable();

  const clearBlocker = useCallback(() => {
    setBlocker(null);
    setBlockerDetail(null);
  }, []);

  const reloadPreferences = useCallback(async () => {
    const [prefs, state] = await Promise.all([loadHeroGridPreferences(), loadSyncState()]);
    setPreferences(prefs);
    setSyncState(state);
  }, []);

  useEffect(() => {
    void reloadPreferences();
  }, [reloadPreferences]);

  /** Resolve o caminho do arquivo: manual primeiro (FR-006), senao a conta detectada. */
  const resolveGridPath = useCallback(async (prefs: HeroGridPreferences): Promise<string | null> => {
    if (prefs.gridFilePath) return prefs.gridFilePath;
    const res = await listAccounts();
    if (!res.success) return null;
    const wanted = prefs.steamId3 || steamAccountId || '';
    const match = res.data.find((a) => a.steamId3 === String(wanted)) || res.data[0];
    return match ? match.gridFilePath : null;
  }, [steamAccountId]);

  const refreshBackups = useCallback(async () => {
    const prefs = preferences || (await loadHeroGridPreferences());
    if (!prefs.enabled || !fileAccessAvailable) return;
    const path = await resolveGridPath(prefs);
    if (!path) return;
    const res = await listBackups({ path });
    setBackups(res.success ? res.data : []);
  }, [preferences, fileAccessAvailable, resolveGridPath]);

  /** Persiste o desfecho. I-22: só `outcome !== 'FAILURE'` avanca o marcador de sucesso. */
  const persistOutcome = useCallback(
    async (outcome: SyncOutcome, now: number, details: Parameters<typeof recordSyncOutcome>[3]) => {
      const current = await loadSyncState();
      const next = recordSyncOutcome(current, outcome, now, details);
      await saveSyncState(next);
      setSyncState(next);
    },
    [],
  );

  const fail = useCallback(
    async (reason: HeroGridBlocker, detail: string | null, now: number, record = true) => {
      setBlocker(reason);
      setBlockerDetail(detail);
      if (record) {
        // I-23: falha nao escreve arquivo, e o registro sai sem material para alguem
        // reportar escrita a partir dele (`buildSyncRecord` zera os contadores).
        await persistOutcome('FAILURE', now, { error: detail || reason });
      }
    },
    [persistOutcome],
  );

  const runSync = useCallback(
    async (options: { allowWhileDotaRunning?: boolean; mirrorName?: string | null } = {}) => {
      if (inFlight.current) return;

      const prefs = await loadHeroGridPreferences();
      // I-20 / FR-002: desligada, nao lê arquivo e nao dispara requisicao. O `return` vem
      // antes de qualquer I/O de proposito — é o que SC-001 verifica.
      if (!prefs.enabled) {
        setBlocker('DISABLED');
        return;
      }
      if (!prefs.source) {
        setBlocker('NO_SOURCE');
        return;
      }

      inFlight.current = true;
      setIsSyncing(true);
      setBlocker(null);
      setBlockerDetail(null);
      const now = Date.now();

      try {
        const patch = getCachedGamePatch() || 'unknown';
        const bracket = resolveMetaBracket({
          preferredBracket: prefs.bracket,
          profileTier: profileTier ?? null,
        });
        setBracketIsPlayerSpecific(bracket.isPlayerSpecific);

        /**
         * As TRES buscas em paralelo, e isto importa de verdade.
         *
         * Medido: a `/heroStats` da OpenDota é 160 KB e responde em ~0,7s morna, mas ja foi
         * vista em 20s com o cache dela frio. Encadear as tres somaria esse pior caso ao das
         * outras duas e encostaria no teto de 30s de SC-009; em paralelo, a sincronizacao
         * custa ~a mais lenta, nao a soma.
         *
         * Nenhuma delas lanca por indisponibilidade — cada uma devolve estado, e é
         * `resolveMetaWinrates` que decide o desfecho. A unica excecao é `RateLimitedError`
         * (429), capturada aqui e virada em fonte com erro: retry em cima de rate limit de
         * chave compartilhada só piora a situacao do proprio usuario.
         */
        let rateLimited = false;
        const stratzPromise = fetchStratzWinrates(bracket.bracket, apiKey).catch((err) => {
          if (err instanceof RateLimitedError) rateLimited = true;
          return {
            status: 'ERROR' as const,
            rows: [],
            reason: err instanceof RateLimitedError ? 'RateLimitedError' : 'fetch',
          };
        });
        const [stratzOutcome, openDotaRows, personal] = await Promise.all([
          stratzPromise,
          fetchOpenDotaMetaWinrates(bracket.bracket),
          fetchPersonalWinrates(prefs.steamId3 || steamAccountId || null),
        ]);
        if (rateLimited) setBlocker('RATE_LIMITED');

        const resolution = resolveMetaWinrates({
          openDota: openDotaSourceInput(openDotaRows),
          stratz: stratzOutcome,
          patch,
          preferredBracket: prefs.bracket,
          profileTier: profileTier ?? null,
        });
        setBracketIsPlayerSpecific(resolution.bracket.isPlayerSpecific);

        // I-24 / FR-017: as duas fontes fora ⇒ FAILURE, e o arquivo NAO é tocado. A
        // checagem vem antes de qualquer leitura de grid — nao ha o que escrever.
        if (!resolution.shouldWrite) {
          await fail(
            'ALL_SOURCES_DOWN',
            resolution.unavailable.map((u) => `${u.source}:${u.reason}`).join(', '),
            now,
          );
          return;
        }

        // Modo browser: o ranking APARECE, e é o `quickstart.md` que exige isso — as duas
        // fontes funcionam por fetch direto, entao ha dado real para ordenar. O que nao
        // existe aqui é o arquivo, logo nao ha layout de origem: ranqueamos o catalogo
        // inteiro e a aba diz, sem rodeio, que neste modo nao grava layout.
        //
        // Ranquear o catalogo NAO é inventar dado: sao os mesmos winrates medidos, so sem o
        // recorte de um layout. O que seria invencao é fabricar grupos de origem que nao
        // foram lidos de arquivo nenhum — por isso `groups` fica vazio.
        if (!fileAccessAvailable) {
          setScores(
            rankHeroes({
              heroIds: Object.keys(HEROES_MAP).map(Number),
              criterion: prefs.criterion,
              meta: resolution.winrates,
              personal: personal || undefined,
            }),
          );
          setGroups([]);
          setBlocker('BROWSER_MODE');
          return;
        }

        const path = await resolveGridPath(prefs);
        if (!path) {
          await fail('NO_ACCOUNT', null, now, false);
          return;
        }

        const read = await readFile({ path });
        if (!read.success) {
          await fail(blockerForCode(read.code), read.error, now);
          return;
        }
        // L-1: arquivo ausente é estado apresentavel — "crie um grid no Dota primeiro" —
        // e o app NAO cria o arquivo.
        if (!read.data.exists || !read.data.file) {
          await fail('FILE_MISSING', null, now, false);
          return;
        }

        const file = read.data.file;
        const sourceConfig = file.configs[prefs.source.index];
        // N-4: posicao registrada sumiu. Avisar e pedir nova origem, sem adivinhar por nome.
        if (!sourceConfig) {
          await fail('SOURCE_INDEX_GONE', null, now, false);
          return;
        }

        const ranked = rankHeroes({
          heroIds: heroIdsOf(file, prefs.source.index),
          criterion: prefs.criterion,
          meta: resolution.winrates,
          personal: personal || undefined,
        });
        setScores(ranked);

        // C-8: o nome DESEJADO vem das preferencias (ou do override do aceite de FR-003),
        // nunca de `prefs.mirror.name` — esse é o ultimo nome VISTO no arquivo, e usa-lo aqui
        // faria a escolha do jogador ser lida como rename na sincronizacao seguinte (N-3).
        const built = buildMirror({
          file,
          source: prefs.source,
          mirror: prefs.mirror,
          scores: ranked,
          mirrorName: options.mirrorName ?? prefs.mirrorName,
        });
        if (!built.success) {
          await fail(blockerForCode(built.code), built.error, now, false);
          return;
        }

        // ANTES da escrita, de proposito: se a gravacao for recusada (Dota aberto, permissao,
        // guarda de imutabilidade), o jogador continua vendo exatamente o que teria sido
        // gravado. Esconder o resultado justamente no caminho recusado seria o pior momento.
        setGroups(groupViewsOf(built.data.file, built.data.mirror.index, built.data.perGroup));

        const heroesOrdered = built.data.perGroup.reduce((sum, g) => sum + g.ordered, 0);
        /**
         * O relatorio é montado aqui e vale para os dois desfechos. `written` diz se os bytes
         * chegaram ao disco — sem esse campo a aba nao consegue distinguir "ordenado e
         * gravado" de "ordenado e recusado", e FR-016/FR-035a desapareceriam exatamente no
         * caminho de recusa.
         */
        const report: HeroGridSyncReport = {
          outcome: resolution.outcome,
          sourcesUsed: resolution.sourcesUsed,
          sourcesMissing: resolution.sourcesMissing,
          heroesOrdered,
          structureChanged: built.data.structureChanged,
          outsideSource: built.data.outsideSource,
          written: false,
        };

        const write = await writeFile({
          path,
          content: serializeHeroGridFile(built.data.file),
          expectedSourceIndex: built.data.source.index,
          expectedSourceConfig: sourceConfig,
          expectedMirrorIndex: built.data.mirror.index,
          expectedConfigCount: built.data.file.configs.length,
          allowWhileDotaRunning: options.allowWhileDotaRunning === true,
        });
        if (!write.success) {
          setLastReport(report);
          await fail(blockerForCode(write.code), write.error, now, write.code !== 'DOTA_RUNNING');
          return;
        }

        // FR-008h / N-3: rename no jogo atualiza o `name` guardado; a identidade segue
        // sendo a posicao, entao nenhum espelho novo nasce por causa disso.
        await saveHeroGridPreferences({
          source: built.data.source,
          mirror: built.data.mirror,
        });

        setLastReport({ ...report, written: true, backupPath: write.data.backupPath });

        await persistOutcome(resolution.outcome, now, {
          sourcesUsed: resolution.sourcesUsed,
          sourcesFailed: resolution.sourcesFailed,
          heroesOrdered,
          structureChanged: built.data.structureChanged,
        });
        await reloadPreferences();
        await refreshBackups();
      } catch (err) {
        await fail('WRITE_FAILED', err instanceof Error ? err.message : String(err), now);
      } finally {
        inFlight.current = false;
        setIsSyncing(false);
      }
    },
    [
      apiKey,
      steamAccountId,
      profileTier,
      fileAccessAvailable,
      resolveGridPath,
      fail,
      persistOutcome,
      reloadPreferences,
      refreshBackups,
    ],
  );

  const syncNow = useCallback(
    (options?: { allowWhileDotaRunning?: boolean; mirrorName?: string | null }) =>
      runSync(options || {}),
    [runSync],
  );

  /**
   * FR-008g: remover o espelho passa pelo MESMO caminho de escrita — backup, atomicidade e
   * guarda de imutabilidade. Remover nao é acao de UI, é escrita no arquivo do jogador.
   */
  const removeMirrorNow = useCallback(
    async (options: { allowWhileDotaRunning?: boolean } = {}) => {
      if (inFlight.current) return;
      const prefs = await loadHeroGridPreferences();
      if (!prefs.mirror) {
        setBlocker('NO_SOURCE');
        return;
      }
      if (!fileAccessAvailable) {
        setBlocker('BROWSER_MODE');
        return;
      }

      inFlight.current = true;
      setIsSyncing(true);
      const now = Date.now();
      try {
        const path = await resolveGridPath(prefs);
        if (!path) {
          setBlocker('NO_ACCOUNT');
          return;
        }
        const read = await readFile({ path });
        if (!read.success || !read.data.exists || !read.data.file) {
          setBlocker(read.success ? 'FILE_MISSING' : blockerForCode(read.code));
          return;
        }

        const removal = removeMirror({
          file: read.data.file,
          mirror: prefs.mirror,
          source: prefs.source,
        });
        if (!removal.success) {
          setBlocker(blockerForCode(removal.code));
          setBlockerDetail(removal.error);
          return;
        }

        // A origem continua sendo a origem: `expectedSourceIndex` sai corrigido pela
        // remocao, porque tirar um config antes dela desloca o indice guardado.
        const sourceIdx = removal.data.source ? removal.data.source.index : -1;
        const write = await writeFile({
          path,
          content: serializeHeroGridFile(removal.data.file),
          expectedSourceIndex: sourceIdx,
          expectedSourceConfig: removal.data.file.configs[sourceIdx],
          expectedMirrorIndex: -1,
          expectedConfigCount: removal.data.file.configs.length,
          allowWhileDotaRunning: options.allowWhileDotaRunning === true,
        });
        if (!write.success) {
          setBlocker(blockerForCode(write.code));
          setBlockerDetail(write.error);
          return;
        }

        // C-4 ao contrario: aqui o espelho REALMENTE deixou de existir no arquivo, entao a
        // referencia sai. Desmarcar a feature é que preserva (`disableHeroGrid`).
        await saveHeroGridPreferences({
          mirror: null,
          source: removal.data.source || prefs.source,
        });
        await persistOutcome('SUCCESS', now, { heroesOrdered: 0, structureChanged: true });
        await reloadPreferences();
        await refreshBackups();
      } finally {
        inFlight.current = false;
        setIsSyncing(false);
      }
    },
    [fileAccessAvailable, resolveGridPath, persistOutcome, reloadPreferences, refreshBackups],
  );

  const restoreLatestBackup = useCallback(
    async (backupPath?: string) => {
      const prefs = await loadHeroGridPreferences();
      if (!fileAccessAvailable) {
        setBlocker('BROWSER_MODE');
        return;
      }
      const path = await resolveGridPath(prefs);
      if (!path) {
        setBlocker('NO_ACCOUNT');
        return;
      }
      const res = await restoreBackup({ path, backupPath });
      if (!res.success) {
        setBlocker(blockerForCode(res.code));
        setBlockerDetail(res.error);
        return;
      }
      await refreshBackups();
    },
    [fileAccessAvailable, resolveGridPath, refreshBackups],
  );

  /**
   * T044: o timer.
   *
   * Verificacao a cada 5 min + uma na montagem, em vez de um `setTimeout` de 24h. Timer
   * longo nao sobrevive de forma confiavel a hibernacao: a maquina suspensa por 8h acorda e
   * o timer ainda acha que falta um dia. O agendador é puro e decide por comparacao de
   * relogio, entao verificar de novo é barato e correto.
   *
   * A recuperacao de FR-023 (app reaberto depois de dias fechado) cai naturalmente na
   * verificacao de montagem — e é devido UMA vez, nao uma por dia perdido.
   */
  useEffect(() => {
    if (!preferences || !preferences.enabled) return;

    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      if (shouldSyncNow(syncState, Date.now(), true)) void runSync();
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [preferences, syncState, runSync]);

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const enabled = !!preferences?.enabled;
  const now = Date.now();

  return {
    preferences,
    syncState,
    phase: syncPhase(syncState, now, enabled, isSyncing),
    freshness: syncState ? syncFreshness(syncState, now, enabled) : null,
    isSyncing,
    blocker,
    blockerDetail,
    lastReport,
    scores,
    groups,
    bracketIsPlayerSpecific,
    backups,
    fileAccessAvailable,
    clearBlocker,
    syncNow,
    removeMirrorNow,
    restoreLatestBackup,
    refreshBackups,
    reloadPreferences,
  };
}
