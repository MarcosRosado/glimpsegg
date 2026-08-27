import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  Database,
  History,
  Info,
  LayoutGrid,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { getHero } from '../../constants/heroes';
import { useLanguage } from '../../context/LanguageContext';
import { HeroGridBlocker, UseHeroGridSyncResult } from '../../hooks/useHeroGridSync';
import type { TranslationKey } from '../../i18n/translations';
import type {
  HeroScore,
  SyncOutcome,
  SyncPhase,
  SyncRecord,
} from '../../types/heroGrid';
import { handleHeroImageError } from '../../utils/imageFallback';
import { CRITERION_LABEL, DAYS_SINCE_LABEL, metaSourceKey, NO_DATA_LABEL } from './labels';
import { Chip, LayoutRef, Notice } from './primitives';
import {
  describeDaysSince,
  formatRatioPercent,
  formatScoreValue,
  isMirrorStale,
  isPersonalApplied,
  isScoreDisplayable,
  sortScoresForDisplay,
} from '../../utils/heroGrid/tabFormat';

/**
 * Aba do layout espelho de herois (specs/001-meta-hero-grid, T035/T047/T058/T064).
 *
 * A tela é o unico lugar onde o jogador vê o que a feature vai escrever no arquivo dele
 * ANTES de escrever, e por isso ela é obrigada a ser chata em tres pontos que nao sao
 * decoracao de rodape:
 *
 * 1. **O winrate é o GERAL do heroi** (FR-034b). Nao ha como inferir a funcao de um grupo
 *    pelo nome, entao a ordem do grupo de suportes NAO é "melhores suportes". Sem esse
 *    aviso, o corte de escopo de FR-034 vira uma afirmacao falsa na cara do jogador.
 * 2. **O espelho é gerado** (FR-008f). Edicao manual nele é trabalho perdido na
 *    sincronizacao seguinte, e é melhor dizer antes.
 * 3. **Nenhum numero sem fonte e amostra** (FR-014), e "no seu ranque" só quando o bracket é
 *    realmente do jogador (FR-020 / I-13). Com `bracketIsPlayerSpecific === false` a tela
 *    diz "media geral" — a mesma regra que `ResolvedBracket.isPlayerSpecific` impoe no resto
 *    do app.
 *
 * Toda formatacao testavel mora em `utils/heroGrid/tabFormat.ts`, porque o vitest deste
 * projeto roda sem DOM e `.tsx` nao é testavel.
 */

export interface HeroGridTabProps {
  /**
   * A instancia de `useHeroGridSync` — o `App.tsx` a cria UMA vez e passa para ca e para o
   * `SettingsModal`.
   *
   * Por que a aba nao chama o hook ela mesma: o hook arma o timer de 5 min e guarda a trava
   * de escrita do renderer. Duas instancias seriam dois timers disputando a mesma
   * sincronizacao — a trava do main recusaria a segunda com `WRITE_IN_PROGRESS`, entao o
   * arquivo nunca corromperia, mas o jogador veria uma falha inventada pela propria UI e o
   * app gastaria duas rodadas de requisicao. Instancia unica no `App` resolve na origem, e
   * as regras de hook nao permitem "chamar so se ninguem passou".
   */
  sync: UseHeroGridSyncResult;
  /** Leva à tela de replica, que mostra o espelho gravado com os grupos nas posicoes do jogo. */
  onOpenMirror?: () => void;
}

/* ------------------------------------------------------------------ *
 * Tabelas enum -> chave i18n
 *
 * Sao `Record<..., TranslationKey>` com literais explicitos porque a convencao do projeto
 * proibe montar chave em runtime (`t(`prefixo${x}`)`) — o teste de chave orfa de
 * `i18n/translations.test.ts` só enxerga literais no codigo.
 * ------------------------------------------------------------------ */

const OUTCOME_LABEL: Record<SyncOutcome, TranslationKey> = {
  SUCCESS: 'heroGridOutcomeSuccess',
  PARTIAL: 'heroGridOutcomePartial',
  FAILURE: 'heroGridOutcomeFailure',
};

