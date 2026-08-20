import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Trophy,
  Crown,
  Shield,
  User,
  Sparkles,
  Zap,
  Swords,
  Crosshair,
  Flame,
  FlaskConical,
} from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { RANK_NAMES, RANK_COLORS } from '../../constants/ranks';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface StratzTrendsCardProps {
  matches: PlayerMatchSummary[];
  onSelectMatch?: (matchId: string) => void;
}

const VALVE_RANK_IMG_BASE = 'https://www.opendota.com/assets/images/dota2/rank_icons';

export const StratzTrendsCard: React.FC<StratzTrendsCardProps> = ({ matches, onSelectMatch }) => {
  const { t } = useLanguage();
  const [range, setRange] = useState<25 | 100>(25);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 340, height: 330 });

  useLayoutEffect(() => {
    if (!chartContainerRef.current) return;
    const updateDims = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setChartDimensions({ width: rect.width, height: rect.height });
        }
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(chartContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const displayedMatches = useMemo(() => {
    return matches.slice(0, range);
  }, [matches, range]);

  // Statistics calculation for the 25/100 matches
  const stats = useMemo(() => {
    const total = Math.max(1, displayedMatches.length);
    const wins = displayedMatches.filter((m) => m.isVictory).length;
    const winRate = Math.round((wins / total) * 100);

    // Lane history: Won, Even, Lost, Inconclusive
    let laneWon = 0;
    let laneEven = 0;
    let laneLost = 0;
    let laneOther = 0;

    displayedMatches.forEach((m) => {
      if (m.dynamicType === 'STOMP_LANE' || m.dynamicType === 'WIN_LANE' || (m.imp >= 5 && m.isVictory)) {
        laneWon++;
      } else if (m.dynamicType === 'LOST_LANE' || (!m.isVictory && m.imp <= -8)) {
        laneLost++;
      } else if (m.dynamicType === 'EVEN_MATCH' || m.dynamicType === 'DRAW_LANE' || Math.abs(m.imp) < 5) {
        laneEven++;
      } else {
        laneOther++;
      }
    });

    // Group heroes played in this window
    const heroMap: Record<number, { count: number; wins: number; impSum: number }> = {};
    displayedMatches.forEach((m) => {
      if (!heroMap[m.heroId]) {
        heroMap[m.heroId] = { count: 0, wins: 0, impSum: 0 };
      }
      heroMap[m.heroId].count++;
      if (m.isVictory) heroMap[m.heroId].wins++;
      heroMap[m.heroId].impSum += m.imp || 0;
    });

    // Roles breakdown in strict order
    const roleMap: Record<string, { count: number; heroes: Record<number, number> }> = {
      POSITION_1: { count: 0, heroes: {} },
      POSITION_2: { count: 0, heroes: {} },
      POSITION_3: { count: 0, heroes: {} },
      POSITION_4: { count: 0, heroes: {} },
      POSITION_5: { count: 0, heroes: {} },
    };

    displayedMatches.forEach((m) => {
      const r = roleMap[m.role] ? m.role : 'POSITION_1';
      roleMap[r].count++;
      roleMap[r].heroes[m.heroId] = (roleMap[r].heroes[m.heroId] || 0) + 1;
    });

    return {
      total,
      wins,
      losses: total - wins,
      winRate,
      laneWon,
      laneEven,
      laneLost,
      laneOther: Math.max(1, laneOther),
      heroMap,
      roleMap,
    };
  }, [displayedMatches]);

  // Dynamic radii calculated from measured container size
  const { maxRadius, roleR0, roleR1, roleRadiusMid, heroR0, heroR1, heroRadiusMid } = useMemo(() => {
    const maxR = Math.min(chartDimensions.width, chartDimensions.height) / 2;
    const rR0 = Math.round(maxR * 0.28);
    const rR1 = Math.round(maxR * 0.56);
    const rMid = (rR0 + rR1) / 2;

    const gap = Math.max(6, Math.round(maxR * 0.05));
    const hR0 = rR1 + gap;
    const hR1 = Math.round(maxR * 0.94);
    const hMid = (hR0 + hR1) / 2;

    return {
      maxRadius: maxR,
      roleR0: rR0,
      roleR1: rR1,
      roleRadiusMid: rMid,
      heroR0: hR0,
      heroR1: hR1,
      heroRadiusMid: hMid,
    };
  }, [chartDimensions]);

  // Strict role order
  const roleOrder = ['POSITION_1', 'POSITION_2', 'POSITION_3', 'POSITION_4', 'POSITION_5'];

  // Exact polar calculations synchronized with ECharts (startAngle: 90, clockwise: true, sort: null)
  const { roleIconNodes, heroIconNodes } = useMemo(() => {
    const rNodes: Array<{
      role: string;
      iconX: number;
      iconY: number;
      count: number;
      sweep: number;
    }> = [];

    const hNodes: Array<{
      heroId: number;
      displayName: string;
      avatarUrl: string;
      count: number;
      winRate: number;
      avgImp: number;
      iconX: number;
      iconY: number;
      size: number;
      sweep: number;
    }> = [];

    const total = stats.total;
    let accumulatedAngle = 0; // Starts at 0° (12 o'clock in ECharts)

    roleOrder.forEach((role) => {
      const data = stats.roleMap[role];
      if (!data || data.count === 0) return;

      const roleSweep = (data.count / total) * 360;
      const roleMidAngle = accumulatedAngle + roleSweep / 2;

      // 12 o'clock clockwise: rad = (midAngle - 90) * PI / 180
      const roleRad = ((roleMidAngle - 90) * Math.PI) / 180;
      rNodes.push({
        role,
        iconX: roleRadiusMid * Math.cos(roleRad),
        iconY: roleRadiusMid * Math.sin(roleRad),
        count: data.count,
        sweep: roleSweep,
      });

      // Heroes inside this role (preserve order exactly)
      const heroesList = Object.entries(data.heroes).sort((a, b) => b[1] - a[1]);

      heroesList.forEach(([heroIdStr, count]) => {
        const hId = parseInt(heroIdStr, 10);
        const hero = getHero(hId);
        const hStats = stats.heroMap[hId] || { count, wins: count, impSum: 0 };
        const wr = Math.round((hStats.wins / hStats.count) * 100);
        const avgImp = Math.round(hStats.impSum / hStats.count);

        const heroSweep = (count / total) * 360;
        const heroMidAngle = accumulatedAngle + heroSweep / 2;
        accumulatedAngle += heroSweep;

        const heroRad = ((heroMidAngle - 90) * Math.PI) / 180;
        const iconX = heroRadiusMid * Math.cos(heroRad);
        const iconY = heroRadiusMid * Math.sin(heroRad);

        const baseHeroSize = Math.max(20, Math.min(34, Math.round(maxRadius * 0.18)));
        const size = count >= 3 ? baseHeroSize + 4 : count >= 2 ? baseHeroSize : baseHeroSize - 4;

        hNodes.push({
          heroId: hId,
          displayName: hero.displayName,
          avatarUrl: hero.avatarUrl,
          count,
          winRate: wr,
          avgImp,
          iconX,
          iconY,
          size,
          sweep: heroSweep,
        });
      });
    });

    return { roleIconNodes: rNodes, heroIconNodes: hNodes };
  }, [stats, roleRadiusMid, heroRadiusMid, maxRadius]);

  // ECharts Sunburst Configuration with Spacing Gap Between Rings
  const sunburstOption = useMemo(() => {
    const roleColors: Record<string, string> = {
      POSITION_1: '#1e3a8a', // Deep Blue
      POSITION_2: '#0f766e', // Teal
      POSITION_3: '#854d0e', // Dark Amber
      POSITION_4: '#831843', // Rose / Magenta
      POSITION_5: '#14532d', // Forest Green
    };

    const sunburstData = roleOrder
      .filter((role) => stats.roleMap[role] && stats.roleMap[role].count > 0)
      .map((role) => {
        const data = stats.roleMap[role];
        const heroesList = Object.entries(data.heroes).sort((a, b) => b[1] - a[1]);

        const heroChildren = heroesList.map(([heroIdStr, count]) => {
          const hId = parseInt(heroIdStr, 10);
          const hero = getHero(hId);
          const hStats = stats.heroMap[hId] || { count, wins: count, impSum: 0 };
          const wr = Math.round((hStats.wins / hStats.count) * 100);
          const avgImp = Math.round(hStats.impSum / hStats.count);

          return {
            name: hero.displayName,
            value: count,
            heroId: hId,
            avatarUrl: hero.avatarUrl,
            winRate: wr,
            avgImp,
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: false,
              },
            },
            itemStyle: {
              color: roleColors[role] || '#334155',
              borderColor: '#0b0f17',
              borderWidth: 2,
              opacity: 0.85,
            },
          };
        });

        return {
          name: role.replace('POSITION_', 'Pos '),
          value: data.count,
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
          },
          itemStyle: {
            color: roleColors[role] || '#1e293b',
            borderColor: '#0b0f17',
            borderWidth: 2.5,
          },
          children: heroChildren,
        };
      });

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#f8fafc', fontSize: 11, fontFamily: 'sans-serif' },
        formatter: (params: any) => {
          const data = params.data;
          if (data.avatarUrl) {
            return `
              <div style="font-family: sans-serif; min-width: 140px;">
                <div style="font-weight: 900; color: #fbbf24; font-size: 12px; margin-bottom: 4px;">${data.name}</div>
                <div style="font-size: 11px; color: #94a3b8;">Partidas: <strong style="color: #fff;">${data.value}</strong> (${Math.round((data.value / stats.total) * 100)}%)</div>
                <div style="font-size: 11px; color: #34d399;">Taxa de Vitória: <strong style="color: #34d399;">${data.winRate}%</strong></div>
                <div style="font-size: 11px; color: #94a3b8;">Média IMP: <strong style="color: #fbbf24;">${data.avgImp >= 0 ? '+' + data.avgImp : data.avgImp}</strong></div>
              </div>
            `;
          }
          return `
            <div style="font-family: sans-serif;">
              <strong style="color: #60a5fa;">${data.name}</strong><br/>
              Partidas: <strong>${data.value}</strong> (${Math.round((data.value / stats.total) * 100)}%)
            </div>
          `;
        },
      },
      series: {
        type: 'sunburst',
        nodeClick: false, // Disables click zoom/drilldown completely (pure hover only!)
        selectedMode: false, // Disables selection toggle
        data: sunburstData,
        sort: null, // PRESERVE EXACT ARRAY ORDER - DO NOT AUTO-SORT!
        radius: [roleR0, heroR1],
        center: ['50%', '50%'],
        startAngle: 90, // Starts at 12 o'clock
        clockwise: true, // Rotates clockwise
        label: {
          show: false,
        },
        emphasis: {
          focus: 'descendant',
          label: {
            show: false,
          },
          itemStyle: {
            shadowBlur: 14,
            shadowColor: 'rgba(251, 191, 36, 0.45)',
          },
        },
        levels: [
          {},
          {
            // Level 1: Roles
            r0: roleR0,
            r: roleR1,
            label: { show: false },
            emphasis: { label: { show: false } },
            itemStyle: {
              borderWidth: 2.5,
            },
          },
          {
            // Level 2: Heroes (with visual gap from role ring!)
            r0: heroR0,
            r: heroR1,
            label: { show: false },
            emphasis: { label: { show: false } },
            itemStyle: {
              borderWidth: 2,
            },
          },
        ],
      },
    };
  }, [stats, roleR0, roleR1, heroR0, heroR1]);

  const rawMatches25 = useMemo(() => {
    return displayedMatches.slice(0, 25);
  }, [displayedMatches]);

  const ranksList = [1, 2, 3, 4, 5, 6, 7, 8];

  const renderRoleIcon = (role: string) => {
    switch (role) {
      case 'POSITION_1':
        return <span title="Pos 1 (Carry)"><Swords className="w-4 h-4 text-blue-200" /></span>;
      case 'POSITION_2':
        return <span title="Pos 2 (Mid)"><Crosshair className="w-4 h-4 text-teal-200" /></span>;
      case 'POSITION_3':
        return <span title="Pos 3 (Offlane)"><Shield className="w-4 h-4 text-amber-200" /></span>;
      case 'POSITION_4':
        return <span title="Pos 4 (Soft Support)"><Flame className="w-4 h-4 text-pink-200" /></span>;
      case 'POSITION_5':
        return <span title="Pos 5 (Hard Support)"><FlaskConical className="w-4 h-4 text-emerald-200" /></span>;
      default:
        return <span title="Core"><Swords className="w-4 h-4 text-slate-300" /></span>;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl bg-[#0b101a] flex flex-col justify-between">
      {/* Header with Title and Range Toggle */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
          <span>Tendências</span>
          <Sparkles className="w-4 h-4 text-cyan-400" />
        </h3>

        <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setRange(25)}
            className={`px-3 py-1 rounded transition ${
              range === 25 ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            25 Partidas
          </button>
          <button
            onClick={() => setRange(100)}
            className={`px-3 py-1 rounded transition ${
              range === 100 ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            100
          </button>
        </div>
      </div>

      {/* Enlarged Sunburst Chart Container (Height 340px with Distinct Ring Spacing) */}
      <div
        ref={chartContainerRef}
        className="relative w-full h-[330px] my-2 flex items-center justify-center select-none"
      >
        <ReactECharts
          option={sunburstOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />

        {/* 1. Role Icons on Inner Ring (Centered at r = 68px) */}
        {roleIconNodes.map((rNode, i) => (
          <div
            key={`role-${i}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center drop-shadow-md z-10"
            style={{
              left: `calc(50% + ${rNode.iconX}px)`,
              top: `calc(50% + ${rNode.iconY}px)`,
            }}
          >
            {renderRoleIcon(rNode.role)}
          </div>
        ))}

        {/* 2. Perfectly Circular Hero Avatar Badges on Outer Ring (Centered at r = 125px) */}
        {heroIconNodes.map((node, i) => (
          <div
            key={`hero-${i}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer z-20"
            style={{
              left: `calc(50% + ${node.iconX}px)`,
              top: `calc(50% + ${node.iconY}px)`,
            }}
          >
            <img
              src={node.avatarUrl}
              alt={node.displayName}
              style={{ width: `${node.size}px`, height: `${node.size}px` }}
              className={`rounded-full object-cover border shadow-xl transition-all duration-200 group-hover:scale-135 ${
                node.count >= 3
                  ? 'border-amber-400 shadow-amber-950/80 ring-2 ring-amber-400/50'
                  : 'border-slate-600/90 shadow-black/80'
              }`}
              onError={handleHeroImageError}
            />

            {/* Hover Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30 bg-[#0f172a] border border-slate-700 text-[11px] font-sans py-1 px-2.5 rounded-lg shadow-2xl whitespace-nowrap text-slate-200 pointer-events-none">
              <div className="font-bold text-amber-400">{node.displayName}</div>
              <div>{node.count} {t('matches')} • {node.winRate}% WR • {node.avgImp >= 0 ? `+${node.avgImp}` : node.avgImp} IMP</div>
            </div>
          </div>
        ))}
      </div>

      {/* Taller Bipolar Equalizer (Height 80px / h-20 with slender w-1.5 bars) */}
      <div className="mt-3 pt-3 border-t border-slate-800/80">
        <div className="relative h-20 mb-1 px-1">
          {/* Zero baseline in the middle */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-700/80 z-10" />

          {/* 25 Matches Columns with Floating Performance Icons */}
          <div className="grid grid-cols-25 gap-1 h-full items-center">
            {rawMatches25.map((m, idx) => {
              const imp = m.imp || 0;
              const isMVP = m.award === 'MVP' || imp >= 35;
              const isTopSup = m.award === 'TOP_SUPPORT';
              const isExtreme = imp >= 40;
              const isPositive = imp >= 0;

              // Normalized bar height from baseline (0% to 100% of half-height)
              const maxScale = 50;
              const clampedImp = Math.min(maxScale, Math.abs(imp));
              const heightPercent = Math.max(18, Math.round((clampedImp / maxScale) * 100));

              return (
                <div
                  key={m.matchId || idx}
                  onClick={() => onSelectMatch && onSelectMatch(m.matchId)}
                  className="relative h-full flex flex-col justify-center items-center group cursor-pointer"
                >
                  {/* Floating Performance Indicator Icon on top of bar */}
                  <div className="absolute -top-1.5 transform -translate-y-1 z-20">
                    {isExtreme && (
                      <div className="w-3 h-3 rounded-full bg-purple-600 text-purple-100 flex items-center justify-center shadow-md shadow-purple-950 border border-purple-400">
                        <Crown className="w-2 h-2" />
                      </div>
                    )}
                    {isMVP && !isExtreme && (
                      <div className="w-3 h-3 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-sm">
                        <Trophy className="w-2 h-2" />
                      </div>
                    )}
                    {isTopSup && (
                      <div className="w-3 h-3 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-sm">
                        <Shield className="w-2 h-2" />
                      </div>
                    )}
                    {!isMVP && !isTopSup && isPositive && imp >= 20 && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500/80 text-black flex items-center justify-center">
                        <Zap className="w-1.5 h-1.5" />
                      </div>
                    )}
                  </div>

                  {/* Bipolar Bar Container with Slender Width */}
                  <div className="w-full h-full relative flex items-center justify-center">
                    {isPositive ? (
                      /* Positive Bar Growing UP from Middle - Slender w-1.5 */
                      <div
                        className={`absolute w-1.5 bottom-1/2 rounded-t-[2px] transition-all ${
                          isExtreme
                            ? 'bg-purple-500 shadow-sm shadow-purple-900'
                            : isMVP
                            ? 'bg-amber-400'
                            : 'bg-slate-300 group-hover:bg-amber-300'
                        }`}
                        style={{ height: `${heightPercent * 0.45}%` }}
                      />
                    ) : (
                      /* Negative Bar Growing DOWN from Middle - Slender w-1.5 */
                      <div
                        className="absolute w-1.5 top-1/2 rounded-b-[2px] bg-slate-600 group-hover:bg-rose-500 transition-all"
                        style={{ height: `${heightPercent * 0.45}%` }}
                      />
                    )}
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30 bg-[#0f172a] border border-slate-700 text-[10px] font-mono py-1 px-2 rounded-md shadow-2xl whitespace-nowrap text-slate-200">
                    <div className="font-bold text-white">{getHero(m.heroId).displayName}</div>
                    <div className={m.isVictory ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {m.isVictory ? 'Vitória' : 'Derrota'} ({imp >= 0 ? `+${imp}` : imp} IMP)
                    </div>
                    <div className="text-slate-400 text-[9px]">
                      KDA: {m.kills}/{m.deaths}/{m.assists} • {m.goldPerMinute} GPM
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Discrete Win (Green) / Loss (Red) Slender Dots */}
        <div className="grid grid-cols-25 gap-1 px-1 mt-0.5">
          {rawMatches25.map((m, idx) => (
            <div
              key={idx}
              className={`h-1.5 w-1.5 mx-auto rounded-full cursor-pointer hover:scale-150 transition ${
                m.isVictory ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
              }`}
              onClick={() => onSelectMatch && onSelectMatch(m.matchId)}
              title={`${getHero(m.heroId).displayName} - ${m.isVictory ? 'Vitória' : 'Derrota'}`}
            />
          ))}
        </div>
      </div>

      {/* Summary 2x2 KPIs Grid */}
      <div className="grid grid-cols-2 gap-3.5 my-3 pt-3 border-t border-slate-800 text-left font-sans text-xs">
        {/* Win Rate with Delta */}
        <div>
          <div className="text-[11px] text-slate-400">Taxa de vitória da partida</div>
          <div className="text-sm font-black text-white flex items-center gap-1 mt-0.5 font-mono">
            <span>{stats.winRate}%</span>
            <span className="text-[10px] text-emerald-400 font-bold">↗ 8%</span>
          </div>
        </div>

        {/* Histórico de Rotas */}
        <div>
          <div className="text-[11px] text-slate-400">Histórico de Rotas</div>
          <div className="text-sm font-black font-mono flex items-center gap-1 mt-0.5">
            <span className="text-emerald-400">{stats.laneWon}</span>
            <span className="text-slate-600">-</span>
            <span className="text-yellow-400">{stats.laneEven}</span>
            <span className="text-slate-600">-</span>
            <span className="text-rose-500">{stats.laneLost}</span>
            <span className="text-slate-600">-</span>
            <span className="text-slate-500">{stats.laneOther}</span>
          </div>
        </div>

        {/* Fila Solo */}
        <div>
          <div className="text-[11px] text-slate-400">Fila Solo</div>
          <div className="text-xs font-black text-white flex items-center gap-1 mt-0.5 font-mono">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>68%</span>
          </div>
        </div>

        {/* Não classificado */}
        <div>
          <div className="text-[11px] text-slate-400">Não classificado</div>
          <div className="text-xs font-black text-slate-300 font-mono mt-0.5">
            — 80%
          </div>
        </div>
      </div>

      {/* Rank Medal Icons Distribution Bar */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 w-full justify-between">
          {ranksList.map((tier) => {
            const isAncient = tier === 6; // User current bracket
            const rankName = RANK_NAMES[tier];

            return (
              <div
                key={tier}
                className={`relative flex flex-col items-center group cursor-pointer transition ${
                  isAncient ? 'scale-110' : 'opacity-50 hover:opacity-100'
                }`}
                title={`${rankName} Tier`}
              >
                <img
                  src={`${VALVE_RANK_IMG_BASE}/rank_icon_${tier}.png`}
                  alt={rankName}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {isAncient && (
                  <div className="w-4 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-950 mt-0.5 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
