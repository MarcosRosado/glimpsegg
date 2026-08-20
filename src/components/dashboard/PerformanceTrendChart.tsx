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

interface PerformanceTrendChartProps {
  matches: PlayerMatchSummary[];
  onSelectMatch?: (matchId: string) => void;
}

type TrendMetric = 'IMP' | 'WINRATE' | 'GPM';

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({ matches, onSelectMatch }) => {
  const { t } = useLanguage();
  const [matchCountRange, setMatchCountRange] = useState<25 | 50 | 100>(25);
  const [metric, setMetric] = useState<TrendMetric>('IMP');

  const trendData = useMemo(() => {
    // Reverse matches so oldest is on left and newest is on right
    const selectedMatches = matches.slice(0, matchCountRange).reverse();

    let cumulativeWins = 0;
    let rollingImpSum = 0;

    return selectedMatches.map((m, idx) => {
      if (m.isVictory) cumulativeWins++;
      rollingImpSum += m.imp || 0;

      const windowSize = Math.min(5, idx + 1);
      const recentSlice = selectedMatches.slice(Math.max(0, idx - windowSize + 1), idx + 1);
      const rollingAvgImp = Math.round(recentSlice.reduce((s, x) => s + (x.imp || 0), 0) / windowSize);
      const cumulativeWinRate = Math.round((cumulativeWins / (idx + 1)) * 100);

      return {
        index: idx + 1,
        matchId: m.matchId,
        heroId: m.heroId,
        isVictory: m.isVictory,
        imp: m.imp || 0,
        rollingAvgImp,
        cumulativeWinRate,
        goldPerMinute: m.goldPerMinute,
        experiencePerMinute: m.experiencePerMinute,
        kda: m.kda,
      };
    });
  }, [matches, matchCountRange]);

  const avgMetricValue = useMemo(() => {
    if (trendData.length === 0) return 0;
    if (metric === 'IMP') {
      return Math.round(trendData.reduce((s, d) => s + d.imp, 0) / trendData.length);
    }
    if (metric === 'WINRATE') {
      const wins = trendData.filter((d) => d.isVictory).length;
      return Math.round((wins / trendData.length) * 100);
    }
    return Math.round(trendData.reduce((s, d) => s + d.goldPerMinute, 0) / trendData.length);
  }, [trendData, metric]);

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
              {t('rollingAvg')}: {metric === 'IMP' && (avgMetricValue >= 0 ? `+${avgMetricValue} IMP` : `${avgMetricValue} IMP`)}
              {metric === 'WINRATE' && `${avgMetricValue}% WR`}
              {metric === 'GPM' && `${avgMetricValue} Avg GPM`}
            </span>
          </div>
        </div>

        {/* Control Pill Groups */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setMetric('IMP')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                metric === 'IMP' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>{t('metricImp')}</span>
            </button>
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
            <button
              onClick={() => setMatchCountRange(25)}
              className={`px-2 py-1 rounded transition ${
                matchCountRange === 25 ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('trend25')}
            </button>
            <button
              onClick={() => setMatchCountRange(50)}
              className={`px-2 py-1 rounded transition ${
                matchCountRange === 50 ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('trend50')}
            </button>
            <button
              onClick={() => setMatchCountRange(100)}
              className={`px-2 py-1 rounded transition ${
                matchCountRange === 100 ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('trend100')}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* IMP Gradient */}
              <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
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
            <YAxis stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} domain={metric === 'WINRATE' ? [0, 100] : ['auto', 'auto']} />

            {metric === 'IMP' && <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />}
            {metric === 'WINRATE' && <ReferenceLine y={50} stroke="#64748b" strokeDasharray="2 2" />}

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0f172a] border border-slate-700 px-3 py-2 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between gap-4 font-sans font-bold">
                        <span className="text-slate-200">Match #{d.index}</span>
                        <span className={d.isVictory ? 'text-emerald-400' : 'text-rose-400'}>
                          {d.isVictory ? 'Victory' : 'Defeat'}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        IMP Rating: <strong className={d.imp >= 0 ? 'text-amber-400' : 'text-rose-400'}>{d.imp >= 0 ? `+${d.imp}` : d.imp}</strong>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Rolling Avg: <strong className="text-slate-200">{d.rollingAvgImp >= 0 ? `+${d.rollingAvgImp}` : d.rollingAvgImp}</strong>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        GPM / XPM: {d.goldPerMinute} / {d.experiencePerMinute}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {metric === 'IMP' && (
              <>
                <Area
                  type="monotone"
                  dataKey="imp"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#impGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="rollingAvgImp"
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
