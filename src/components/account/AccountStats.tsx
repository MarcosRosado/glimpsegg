import React, { useEffect, useState } from 'react';
import { Sigma, Medal, PieChart, AlertTriangle } from 'lucide-react';
import {
  fetchAccountCounts,
  fetchAccountRecords,
  fetchAccountTotals,
  type AccountCountEntry,
  type AccountCounts,
  type AccountRecord,
  type AccountTotal,
  type AccountTotalField,
} from '../../services/openDotaAccount';
import { fetchPatchCatalog } from '../../services/openDotaProfile';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { formatDuration, matchModeKey, timeAgoText } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { cn } from '../../utils/cn';
import { EstimateChip } from '../ui/EstimateChip';
import { Skeleton, SkeletonCard, SkeletonRows } from '../ui/Skeleton';

/** Rótulo de cada campo de totais/recordes. Literais: o teste de chave órfã precisa enxergá-los. */
const FIELD_LABEL: Record<AccountTotalField, TranslationKey> = {
  kills: 'acctKills',
  deaths: 'acctDeaths',
  assists: 'acctAssists',
  gold_per_min: 'acctGpm',
  xp_per_min: 'acctXpm',
  last_hits: 'acctLastHits',
  denies: 'acctDenies',
  lane_efficiency_pct: 'acctLaneEfficiency',
  duration: 'acctDuration',
  level: 'acctLevel',
  hero_damage: 'acctHeroDamage',
  tower_damage: 'acctTowerDamage',
  hero_healing: 'acctHeroHealing',
  stuns: 'acctStuns',
  tower_kills: 'acctTowerKills',
  neutral_kills: 'acctNeutralKills',
  courier_kills: 'acctCourierKills',
  purchase_tpscroll: 'acctTpScrolls',
  purchase_ward_observer: 'acctObservers',
  purchase_ward_sentry: 'acctSentries',
  purchase_gem: 'acctGems',
  purchase_rapier: 'acctRapiers',
  pings: 'acctPings',
  actions_per_min: 'acctApm',
};

/** Campos que são taxa ou média por natureza: a SOMA deles não diz nada e não aparece. */
const RATE_FIELDS = new Set<AccountTotalField>(['gold_per_min', 'xp_per_min', 'lane_efficiency_pct', 'level', 'actions_per_min']);

/** `lane_role` crua da OpenDota (1 safe, 2 mid, 3 off, 4 selva). */
const LANE_ROLE_LABEL: Record<string, TranslationKey> = {
  '1': 'acctLaneSafe',
  '2': 'acctLaneMid',
  '3': 'acctLaneOff',
  '4': 'acctLaneJungle',
};

