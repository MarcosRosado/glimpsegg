import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { PlayerMatchSummary } from '../../types/dota';
import { TrendingUp, Zap, Trophy, Coins, Activity } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { GLINT_THRESHOLDS, formatGlint, getGlintColor } from '../../utils/glint';
import { useGlintHint } from '../ui/GlintBadge';

interface PerformanceTrendChartProps {
  matches: PlayerMatchSummary[];
  onSelectMatch?: (matchId: string) => void;
  /** Dá para trazer mais partidas: as janelas maiores aparecem e o clique pede a carga. */
  canLoadMore?: boolean;
  onRequestMore?: () => void;
  /** Altura menor: na Conta o gráfico divide a tela com os totais (no Início ele ocupava meia tela). */
  compact?: boolean;
}

type TrendMetric = 'GLINT' | 'WINRATE' | 'GPM';

const RANGES: { size: 25 | 50 | 100; label: 'trend25' | 'trend50' | 'trend100' }[] = [
  { size: 25, label: 'trend25' },
  { size: 50, label: 'trend50' },
  { size: 100, label: 'trend100' },
];

const hasGlint = (g: number | null | undefined): g is number => typeof g === 'number' && Number.isFinite(g);

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({ matches, onSelectMatch, canLoadMore = false, onRequestMore, compact = false }) => {
  const { t } = useLanguage();
  const [rangeChoice, setMatchCountRange] = useState<25 | 50 | 100>(25);
  // A lista pode encolher (troca de conta): a janela escolhida nunca passa do que existe.
  const matchCountRange = rangeChoice > 25 && matches.length < rangeChoice ? 25 : rangeChoice;
  const glintHint = useGlintHint();
  const [selectedMetric, setMetric] = useState<TrendMetric>('GLINT');

  const trendData = useMemo(() => {
    // Reverse matches so oldest is on left and newest is on right
    const selectedMatches = matches.slice(0, matchCountRange).reverse();

    let cumulativeWins = 0;

    return selectedMatches.map((m, idx) => {
      if (m.isVictory) cumulativeWins++;

      // Media movel das ate 5 ultimas partidas, SO das que tem nota. Partida sem nota
      // fica `null` no ponto (o recharts interrompe a linha ali) — `|| 0` desenharia
      // um vale ate o chao da escala a cada partida sem tabela de percentil.
      const windowSize = Math.min(5, idx + 1);
      const recentGlints = selectedMatches
        .slice(Math.max(0, idx - windowSize + 1), idx + 1)
        .map((x) => x.glint)
        .filter(hasGlint);
      const rollingAvgGlint = recentGlints.length
        ? Math.round(recentGlints.reduce((s, g) => s + g, 0) / recentGlints.length)
        : null;
      const cumulativeWinRate = Math.round((cumulativeWins / (idx + 1)) * 100);

      return {
        index: idx + 1,
        matchId: m.matchId,
        heroId: m.heroId,
        isVictory: m.isVictory,
        glint: hasGlint(m.glint) ? m.glint : null,
        rollingAvgGlint,
        cumulativeWinRate,
        goldPerMinute: m.goldPerMinute,
        experiencePerMinute: m.experiencePerMinute,
        kda: m.kda,
      };
    });
  }, [matches, matchCountRange]);

  // Sem nenhuma partida com nota na janela, a metrica de Glint some (botao e grafico) e
  // a tela cai na taxa de vitoria — derivado a cada render, porque o estado inicial é
  // 'GLINT' e as notas chegam depois (ou nunca, se as tabelas de percentil falharem).
  const ratedGlints = useMemo(() => trendData.map((d) => d.glint).filter(hasGlint), [trendData]);
  const glintAvailable = ratedGlints.length > 0;
  const metric: TrendMetric = selectedMetric === 'GLINT' && !glintAvailable ? 'WINRATE' : selectedMetric;

  const avgMetricValue = useMemo(() => {
    if (trendData.length === 0) return 0;
    if (metric === 'GLINT') {
      return Math.round(ratedGlints.reduce((s, g) => s + g, 0) / ratedGlints.length);
    }
    if (metric === 'WINRATE') {
      const wins = trendData.filter((d) => d.isVictory).length;
      return Math.round((wins / trendData.length) * 100);
    }
    return Math.round(trendData.reduce((s, d) => s + d.goldPerMinute, 0) / trendData.length);
  }, [trendData, metric, ratedGlints]);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl bg-[#0b101a]">
      {/* Header with Title and Range Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('trendsTitle')}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {t('rollingAvg')}:{' '}
              {metric === 'GLINT' && (
                <span title={glintHint} className="cursor-help">
                  {t('glintAvgOfRated', { value: formatGlint(avgMetricValue), count: ratedGlints.length })}
                </span>
              )}
              {metric === 'WINRATE' && `${avgMetricValue}% WR`}
              {metric === 'GPM' && `${avgMetricValue} Avg GPM`}
            </span>
          </div>
        </div>

        {/* Control Pill Groups */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
            {glintAvailable && (
              <button
                onClick={() => setMetric('GLINT')}
                title={glintHint}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  metric === 'GLINT' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>{t('metricGlint')}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">{t('glintBeta')}</span>
              </button>
            )}
            <button
              onClick={() => setMetric('WINRATE')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                metric === 'WINRATE' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3 h-3" />
              <span>{t('metricWinrate')}</span>
            </button>
            <button
              onClick={() => setMetric('GPM')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                metric === 'GPM' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="w-3 h-3" />
              <span>{t('metricGpm')}</span>
            </button>
          </div>

          {/* Range Selector */}
          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
            {/* Só as janelas que a lista carregada preenche. Com 40 partidas, "100 jogos"
                desenhava as mesmas 40 com o rótulo de 100 — a 1.0 fazia isso. */}
            {RANGES.filter((r) => r.size === 25 || matches.length >= r.size || canLoadMore).map((r) => (
              <button
                key={r.size}
                onClick={() => {
                  setMatchCountRange(r.size);
                  // Janela maior que a lista: pede a carga; até ela chegar, o gráfico fica
                  // na janela que a lista preenche (nunca desenha 40 com o rótulo de 100).
                  if (matches.length < r.size) onRequestMore?.();
                }}
                className={`px-2 py-1 rounded transition ${
                  matchCountRange === r.size ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className={`${compact ? 'h-40' : 'h-56'} w-full pt-2`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Glint Gradient */}
              <linearGradient id="glintGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>

              {/* Winrate Gradient */}
              <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>

              {/* GPM Gradient */}
              <linearGradient id="gpmGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="index" stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} domain={metric === 'GPM' ? ['auto', 'auto'] : [0, 100]} />

            {/* O centro do Glint é `neutral` (48), nao 50 nem 0: a mediana medida fica
                abaixo do meio da escala (ver utils/glint.ts). */}
            {metric === 'GLINT' && <ReferenceLine y={GLINT_THRESHOLDS.neutral} stroke="#64748b" strokeDasharray="2 2" />}
            {metric === 'WINRATE' && <ReferenceLine y={50} stroke="#64748b" strokeDasharray="2 2" />}

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0f172a] border border-slate-700 px-3 py-2 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between gap-4 font-sans font-bold">
                        <span className="text-slate-200">#{d.index}</span>
                        <span className={d.isVictory ? 'text-emerald-400' : 'text-rose-400'}>
                          {d.isVictory ? t('win') : t('loss')}
                        </span>
                      </div>
                      {/* Partida sem nota: as duas linhas somem, em vez de mostrar 0. */}
                      {d.glint !== null && (
                        <div className="text-slate-300">
                          {t('glintExperimental')}: <strong className={getGlintColor(d.glint)}>{formatGlint(d.glint)}</strong>
                        </div>
                      )}
                      {d.rollingAvgGlint !== null && (
                        <div className="text-slate-400 text-[10px]">
                          {t('rollingAvg')}: <strong className="text-slate-200">{formatGlint(d.rollingAvgGlint)}</strong>
                        </div>
                      )}
                      <div className="text-slate-400 text-[10px]">
                        GPM / XPM: {d.goldPerMinute} / {d.experiencePerMinute}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {metric === 'GLINT' && (
              <>
                <Area
                  type="monotone"
                  dataKey="glint"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#glintGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="rollingAvgGlint"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                />
              </>
            )}

            {metric === 'WINRATE' && (
              <Area
                type="monotone"
                dataKey="cumulativeWinRate"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#wrGrad)"
              />
            )}

            {metric === 'GPM' && (
              <Area
                type="monotone"
                dataKey="goldPerMinute"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gpmGrad)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
