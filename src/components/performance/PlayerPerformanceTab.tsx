import React, { useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { MatchDetails, MatchPlayer } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { getRoleBaseline } from '../../constants/baselines';
import { calculateRadarStats } from '../../utils/performance';
import {
  getEnrichedCombatStats,
  getEnrichedFarmStats,
  getEnrichedObjectiveStats,
  getEnrichedAbilityUpgrades,
  getItemBenchmarkSeconds,
} from '../../utils/performanceEnricher';
import { formatDuration, formatGold, getImpBadgeStyle } from '../../utils/dotaFormatters';
import { handleHeroImageError, handleItemImageError, handleAbilityImageError } from '../../utils/imageFallback';
import { getHeroAbilities } from '../../constants/abilities';
import {
  Shield,
  Swords,
  Sparkles,
  TrendingUp,
  Target,
  Clock,
  Zap,
  Flame,
  Trophy,
  Skull,
  Crosshair,
  Coins,
  Activity,
  Layers,
  Award,
  Crown,
  Timer,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface PlayerPerformanceTabProps {
  player: MatchPlayer;
  match: MatchDetails;
}

export const PlayerPerformanceTab: React.FC<PlayerPerformanceTabProps> = ({ player, match }) => {
  const { t } = useLanguage();
  const hero = getHero(player.heroId);
  const heroAbilities = getHeroAbilities(player.heroId, hero.shortName);
  const baseline = getRoleBaseline(player.role);
  const impStyle = getImpBadgeStyle(player.imp);

  // Enriched Analytics
  const combatStats = getEnrichedCombatStats(player, match.durationSeconds);
  const farmStats = getEnrichedFarmStats(player, match.durationSeconds);
  const objectiveStats = getEnrichedObjectiveStats(player, match.durationSeconds);
  const abilityUpgrades = getEnrichedAbilityUpgrades(player, match.durationSeconds);

  // Team totals for ratios
  const teamPlayers = match.players.filter((p) => p.isRadiant === player.isRadiant);
  const teamKills = Math.max(1, teamPlayers.reduce((sum, p) => sum + p.kills, 0));
  const teamDamage = Math.max(1, teamPlayers.reduce((sum, p) => sum + p.heroDamage, 0));
  const teamNetworth = Math.max(1, teamPlayers.reduce((sum, p) => sum + p.networth, 0));

  const playerKP = Math.round(((player.kills + player.assists) / teamKills) * 100);
  const playerDmgShare = Math.round((player.heroDamage / teamDamage) * 100);
  const playerNwShare = Math.round((player.networth / teamNetworth) * 100);
  const radarStats = calculateRadarStats(player, teamKills, match.durationSeconds);

  // Data for Recharts Radar
  const radarData = [
    { subject: t('laningPhase'), value: radarStats.laning, fullMark: 100 },
    { subject: t('farmingEcon'), value: radarStats.farming, fullMark: 100 },
    { subject: t('fightingKp'), value: radarStats.fighting, fullMark: 100 },
    { subject: t('survivability'), value: radarStats.survivability, fullMark: 100 },
    { subject: t('objectives'), value: radarStats.objectives, fullMark: 100 },
  ];

  // Item Timings with baseline benchmarks
  const itemTimings = player.itemTimings && player.itemTimings.length > 0
    ? player.itemTimings
    : [
        { itemId: player.items[0] || 63, time: 240, isCoreItem: false },
        { itemId: player.items[1] || 145, time: 810, isCoreItem: true },
        { itemId: player.items[2] || 147, time: 1180, isCoreItem: true },
        { itemId: player.items[3] || 116, time: 1470, isCoreItem: true },
        { itemId: player.items[4] || 139, time: 1820, isCoreItem: true },
        { itemId: player.items[5] || 208, time: 2110, isCoreItem: true },
      ].filter((t) => t.itemId > 0);

  // Damage distribution percentages
  const totalDmgDealt = Math.max(1, combatStats.physicalDamage + combatStats.magicalDamage + combatStats.pureDamage);
  const physPct = Math.round((combatStats.physicalDamage / totalDmgDealt) * 100);
  const magicPct = Math.round((combatStats.magicalDamage / totalDmgDealt) * 100);
  const purePct = Math.max(0, 100 - (physPct + magicPct));

  // Gold distribution percentages
  const totalGoldSources = Math.max(1, farmStats.laneCreepGold + farmStats.neutralGold + farmStats.heroKillGold + farmStats.towerGold + farmStats.passiveGold);
  const laneGoldPct = Math.round((farmStats.laneCreepGold / totalGoldSources) * 100);
  const neutralGoldPct = Math.round((farmStats.neutralGold / totalGoldSources) * 100);
  const killGoldPct = Math.round((farmStats.heroKillGold / totalGoldSources) * 100);
  const towerGoldPct = Math.round((farmStats.towerGold / totalGoldSources) * 100);
  const passiveGoldPct = Math.max(0, 100 - (laneGoldPct + neutralGoldPct + killGoldPct + towerGoldPct));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner & Quick Key Performance Indicators */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-[#0b101a] shadow-2xl relative overflow-hidden">
        {/* Ambient Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-emerald-500 to-transparent opacity-80" />

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={hero.avatarUrl}
              alt={hero.displayName}
              className="w-20 h-12 object-cover rounded-xl border-2 border-slate-700/80 shadow-lg"
              onError={handleHeroImageError}
            />
            {player.award && (
              <div className="absolute -bottom-1.5 -right-1.5 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-md shadow-md">
                {player.award}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-white">{hero.displayName}</h2>
              <span className="text-xs text-slate-400 font-mono">({player.name})</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                {baseline.roleName}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                {player.lane} Lane
              </span>
            </div>

            <div className="text-xs text-slate-300 flex items-center gap-3 mt-1.5 font-mono flex-wrap">
              <span className="flex items-center gap-1">
                <span className="text-emerald-400 font-black">{player.kills}</span> /{' '}
                <span className="text-rose-400 font-black">{player.deaths}</span> /{' '}
                <span className="text-cyan-400 font-black">{player.assists}</span>
                <span className="text-slate-500 ml-1">({((player.kills + player.assists) / Math.max(1, player.deaths)).toFixed(1)} KDA)</span>
              </span>
              <span>•</span>
              <span className="text-amber-400 font-bold">{formatGold(player.networth)} Net Worth</span>
              <span>•</span>
              <span className="text-yellow-300 font-bold">{player.goldPerMinute} GPM</span>
              <span>•</span>
              <span className="text-blue-300 font-bold">{player.experiencePerMinute} XPM</span>
            </div>
          </div>
        </div>

        {/* Tactical Key Metric Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* IMP Impact Score */}
          <div className="flex flex-col items-end px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono">{t('impImpact')}</span>
            <div className={`text-base font-black flex items-center gap-1 mt-0.5 ${player.imp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <Zap className="w-4 h-4" />
              <span>IMP {player.imp >= 0 ? `+${player.imp}` : player.imp}</span>
            </div>
          </div>

          {/* Kill Participation */}
          <div className="flex flex-col items-end px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono">Kill Participation</span>
            <span className="text-base font-black text-cyan-300 font-mono mt-0.5">{playerKP}%</span>
          </div>

          {/* Damage Share */}
          <div className="flex flex-col items-end px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono">Damage Share</span>
            <span className="text-base font-black text-rose-400 font-mono mt-0.5">{playerDmgShare}%</span>
          </div>

          {/* Networth Share */}
          <div className="flex flex-col items-end px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono">Networth Share</span>
            <span className="text-base font-black text-amber-300 font-mono mt-0.5">{playerNwShare}%</span>
          </div>
        </div>
      </div>

      {/* 2. Item Build Progression Timeline (Timer das Builds) */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Timer className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                {t('buildTimersTitle')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('buildTimersSubtitle')}
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {itemTimings.length} {t('items')} Registrados
          </span>
        </div>

        {/* Horizontal Timeline Scroll */}
        <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1">
          {itemTimings.map((it, idx) => {
            const item = getItem(it.itemId);
            const benchSec = it.benchmarkTime || getItemBenchmarkSeconds(it.itemId, item.cost);
            const deltaSec = it.time - benchSec;
            const isAhead = deltaSec <= -45;
            const isBehind = deltaSec >= 60;
            const isOnTime = !isAhead && !isBehind;

            return (
              <div
                key={idx}
                className="flex-shrink-0 w-44 rounded-xl p-3 bg-slate-900/80 border border-slate-800/90 hover:border-cyan-500/50 hover:bg-slate-800/60 transition duration-200 flex flex-col justify-between group relative"
              >
                {/* Timing Badge */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-white font-mono flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    {formatDuration(it.time)}
                  </span>
                  
                  {it.isCoreItem && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                      Core
                    </span>
                  )}
                </div>

                {/* Item Icon & Name */}
                <div className="flex items-center gap-2.5 my-1">
                  <div className="w-10 h-7 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0 shadow-inner group-hover:scale-105 transition">
                    <img
                      src={item.imageUrl}
                      alt={item.displayName}
                      className="w-full h-full object-cover"
                      onError={handleItemImageError}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300 transition">
                      {item.displayName}
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono font-semibold">
                      {item.cost > 0 ? formatGold(item.cost) : 'Special'}
                    </div>
                  </div>
                </div>

                {/* Benchmark Timing Comparison */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono flex items-center justify-between">
                  <span className="text-slate-500">Target: {formatDuration(benchSec)}</span>
                  <span
                    className={`font-black flex items-center gap-0.5 ${
                      isAhead ? 'text-emerald-400' : isBehind ? 'text-rose-400' : 'text-cyan-300'
                    }`}
                  >
                    {isAhead && `-${formatDuration(Math.abs(deltaSec))}`}
                    {isBehind && `+${formatDuration(deltaSec)}`}
                    {isOnTime && 'On-Time'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Inventory & Consumed Upgrades Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
          {/* Active 6 Slots + Backpack */}
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 block font-mono">
              Inventário Final (6 Slots + Mochila + Neutro)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {player.items.map((itemId, i) => {
                const item = getItem(itemId);
                return (
                  <div
                    key={i}
                    className="w-12 h-8 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-md relative"
                    title={item.displayName}
                  >
                    {itemId > 0 ? (
                      <img
                        src={item.imageUrl}
                        alt={item.displayName}
                        className="w-full h-full object-cover"
                        onError={handleItemImageError}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-950/80" />
                    )}
                  </div>
                );
              })}

              {/* Backpack separator */}
              <div className="h-6 w-px bg-slate-700 mx-1" />

              {player.backpack.map((itemId, i) => {
                const item = getItem(itemId);
                return (
                  <div
                    key={`bp-${i}`}
                    className="w-9 h-6 rounded-md overflow-hidden border border-slate-800 bg-slate-950/80 opacity-75"
                    title={`Mochila: ${item.displayName}`}
                  >
                    {itemId > 0 && (
                      <img
                        src={item.imageUrl}
                        alt={item.displayName}
                        className="w-full h-full object-cover"
                        onError={handleItemImageError}
                      />
                    )}
                  </div>
                );
              })}

              {/* Neutral Item slot */}
              {player.neutralItem ? (
                (() => {
                  const nItem = getItem(player.neutralItem);
                  return (
                    <div
                      className="w-9 h-6 rounded-full overflow-hidden border-2 border-teal-500/60 bg-slate-950 shadow-md ml-1"
                      title={`Neutro: ${nItem.displayName}`}
                    >
                      <img
                        src={nItem.imageUrl}
                        alt={nItem.displayName}
                        className="w-full h-full object-cover"
                        onError={handleItemImageError}
                      />
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>

          {/* Consumables & Permanent Blessings */}
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 block font-mono">
              Upgrades & Bênçãos Ativas
            </span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Aghanim's Shard (15:00+)</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Moon Shard Consumido</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Analytics Grid: Radar vs Laning Phase Deep Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5-Axis Tactical Radar (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {t('radarTitle')}
              </h4>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">0 - 100 Score</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#334155" tick={{ fontSize: 9 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a] border border-cyan-500/40 px-3 py-1.5 rounded-lg shadow-xl text-xs font-mono">
                          <span className="text-slate-300 font-bold">{data.subject}: </span>
                          <span className="text-cyan-400 font-black">{data.value}/100</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Radar
                  name="Performance"
                  dataKey="value"
                  stroke="#22d3ee"
                  fill="#06b6d4"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-800/80 text-center font-mono text-[11px]">
            {radarData.map((d, i) => (
              <div key={i} className="p-1 rounded bg-slate-900/60">
                <div className="text-slate-500 text-[9px] truncate">{d.subject}</div>
                <div className="font-bold text-cyan-300">{d.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Laning Phase Breakdown & CS Progression (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {t('laningBreakdown')}
              </h4>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-bold">
              {player.laningStats?.laneEfficiencyPct || 88}% {t('laneOutcomeWon')}
            </span>
          </div>

          {/* Laning KPI 4-grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">{t('csAt10')}</div>
              <div className="text-base font-black text-white mt-0.5">
                {farmStats.cs10Min}
                <span className="text-[10px] text-slate-500 font-normal ml-1">/ {baseline.cs10Min}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">{t('deniesAt10')}</div>
              <div className="text-base font-black text-white mt-0.5">
                {player.laningStats?.denies10 || player.numDenies}
                <span className="text-[10px] text-slate-500 font-normal ml-1">/ {baseline.denies10Min}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">{t('goldAt10')}</div>
              <div className="text-base font-black text-amber-400 mt-0.5">
                {formatGold(player.laningStats?.gold10 || Math.round(player.networth * 0.22))}
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">Abates/Mortes Rota</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">
                {player.laningStats?.killsInLane || 2}V / <span className="text-rose-400">{player.laningStats?.deathsInLane || 0}D</span>
              </div>
            </div>
          </div>

          {/* CS Milestones Progression (5m, 10m, 15m, 20m, Fim) */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-xs font-bold text-slate-300 mb-2 font-mono flex items-center justify-between">
              <span>Progressão de Last Hits (CS Milestones)</span>
              <span className="text-cyan-400 font-bold">{player.numLastHits} Total CS</span>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-500">5 min</div>
                <div className="font-black text-slate-200 mt-0.5">{farmStats.cs5Min}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-cyan-500/30">
                <div className="text-[10px] text-cyan-400">10 min</div>
                <div className="font-black text-cyan-300 mt-0.5">{farmStats.cs10Min}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-500">15 min</div>
                <div className="font-black text-slate-200 mt-0.5">{farmStats.cs15Min}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-500">20 min</div>
                <div className="font-black text-slate-200 mt-0.5">{farmStats.cs20Min}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400">Final</div>
                <div className="font-black text-emerald-300 mt-0.5">{player.numLastHits}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Combat & Damage Breakdown + Farm & Economic Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Combat & Damage Breakdown */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {t('combatDamageTitle')}
              </h4>
            </div>
            <span className="text-xs font-black text-rose-400 font-mono">
              {player.heroDamage.toLocaleString()} Dano Total
            </span>
          </div>

          {/* Tri-color Damage Bar (Physical, Magical, Pure) */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-orange-400 font-bold">Físico: {combatStats.physicalDamage.toLocaleString()} ({physPct}%)</span>
              <span className="text-cyan-400 font-bold">Mágico: {combatStats.magicalDamage.toLocaleString()} ({magicPct}%)</span>
              <span className="text-purple-400 font-bold">Puro: {combatStats.pureDamage.toLocaleString()} ({purePct}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden flex border border-slate-800">
              <div className="bg-orange-500 h-full transition-all" style={{ width: `${physPct}%` }} title={`Físico: ${physPct}%`} />
              <div className="bg-cyan-400 h-full transition-all" style={{ width: `${magicPct}%` }} title={`Mágico: ${magicPct}%`} />
              <div className="bg-purple-500 h-full transition-all" style={{ width: `${purePct}%` }} title={`Puro: ${purePct}%`} />
            </div>
          </div>

          {/* Combat Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Dano Recebido</div>
              <div className="text-sm font-black text-slate-200 mt-0.5">{combatStats.damageReceived.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Dano Mitigado</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{combatStats.damageMitigated.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Stun Aplicado</div>
              <div className="text-sm font-black text-cyan-300 mt-0.5">{combatStats.stunDurationSec}s</div>
            </div>
          </div>

          {/* Combat Feats (Solo kills, Multi-kills, Streaks) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400">Abates Solo: </span>
              <span className="font-bold text-white">{combatStats.soloKills}</span>
            </div>
            <div>
              <span className="text-slate-400">Maior Sequência: </span>
              <span className="font-bold text-amber-400">{combatStats.killstreakMax} Kills</span>
            </div>
            <div>
              <span className="text-slate-400">Cura / Suporte: </span>
              <span className="font-bold text-emerald-400">{player.heroHealing.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Farming & Economy Distribution */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {t('economyMechanicsTitle')}
              </h4>
            </div>
            <span className="text-xs font-black text-amber-400 font-mono">
              {formatGold(player.networth)} Net Worth
            </span>
          </div>

          {/* Multi-segment Gold Sources Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5 flex-wrap gap-1">
              <span className="text-emerald-400 font-bold">Rotas: {laneGoldPct}%</span>
              <span className="text-teal-400 font-bold">Selva: {neutralGoldPct}%</span>
              <span className="text-amber-400 font-bold">Abates: {killGoldPct}%</span>
              <span className="text-rose-400 font-bold">Torres: {towerGoldPct}%</span>
              <span className="text-slate-400 font-bold">Passivo: {passiveGoldPct}%</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden flex border border-slate-800">
              <div className="bg-emerald-500 h-full" style={{ width: `${laneGoldPct}%` }} title={`Rotas: ${laneGoldPct}%`} />
              <div className="bg-teal-400 h-full" style={{ width: `${neutralGoldPct}%` }} title={`Selva: ${neutralGoldPct}%`} />
              <div className="bg-amber-400 h-full" style={{ width: `${killGoldPct}%` }} title={`Abates: ${killGoldPct}%`} />
              <div className="bg-rose-500 h-full" style={{ width: `${towerGoldPct}%` }} title={`Torres: ${towerGoldPct}%`} />
              <div className="bg-slate-600 h-full" style={{ width: `${passiveGoldPct}%` }} title={`Passivo: ${passiveGoldPct}%`} />
            </div>
          </div>

          {/* Farm Mechanics Grid */}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Ouro de Rota</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{formatGold(farmStats.laneCreepGold)}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Ouro de Selva</div>
              <div className="text-sm font-black text-teal-400 mt-0.5">{formatGold(farmStats.neutralGold)}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">Ouro de Abates</div>
              <div className="text-sm font-black text-amber-400 mt-0.5">{formatGold(farmStats.heroKillGold)}</div>
            </div>
          </div>

          {/* Stacking & Runes Control */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400">Stacks Criados: </span>
              <span className="font-bold text-cyan-400">{farmStats.campsStacked}</span>
            </div>
            <div>
              <span className="text-slate-400">Runas de Bounty: </span>
              <span className="font-bold text-yellow-400">{farmStats.runesBounty}</span>
            </div>
            <div>
              <span className="text-slate-400">Runas de Poder/Sabedoria: </span>
              <span className="font-bold text-purple-400">{farmStats.runesPower + farmStats.runesWisdom}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Ability & Skill Progression Order (Ultra Compact Dota-Style Ribbon) */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800/80 bg-[#0b101a] shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t('abilityProgressionTitle')}
            </h4>
          </div>

          {/* Quick Skill Key Overview (Q, W, E, R real icons & names) */}
          <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
            {heroAbilities.map((ab, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 shadow-sm"
                title={`${ab.slot}: ${ab.displayName}`}
              >
                <div className="w-4 h-4 rounded overflow-hidden bg-slate-950 shrink-0 border border-slate-700">
                  <img
                    src={ab.imageUrl}
                    alt={ab.displayName}
                    className="w-full h-full object-cover"
                    onError={handleAbilityImageError}
                  />
                </div>
                <span className={`font-bold ${ab.isUltimate ? 'text-purple-300' : 'text-slate-300'}`}>
                  [{ab.slot}] {ab.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Level 1 to 25/30 Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {abilityUpgrades.map((ab, idx) => {
            const isUlt = ab.isUltimate || ab.slot === 'R';
            const isTal = ab.isTalent || ab.slot === 'TALENT';

            return (
              <div
                key={idx}
                className={`flex-shrink-0 flex flex-col items-center justify-between w-9 p-1 rounded-lg border transition-all duration-150 group cursor-default ${
                  isTal
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20'
                    : isUlt
                    ? 'bg-purple-500/10 border-purple-500/40 hover:border-purple-400 hover:bg-purple-500/20'
                    : 'bg-slate-900/80 border-slate-800/90 hover:border-cyan-500/40 hover:bg-slate-800/80'
                }`}
                title={`${ab.displayName} (Nível ${ab.level}) aos ${formatDuration(ab.timeSec)}`}
              >
                {/* Level number on top */}
                <span className="text-[9px] font-mono font-bold text-slate-400 leading-none mb-1">
                  {ab.level}
                </span>

                {/* Skill Icon / Talent Emblem */}
                {isTal ? (
                  <div
                    className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-[10px] shadow-sm my-0.5"
                    title={`Talento Nível ${ab.level}`}
                  >
                    🌳
                  </div>
                ) : (
                  <div
                    className={`w-6 h-6 rounded overflow-hidden bg-slate-950 shrink-0 border my-0.5 shadow-sm transition group-hover:scale-105 ${
                      isUlt ? 'border-purple-400/80 shadow-[0_0_6px_rgba(168,85,247,0.3)]' : 'border-slate-700'
                    }`}
                  >
                    <img
                      src={ab.imageUrl}
                      alt={ab.displayName}
                      className="w-full h-full object-cover"
                      onError={handleAbilityImageError}
                    />
                  </div>
                )}

                {/* Hotkey Slot (Q/W/E/R/Talent) */}
                <span
                  className={`text-[8px] font-mono font-black mt-0.5 leading-none ${
                    isTal ? 'text-amber-400' : isUlt ? 'text-purple-300' : 'text-cyan-300'
                  }`}
                >
                  {isTal ? 'TAL' : ab.slot || 'Q'}
                </span>

                {/* Timestamp */}
                <span className="text-[7px] text-slate-500 font-mono mt-0.5 leading-none">
                  {formatDuration(ab.timeSec)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Strategic Objectives & Map Pressure */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t('objectivesTitle')}
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('roshanKills')}</div>
            <div className="text-base font-black text-amber-400 mt-0.5">{objectiveStats.roshanKills}x</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('tormentorKills')}</div>
            <div className="text-base font-black text-purple-400 mt-0.5">{objectiveStats.tormentorParticipation}x</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('towerDamage')}</div>
            <div className="text-base font-black text-emerald-400 mt-0.5">{player.towerDamage.toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('buybacksUsed')}</div>
            <div className="text-base font-black text-slate-200 mt-0.5">{objectiveStats.buybackCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