function useAsync<T>(fn: () => Promise<T | null>, deps: unknown[]): { data: T | null; loading: boolean; failed: boolean } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; failed: boolean }>({ data: null, loading: true, failed: false });
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, failed: false });
    void fn().then((data) => {
      if (alive) setState({ data, loading: false, failed: data === null });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const Card: React.FC<{ icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  icon,
  title,
  hint,
  children,
  className,
}) => (
  <section className={cn('glass-card rounded-2xl border border-slate-800 bg-[#0f1624] p-5 space-y-3', className)}>
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200" title={hint}>
      {icon}
      <span className={hint ? 'cursor-help' : undefined}>{title}</span>
    </h3>
    {children}
  </section>
);

/**
 * Totais, recordes e contagens da seção Conta (docs/PROPOSTA-V2.md §3.6).
 *
 * - Totais: média por partida e soma, com a AMOSTRA DE CADA LINHA — campo que só existe em
 *   replay analisado (eficiência de rota, stuns, pings) tem `n` muito menor que abates. Campo
 *   de taxa (GPM, XPM, nível) mostra só a média: somar GPM não diz nada.
 * - Recordes: uma chamada por campo, com cache de um dia no serviço; cada um abre a partida.
 * - Contagens: lado, rota registrada pela OpenDota (não é veredito de rota), modo e patch. O
 *   modo sai por `matchModeKey` SEM a fila (a contagem por modo não traz o lobby): "All Pick",
 *   nunca "casual" ou "ranqueado" no chute. Modo sem rótulo conhecido fica de fora.
 *
 * Cada bloco some sozinho se a chamada dele falhar — os outros seguem — e um aviso com
 * "tentar de novo" diz que faltou algo. Sem o aviso, a falha das três chamadas (o caso comum
 * sob limite de uso da OpenDota) deixava a seção em branco, igual a uma conta sem dado.
 */
export const AccountStats: React.FC<{
  steamAccountId: string;
  onOpenMatch: (matchId: string) => void;
  /** Cartão do topo da coluna direita (fila e ranque): as duas colunas ficam com altura parecida. */
  aside?: React.ReactNode;
}> = ({ steamAccountId, onOpenMatch, aside }) => {
  const { t, language } = useLanguage();
  const [attempt, setAttempt] = useState(0);
  const totals = useAsync<AccountTotal[]>(() => fetchAccountTotals(steamAccountId), [steamAccountId, attempt]);
  const records = useAsync<AccountRecord[]>(() => fetchAccountRecords(steamAccountId), [steamAccountId, attempt]);
  const counts = useAsync<AccountCounts>(() => fetchAccountCounts(steamAccountId), [steamAccountId, attempt]);
  const patches = useAsync(() => fetchPatchCatalog(), []);

  const fmt = (n: number, digits = 0) => n.toLocaleString(language, { maximumFractionDigits: digits });
  /** `sum` = soma da carreira; `avg` = média por partida; `record` = valor de uma partida. */
  const fmtValue = (field: AccountTotalField, v: number, kind: 'avg' | 'sum' | 'record') => {
    const isAverage = kind === 'avg';
    // Só a duração SOMADA vira horas ("250895:34" não se lê); média e recorde são de uma partida.
    if (field === 'duration') return kind === 'sum' ? t('acctHours', { h: fmt(v / 3600) }) : formatDuration(Math.round(v));
    if (field === 'lane_efficiency_pct') return `${fmt(v, 0)}%`;
    if (field === 'stuns') return `${fmt(v, 1)} s`;
    return fmt(v, isAverage ? 1 : 0);
  };
  const patchName = (key: string) => patches.data?.find((p) => String(p.id) === key)?.name ?? null;

  const anyLoading = totals.loading || records.loading || counts.loading;
  const nothing = !totals.data?.length && !records.data?.length && !counts.data;

  const countRow = (label: string, e: AccountCountEntry) => (
    <li key={label} className="flex items-center justify-between gap-3 text-xs" title={t('acctCountHint', { games: fmt(e.games), wins: fmt(e.wins) })}>
      <span className="text-slate-300 truncate">{label}</span>
      <span className="font-mono text-slate-400 shrink-0">
        {fmt(e.games)}
        {e.winRate !== null && (
          <span className={cn('ml-2 font-bold', e.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400')}>{fmt(e.winRate, 1)}%</span>
        )}
      </span>
    </li>
  );

  const anyFailed = !anyLoading && (totals.failed || records.failed || counts.failed);

  if (anyLoading && nothing) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SkeletonCard>
          <Skeleton className="h-3.5 w-40 mb-5" />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-1.5">
              <Skeleton className="h-3 w-28" />
              <div className="flex gap-6">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </SkeletonCard>
        <div className="space-y-6 min-w-0">
          {aside}
          <SkeletonCard>
            <Skeleton className="h-3.5 w-32 mb-5" />
            <SkeletonRows rows={5} />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  const hasTotals = !!totals.data?.some((row) => row.matches > 0);
  const totalsCard = hasTotals ? (
    <Card icon={<Sigma className="w-4 h-4 text-cyan-400" aria-hidden />} title={t('acctTotalsTitle')} hint={t('acctTotalsHint')}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
            <th className="py-1.5 pr-3 font-semibold" />
            <th className="py-1.5 pr-3 font-semibold text-right">{t('acctAverage')}</th>
            <th className="py-1.5 pr-3 font-semibold text-right">{t('acctTotal')}</th>
            <th className="py-1.5 font-semibold text-right">{t('acctSample')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Campo sem nenhuma partida (ex.: gem nunca comprada) some: "—" com amostra 0 não informa. */}
          {totals.data.filter((row) => row.matches > 0).map((row) => (
            <tr key={row.field} className="border-t border-slate-800/70">
              <td className="py-1.5 pr-3 text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  {t(FIELD_LABEL[row.field])}
                  {/* Mesma régua fixa de 4.948 de ouro aos 10 min que "Meu jogo" rotula. */}
                  {row.field === 'lane_efficiency_pct' && <EstimateChip hint={t('acctLaneEfficiencyHint')} />}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-slate-100">
                {row.average !== null ? fmtValue(row.field, row.average, 'avg') : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-slate-400">
                {RATE_FIELDS.has(row.field) ? '' : fmtValue(row.field, row.sum, 'sum')}
              </td>
              <td className="py-1.5 text-right font-mono text-slate-500" title={t('acctSampleHint', { n: fmt(row.matches) })}>
                {fmt(row.matches)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  ) : null;
  const recordsCard = records.data && records.data.length > 0 ? (
    <Card icon={<Medal className="w-4 h-4 text-amber-400" aria-hidden />} title={t('acctRecordsTitle')} hint={t('acctRecordsHint')}>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {records.data.map((r) => {
          const hero = getHero(r.heroId);
          return (
            <li key={r.field}>
              <button
                type="button"
                onClick={() => onOpenMatch(r.matchId)}
                className="w-full flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-cyan-500/40 px-2.5 py-2 text-left transition"
              >
                <img src={hero.avatarUrl} alt="" className="w-10 h-6 rounded object-cover border border-slate-700 shrink-0" onError={handleHeroImageError} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">{t(FIELD_LABEL[r.field])}</span>
                  <span className="block text-sm font-black text-slate-100 font-mono">{fmtValue(r.field, r.value, 'record')}</span>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {hero.displayName}
                    {r.startTime ? ` · ${timeAgoText(r.startTime, t)}` : ''}
                    {' · '}
                    <span className={r.won ? 'text-emerald-400' : 'text-rose-400'}>{r.won ? t('win') : t('loss')}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  ) : null;
  const countsCard = counts.data ? (
    <Card icon={<PieChart className="w-4 h-4 text-violet-400" aria-hidden />} title={t('acctCountsTitle')} hint={t('acctCountsHint')}>
      {/* Sempre na largura inteira: as quatro listas cabem lado a lado. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-4">
        {counts.data.is_radiant.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{t('acctBySide')}</div>
            <ul className="space-y-1">
              {counts.data.is_radiant.map((e) => countRow(e.key === '1' ? t('radiant') : t('dire'), e))}
            </ul>
          </div>
        )}
        {counts.data.lane_role.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 cursor-help" title={t('acctByLaneHint')}>
              {t('acctByLane')}
            </div>
            <ul className="space-y-1">
              {counts.data.lane_role
                .filter((e) => LANE_ROLE_LABEL[e.key])
                .map((e) => countRow(t(LANE_ROLE_LABEL[e.key]), e))}
            </ul>
          </div>
        )}
        {counts.data.game_mode.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{t('acctByMode')}</div>
            <ul className="space-y-1">
              {counts.data.game_mode
                .map((e) => ({ e, label: matchModeKey(e.key) }))
                .filter((x) => x.label)
                .slice(0, 5)
                .map(({ e, label }) => countRow(t(label!.key, label!.params), e))}
            </ul>
          </div>
        )}
        {counts.data.patch.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{t('acctByPatch')}</div>
            <ul className="space-y-1">
              {counts.data.patch.slice(0, 5).map((e) => countRow(patchName(e.key) ?? t('acctPatchId', { id: e.key }), e))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  ) : null;

  return (
    <div className="space-y-6">
    {anyFailed && (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1">{t('acctLoadError')}</span>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border border-rose-400/40 px-3 py-1.5 font-bold hover:bg-rose-500/20">
          {t('parseRetryButton')}
        </button>
      </div>
    )}
    {hasTotals ? (
      /* Totais (24 linhas) de um lado; fila e recordes do outro, que somam quase a mesma
         altura. As contagens descem para a largura inteira, com as quatro listas lado a lado.
         Medido em 1440 px (2026-11-20): com as contagens à direita sobravam ~300 px à
         esquerda; embaixo dos totais, ~400 px à direita. */
      <>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="min-w-0">{totalsCard}</div>
          <div className="space-y-6 min-w-0">
            {aside}
            {recordsCard}
          </div>
        </div>
        {countsCard}
      </>
    ) : (
      /* Sem totais (a `/totals` falha com frequência sob a OpenDota lenta, ou conta sem dado), a
         coluna esquerda ficava inteira vazia. Fila e recordes lado a lado, contagens na largura
         inteira. */
      <>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="min-w-0">{aside}</div>
          <div className="min-w-0">{recordsCard}</div>
        </div>
        {countsCard}
      </>
    )}
    </div>
  );
};