const PHASE_LABEL: Record<SyncPhase, TranslationKey> = {
  IDLE: 'heroGridPhaseIdle',
  DUE: 'heroGridPhaseDue',
  RUNNING: 'heroGridPhaseRunning',
  BACKOFF: 'heroGridPhaseBackoff',
  OFF: 'heroGridPhaseOff',
};

/** Um motivo de bloqueio, uma frase que diz o que fazer. Erro generico nao serve aqui. */
const BLOCKER_LABEL: Record<HeroGridBlocker, TranslationKey> = {
  DISABLED: 'heroGridBlockDisabled',
  BROWSER_MODE: 'heroGridBlockBrowserMode',
  NO_ACCOUNT: 'heroGridBlockNoAccount',
  NO_SOURCE: 'heroGridBlockNoSource',
  FILE_MISSING: 'heroGridBlockFileMissing',
  INVALID_JSON: 'heroGridBlockInvalidJson',
  NO_PERMISSION: 'heroGridBlockNoPermission',
  SOURCE_INDEX_GONE: 'heroGridBlockSourceIndexGone',
  NAME_COLLISION: 'heroGridBlockNameCollision',
  DOTA_RUNNING: 'heroGridBlockDotaRunning',
  RATE_LIMITED: 'heroGridBlockRateLimited',
  SOURCE_MUTATED: 'heroGridBlockSourceMutated',
  ALL_SOURCES_DOWN: 'heroGridBlockAllSourcesDown',
  WRITE_FAILED: 'heroGridBlockWriteFailed',
};

/**
 * Uma linha do ranking.
 *
 * A linha inteira existe para satisfazer FR-014: winrate, FONTE e AMOSTRA sempre juntos, e
 * as duas parcelas da nota (FR-030b) sempre visiveis. Quando a decomposicao nao vem, a nota
 * NAO aparece — a linha fica marcada como nao exibivel, e o heroi continua listado, porque
 * ele continua no espelho e esconder a linha esconderia esse fato.
 */
