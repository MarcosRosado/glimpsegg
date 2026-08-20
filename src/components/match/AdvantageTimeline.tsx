import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { AdvantagePoint } from '../../types/dota';
import { Coins, Zap, Shield } from 'lucide-react';
import { formatGold, formatSignedGold } from '../../utils/dotaFormatters';

interface AdvantageTimelineProps {
  timeline: AdvantagePoint[];
}

export const AdvantageTimeline: React.FC<AdvantageTimelineProps> = ({ timeline }) => {
  const [metric, setMetric] = useState<'GOLD' | 'XP' | 'BOTH'>('GOLD');

  // Compute max absolute value for balanced domain
  const maxGold = Math.max(...timeline.map((d) => Math.abs(d.goldAdvantage || 0)), 5000);
  const domainMax = Math.ceil(maxGold / 5000) * 5000;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl bg-[#111723]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Gold & Experience Advantage Timeline
          </h2>
        </div>

        {/* Metric Selector Toggle */}
        <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setMetric('GOLD')}
            className={`px-3 py-1 font-semibold rounded-md transition ${
              metric === 'GOLD' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Gold Lead
          </button>
          <button
            onClick={() => setMetric('XP')}
            className={`px-3 py-1 font-semibold rounded-md transition ${
              metric === 'XP' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            XP Lead
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#34d399" stopOpacity={0.05} />
                <stop offset="50%" stopColor="#f87171" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="minute"
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(m) => `${m}m`}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              domain={[-domainMax, domainMax]}
              tickFormatter={(v) => formatGold(v)}
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as AdvantagePoint;
                  const goldLead = data.goldAdvantage;
                  const xpLead = data.experienceAdvantage;
                  const isRadiantLead = goldLead >= 0;

                  return (
                    <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl shadow-2xl text-xs font-mono">
                      <div className="text-slate-400 font-sans font-bold border-b border-slate-800 pb-1 mb-2">
                        Time: {data.minute}:00
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-sans">Gold Lead:</span>
                          <span
                            className={`font-black ${
                              isRadiantLead ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isRadiantLead ? 'Radiant ' : 'Dire '}
                            {formatSignedGold(goldLead)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-sans">XP Lead:</span>
                          <span
                            className={`font-bold ${
                              xpLead >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {xpLead >= 0 ? 'Radiant ' : 'Dire '}
                            {formatSignedGold(xpLead)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey={metric === 'GOLD' ? 'goldAdvantage' : 'experienceAdvantage'}
              stroke={metric === 'GOLD' ? '#fbbf24' : '#38bdf8'}
              strokeWidth={2}
              fill="url(#splitColor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
        <span className="text-emerald-400/80 font-bold flex items-center gap-1">
          ▲ Positive values: Radiant Advantage
        </span>
        <span className="text-rose-400/80 font-bold flex items-center gap-1">
          ▼ Negative values: Dire Advantage
        </span>
      </div>
    </div>
  );
};