const HeroScoreRow: React.FC<{
  entry: HeroScore;
  position: number;
  bracketLabel: string;
}> = ({ entry, position, bracketLabel }) => {
  const { t } = useLanguage();
  const hero = getHero(entry.heroId);
  const meta = entry.meta;
  const personal = entry.personal;
  const breakdown = entry.breakdown;

  const displayable = isScoreDisplayable(entry);
  // Resolvido antes do JSX para nao precisar de cast dentro do `t()`.
  const metaKey = meta ? metaSourceKey(meta.source) : null;
  const noData = entry.score === null;
  const metaWinRate = meta ? formatRatioPercent(meta.winRate) : null;
  const personalWinRate = personal ? formatRatioPercent(personal.winRate) : null;
  const metaComponent = breakdown ? formatScoreValue(breakdown.metaComponent) : null;
  const personalComponent = breakdown ? formatScoreValue(breakdown.personalComponent) : null;
  const personalWeight = breakdown ? formatRatioPercent(breakdown.personalWeight, 0) : null;

  return (
    <div
      className={`rounded-xl p-3 border ${
        noData ? 'border-slate-800 bg-slate-900/30' : 'border-slate-800/80 bg-slate-900/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="w-7 text-right text-[11px] font-mono font-bold text-slate-500 shrink-0 pt-1">
          {noData ? '—' : position}
        </span>
        <img
          src={hero.iconUrl}
          alt={hero.displayName}
          title={hero.displayName}
          onError={handleHeroImageError}
          className="w-7 h-7 rounded-full border border-slate-700 object-cover shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-100">{hero.displayName}</span>
            {noData ? (
              <Chip muted>{t('heroGridNoData')}</Chip>
            ) : displayable ? (
              <span className="text-[11px] font-mono font-bold text-cyan-300">
                {t('heroGridScoreLabel')} {formatScoreValue(entry.score)}
              </span>
            ) : (
              <Chip muted title={t('heroGridScoreNotDisplayable')}>
                {t('heroGridScoreNotDisplayable')}
              </Chip>
            )}
          </div>

          {/* Sem dado: o MOTIVO, nunca um numero presumido. */}
          {noData && entry.noDataReason && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t(NO_DATA_LABEL[entry.noDataReason])}
            </p>
          )}

          {/* Winrate de meta — sempre com fonte, amostra e rotulo de ranque. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400">{t('heroGridMetaWinrate')}:</span>
            {meta && metaWinRate ? (
              <>
                <span className="text-[11px] font-mono font-bold text-slate-200">
                  {metaWinRate}
                </span>
                <Chip title={bracketLabel}>
                  {metaKey ? t(metaKey) : meta.source}
                  {' · '}
                  {t('coachSampleSize', { n: meta.matchCount })}
                </Chip>
                <Chip muted>{bracketLabel}</Chip>
              </>
            ) : (
              <span className="text-[11px] text-slate-500 italic">{t('heroGridNoData')}</span>
            )}
          </div>

          {/* Amostra pessoal por heroi (FR-032). */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400">{t('heroGridPersonalWinrate')}:</span>
            {personal && personalWinRate && personal.games > 0 ? (
              <>
                <span className="text-[11px] font-mono font-bold text-slate-200">
                  {personalWinRate}
                </span>
                <Chip muted>{t('heroGridPersonalGames', { n: personal.games })}</Chip>
              </>
            ) : (
              <span className="text-[11px] text-slate-500 italic">
                {t('heroGridPersonalNone')}
              </span>
            )}
          </div>

          {/* As duas parcelas da nota (FR-030b). Sem elas a nota acima nao é exibida. */}
          {breakdown && (
            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-800/80">
              <span className="text-[10px] font-mono text-slate-400">
                {t('heroGridMetaComponent')}: {metaComponent ?? t('heroGridNoData')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {t('heroGridPersonalComponent')}: {personalComponent ?? t('heroGridNoData')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {t('heroGridPersonalWeight')}: {personalWeight ?? t('heroGridNoData')}
              </span>
              {!isPersonalApplied(entry) && !noData && (
                <Chip muted>{t('heroGridPersonalNotApplied')}</Chip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Uma linha do historico (FR-036). */
const HistoryRow: React.FC<{ record: SyncRecord }> = ({ record }) => {
  const { t, language } = useLanguage();
  const used = (record.sourcesUsed || []).map((source) => {
    const key = metaSourceKey(source);
    return key ? t(key) : source;
  });
  const failed = (record.sourcesFailed || []).map((source) => {
    const key = metaSourceKey(source);
    return key ? t(key) : source;
  });
  const outcomeColor =
    record.outcome === 'SUCCESS'
      ? 'text-emerald-300'
      : record.outcome === 'PARTIAL'
        ? 'text-amber-300'
        : 'text-rose-300';

  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-[10px] font-mono text-slate-500 shrink-0 w-36">
        {new Date(record.at).toLocaleString(language)}
      </span>
      <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${outcomeColor}`}>
        {t(OUTCOME_LABEL[record.outcome])}
      </span>
      <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
        {used.length > 0 && (
          <span className="text-[10px] font-mono text-slate-400">
            {t('heroGridHistorySources')}: {used.join(', ')}
          </span>
        )}
        {failed.length > 0 && (
          <span className="text-[10px] font-mono text-rose-300/80">
            {t('heroGridHistoryFailed')}: {failed.join(', ')}
          </span>
        )}
        {record.heroesOrdered > 0 && (
          <span className="text-[10px] font-mono text-slate-500">
            {t('heroGridHistoryHeroes', { n: record.heroesOrdered })}
          </span>
        )}
        {record.structureChanged && <Chip muted>{t('heroGridHistoryStructureChanged')}</Chip>}
        {record.error && (
          <span className="text-[10px] font-mono text-slate-500 truncate">{record.error}</span>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * A aba
 * ------------------------------------------------------------------ */

export const HeroGridTab: React.FC<HeroGridTabProps> = ({ sync: grid, onOpenMirror }) => {
  const { t, language } = useLanguage();

  /**
   * FR-011: "adiar" é uma escolha do jogador, e ela tem de sobreviver na tela. Sem este
   * estado o banner do Dota rodando voltaria no proximo render como se ele nao tivesse
   * respondido nada.
   */
  const [dotaRunningPostponed, setDotaRunningPostponed] = useState(false);

  const {
    preferences,
    syncState,
    phase,
    freshness,
    isSyncing,
    blocker,
    blockerDetail,
    lastReport,
    scores,
    bracketIsPlayerSpecific,
    backups,
    fileAccessAvailable,
    syncNow,
    removeMirrorNow,
    restoreLatestBackup,
  } = grid;

  /**
   * I-13 / FR-020: "no seu ranque" SÓ quando o bracket é de fato o do jogador. Caindo em
   * 'ALL', a frase é "media geral". Reaproveita as chaves que `useBuildAdvice` já usa para
   * a mesma decisao — é a mesma afirmacao, e duas traducoes dela divergiriam com o tempo.
   */
  const bracketLabel = bracketIsPlayerSpecific
    ? t('coachBracketYours')
    : t('coachBracketGeneric');

  const ordered = useMemo(() => sortScoresForDisplay(scores), [scores]);
  const withoutData = useMemo(() => ordered.filter((entry) => entry.score === null).length, [
    ordered,
  ]);

  const days = describeDaysSince(freshness?.daysSinceLastSuccess ?? null);
  const stale = isMirrorStale(freshness?.daysSinceLastSuccess ?? null);
  const criterion = preferences?.criterion ?? 'COMBINED';
  /**
   * `recordSyncOutcome` grava em ordem cronologica CRESCENTE (registro novo no fim). A tela
   * mostra o mais recente primeiro, entao a copia sai invertida — `reverse()` em cima de
   * `slice()`, porque o array vem do estado do hook.
   */
  const history = useMemo(() => syncState?.history ?? [], [syncState]);
  const historyNewestFirst = useMemo(() => history.slice().reverse(), [history]);
  const lastRecord = history.length > 0 ? history[history.length - 1] : null;
  const outsideSource = lastReport?.outsideSource ?? [];
  const sourcesMissing = lastReport?.sourcesMissing ?? [];
  const sourcesUsed = lastReport?.sourcesUsed ?? [];

  // `{n}` só é consumido por `MANY`; as outras chaves ignoram o parametro.
  const daysText = t(DAYS_SINCE_LABEL[days.kind], { n: days.days });

  const translateSources = (list: string[]) =>
    list
      .map((source) => {
        const key = metaSourceKey(source);
        return key ? t(key) : source;
      })
      .join(', ');

  const showBlocker = blocker !== null && !(blocker === 'DOTA_RUNNING' && dotaRunningPostponed);

  return (
    <div className="space-y-6">
      {/* ---------- Cabecalho: identidade dos layouts + acoes ---------- */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0c121e] space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                {t('heroGridTabTitle')}
              </h3>
              <p className="text-xs text-slate-400">{t('heroGridTabSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenMirror && (
              <button
                type="button"
                onClick={onOpenMirror}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {t('heroGridMirrorOpenFromProfile')}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDotaRunningPostponed(false);
                void syncNow();
              }}
              disabled={isSyncing}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {isSyncing ? t('heroGridSyncing') : t('heroGridSyncNow')}
            </button>

            <button
              type="button"
              onClick={() => void removeMirrorNow()}
              disabled={isSyncing || !preferences?.mirror}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('heroGridRemoveMirror')}
            </button>

            <button
              type="button"
              onClick={() => void restoreLatestBackup()}
              disabled={isSyncing || backups.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                backups.length === 0
                  ? t('heroGridNoBackups')
                  : t('heroGridBackupsCount', { n: backups.length })
              }
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('heroGridRestoreBackup')}
            </button>
          </div>
        </div>

        {/* FR-035b: qual layout é a origem e qual é o espelho. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
          <LayoutRef
            label={t('heroGridSourceLayout')}
            configRef={preferences?.source ?? null}
            emptyLabel={t('heroGridSourceNone')}
          />
          <LayoutRef
            label={t('heroGridMirrorLayout')}
            configRef={preferences?.mirror ?? null}
            emptyLabel={t('heroGridMirrorNone')}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Chip muted>
            {t('heroGridCriterionLabel')}: {t(CRITERION_LABEL[criterion])}
          </Chip>
          <Chip muted>{t('heroGridBracketLabel', { bracket: bracketLabel })}</Chip>
          <Chip muted>{t(PHASE_LABEL[phase])}</Chip>
          <Chip muted>
            {backups.length === 0
              ? t('heroGridNoBackups')
              : t('heroGridBackupsCount', { n: backups.length })}
          </Chip>
        </div>
      </div>

      {/* ---------- T047: cabecalho de frescor ---------- */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t('heroGridFreshnessTitle')}
          </h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              {t('heroGridLastSuccess')}
            </div>
            <div className="text-xs font-mono text-slate-200">
              {syncState?.lastSuccessfulSyncAt
                ? new Date(syncState.lastSuccessfulSyncAt).toLocaleString(language)
                : t('heroGridNeverSynced')}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              {t('heroGridLastAttempt')}
            </div>
            <div className="text-xs font-mono text-slate-200">
              {syncState?.lastAttemptAt
                ? new Date(syncState.lastAttemptAt).toLocaleString(language)
                : t('heroGridNeverSynced')}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              {t('heroGridDaysSinceLabel')}
            </div>
            <div className={`text-xs font-mono font-bold ${stale ? 'text-amber-300' : 'text-slate-200'}`}>
              {daysText}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              {t('heroGridNextDue')}
            </div>
            <div className="text-xs font-mono text-slate-200">
              {freshness?.nextDueAt
                ? new Date(freshness.nextDueAt).toLocaleString(language)
                : t('heroGridNextDueUnknown')}
            </div>
          </div>
        </div>

        {/* Ultimo desfecho conhecido, com as fontes que entraram. */}
        {lastRecord && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {t('heroGridLastOutcome')}
            </span>
            <Chip muted>{t(OUTCOME_LABEL[lastRecord.outcome])}</Chip>
            {sourcesUsed.length > 0 && (
              <Chip muted>{t('heroGridSourcesUsed', { sources: translateSources(sourcesUsed) })}</Chip>
            )}
          </div>
        )}

        {/* FR-024a: espelho velho por app fechado nao pode ser silencioso. */}
        {stale && (
          <Notice
            tone="warn"
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            title={t('heroGridStaleTitle')}
          >
            {days.kind === 'NEVER'
              ? t('heroGridStaleNeverBody')
              : t('heroGridStaleBody', { days: daysText })}
          </Notice>
        )}
      </div>

      {/* ---------- Estado bloqueado: uma frase por motivo ---------- */}
      {showBlocker && (
        <Notice
          tone={blocker === 'DISABLED' || blocker === 'BROWSER_MODE' ? 'info' : 'danger'}
          icon={
            blocker === 'DISABLED' || blocker === 'BROWSER_MODE' ? (
              <Info className="w-4 h-4 text-slate-400" />
            ) : (
              <Ban className="w-4 h-4 text-rose-400" />
            )
          }
          title={
            blocker === 'BROWSER_MODE' ? t('heroGridBrowserModeTitle') : t('heroGridBlockedTitle')
          }
        >
          <p>{t(BLOCKER_LABEL[blocker])}</p>
          {blockerDetail && (
            <p className="mt-1 font-mono text-slate-500">
              {t('heroGridBlockerDetail', { detail: blockerDetail })}
            </p>
          )}

          {/* FR-011: gravar mesmo assim é escolha explicita; adiar é a saida oferecida. */}
          {blocker === 'DOTA_RUNNING' && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={() => void syncNow({ allowWhileDotaRunning: true })}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-[11px] font-bold transition disabled:opacity-50"
              >
                {t('heroGridDotaRunningConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setDotaRunningPostponed(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-[11px] font-bold transition"
              >
                {t('heroGridDotaRunningPostpone')}
              </button>
            </div>
          )}
        </Notice>
      )}

      {blocker === 'DOTA_RUNNING' && dotaRunningPostponed && (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-slate-400" />}
          title={t('heroGridPostponedTitle')}
        >
          {t('heroGridPostponedBody')}
        </Notice>
      )}

      {/* Modo browser: a escrita nao existe aqui, e isso é dito, nunca simulado. */}
      {!fileAccessAvailable && blocker !== 'BROWSER_MODE' && (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-slate-400" />}
          title={t('heroGridBrowserModeTitle')}
        >
          {t('heroGridBlockBrowserMode')}
        </Notice>
      )}

      {/* ---------- Avisos obrigatorios ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FR-034b: a ordem de um grupo NAO é ranking de funcao. */}
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridGeneralWinrateTitle')}
        >
          {t('heroGridGeneralWinrateBody')}
        </Notice>

        {/* FR-008f: edicao manual no espelho é trabalho perdido. */}
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-slate-400" />}
          title={t('heroGridManualEditTitle')}
        >
          {t('heroGridManualEditBody')}
        </Notice>
      </div>

      {/* FR-016: qual fonte faltou. */}
      {sourcesMissing.length > 0 && (
        <Notice
          tone="warn"
          icon={<Database className="w-4 h-4 text-amber-400" />}
          title={t('heroGridSourcesMissingTitle')}
        >
          {t('heroGridSourcesMissingBody', { sources: translateSources(sourcesMissing) })}
        </Notice>
      )}

      {/* FR-035b: espelho desatualizado em relacao à estrutura da origem. */}
      {lastReport?.structureChanged && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridStructureChangedTitle')}
        >
          {t('heroGridStructureChangedBody')}
        </Notice>
      )}

      {/* FR-035a: heroi do ranking fora da origem — listado, e NAO inserido no espelho. */}
      {outsideSource.length > 0 && (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-slate-400" />}
          title={t('heroGridOutsideSourceTitle')}
        >
          <p>{t('heroGridOutsideSourceBody', { n: outsideSource.length })}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {outsideSource.map((heroId) => {
              const hero = getHero(heroId);
              return (
                <span
                  key={heroId}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/60 text-slate-300"
                >
                  <img
                    src={hero.iconUrl}
                    alt={hero.displayName}
                    onError={handleHeroImageError}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  {hero.displayName}
                </span>
              );
            })}
          </div>
        </Notice>
      )}

      {/* ---------- T035/T058/T064: o ranking ---------- */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t('heroGridRankingTitle')}
            </h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ordered.length > 0 && (
              <Chip muted>{t('heroGridRankingCount', { n: ordered.length })}</Chip>
            )}
            {withoutData > 0 && (
              <Chip muted>{t('heroGridRankingWithoutData', { n: withoutData })}</Chip>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('heroGridRankingSubtitle')}
        </p>

        {ordered.length === 0 ? (
          <div className="rounded-xl p-4 border border-slate-800 bg-slate-900/40">
            <p className="text-xs text-slate-400">
              {fileAccessAvailable
                ? t('heroGridRankingEmpty')
                : t('heroGridRankingUnavailableBrowser')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ordered.map((entry, index) => (
              <HeroScoreRow
                key={entry.heroId}
                entry={entry}
                position={index + 1}
                bracketLabel={bracketLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- FR-036: historico ---------- */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t('heroGridHistoryTitle')}
            </h4>
          </div>
          <span className="text-[10px] text-slate-500">{t('heroGridHistoryLimit')}</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400">{t('heroGridHistoryEmpty')}</p>
        ) : (
          <div>
            {historyNewestFirst.map((record, index) => (
              <HistoryRow key={`${record.at}-${index}`} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
