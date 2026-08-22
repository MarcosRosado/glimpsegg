import React, { useState } from 'react';
import {
  Trophy,
  Shield,
  Zap,
  Sparkles,
  User,
  ArrowRight,
  Clock,
  Coins,
  Crosshair,
  TrendingUp,
  Flame,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronsDownUp,
  Filter,
} from 'lucide-react';
import { MatchPlayer } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { getRankTierInfo } from '../../constants/ranks';
import { formatGold, getImpBadgeStyle, formatRoleName, formatLaneName } from '../../utils/dotaFormatters';
import { handleHeroImageError, handleItemImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface ScoreboardTableProps {
  players: MatchPlayer[];
  selectedPlayerSlot: number;
  onSelectPlayer: (playerSlot: number) => void;
  onNavigateToPerformance: (playerSlot: number) => void;
  didRadiantWin: boolean;
}

const GENERIC_CONSUMABLES = new Set([
  'item_tango',
  'item_tango_single',
  'item_clarity',
  'item_flask',
  'item_faerie_fire',
  'item_enchanted_mango',
  'item_blood_grenade',
  'item_ward_observer',
  'item_ward_sentry',
  'item_ward_dispenser',
  'item_tpscroll',
  'item_smoke_of_deceit',
  'item_dust',
  'item_cheese',
  'item_refresher_shard',
  'item_lotus',
  'item_healing_lotus',
  'item_great_famango',
  'item_greater_famango',
  'item_banana',
]);

function isGenericConsumableOrRecipe(itemId: number): boolean {
  const item = getItem(itemId);
  if (!item || item.id === 0) return true;
  if (GENERIC_CONSUMABLES.has(item.name)) return true;
  if (item.name.startsWith('item_recipe_') || item.name.includes('recipe_')) return true;
  return false;
}

function formatPurchaseTime(timeSec: number): string {
  if (timeSec <= 0) return 'Início';
  const min = Math.floor(timeSec / 60);
  const sec = Math.abs(timeSec % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export const ScoreboardTable: React.FC<ScoreboardTableProps> = ({
  players,
  selectedPlayerSlot,
  onSelectPlayer,
  onNavigateToPerformance,
  didRadiantWin,
}) => {
  const { t } = useLanguage();
  // Multi-expansion set: supports multiple players open concurrently
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(
    new Set([selectedPlayerSlot])
  );
  // Toggle to filter out generic consumables (default: true)
  const [hideConsumables, setHideConsumables] = useState<boolean>(true);

  const toggleSlot = (slot: number) => {
    onSelectPlayer(slot);
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSlots(new Set(players.map((p) => p.playerSlot)));
  };

  const collapseAll = () => {
    setExpandedSlots(new Set());
  };

  const isAllExpanded = expandedSlots.size === players.length;

  const radiantPlayers = players.filter((p) => p.isRadiant);
  const direPlayers = players.filter((p) => !p.isRadiant);

  const renderTeamSection = (teamPlayers: MatchPlayer[], isRadiant: boolean) => {
    const isWinner = (isRadiant && didRadiantWin) || (!isRadiant && !didRadiantWin);
    const teamTotalKills = teamPlayers.reduce((sum, p) => sum + p.kills, 0);
    const teamTotalNetworth = teamPlayers.reduce((sum, p) => sum + p.networth, 0);

    return (
      <div className="mb-6 last:mb-0">
        {/* Team Header */}
        <div
          className={`flex items-center justify-between p-3 rounded-t-xl border-t border-x ${
            isRadiant
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-black text-sm uppercase tracking-wider">
              {isRadiant ? t('radiant') : t('dire')}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                isWinner
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isWinner ? t('win') : t('loss')}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span>
              {t('totalKills')}: <strong className="text-white">{teamTotalKills}</strong>
            </span>
            <span>•</span>
            <span>
              {t('totalGold')}: <strong className="text-amber-400">{formatGold(teamTotalNetworth)}</strong>
            </span>
          </div>
        </div>

        {/* Players Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-b-xl bg-[#0e1420]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">{t('playerHero')}</th>
                <th className="py-2.5 px-2 text-center">{t('posShort')}</th>
                <th className="py-2.5 px-2 text-center">K / D / A</th>
                <th className="py-2.5 px-2 text-right">{t('networth')}</th>
                <th className="py-2.5 px-2 text-right">{t('gpmXpm')}</th>
                <th className="py-2.5 px-2 text-right">{t('heroDamageShort')}</th>
                <th className="py-2.5 px-2 text-right">{t('healingShort')}</th>
                <th className="py-2.5 px-2 text-right">{t('towerDamageShort')}</th>
                <th className="py-2.5 px-3 text-center">{t('items')}</th>
                <th className="py-2.5 px-3 text-center">{t('impImpact')}</th>
                <th className="py-2.5 px-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {teamPlayers.map((player) => {
                const hero = getHero(player.heroId);
                const rankInfo = getRankTierInfo(player.seasonRank);
                const impStyle = getImpBadgeStyle(player.imp);
                const isExpanded = expandedSlots.has(player.playerSlot);

                // Filter items timeline based on hideConsumables
                const filteredTimings = (player.itemTimings || []).filter((itemEvent) => {
                  if (hideConsumables) {
                    return !isGenericConsumableOrRecipe(itemEvent.itemId);
                  }
                  return true;
                });

                return (
                  <React.Fragment key={player.playerSlot}>
                    {/* Main Player Row */}
                    <tr
                      onClick={() => toggleSlot(player.playerSlot)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded
                          ? 'bg-amber-500/10 text-white font-bold'
                          : 'hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      {/* Hero & Player Name */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={hero.avatarUrl}
                            alt={hero.displayName}
                            className="w-10 h-6 object-cover rounded border border-slate-700 shadow-sm shrink-0"
                            onError={handleHeroImageError}
                          />
                          <div className="font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200 hover:text-amber-400 transition">
                                {player.name}
                              </span>
                              {player.award === 'MVP' && (
                                <span title={t('mvp')}>
                                  <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                </span>
                              )}
                              {player.award === 'TOP_SUPPORT' && (
                                <span title={t('topSupport')}>
                                  <Shield className="w-3 h-3 text-purple-400 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                              <span>{hero.displayName}</span>
                              <span>•</span>
                              <span style={{ color: rankInfo.color }}>{rankInfo.name}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
                          {player.role.replace('POSITION_', 'Pos ')}
                        </span>
                      </td>

                      {/* K / D / A */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-emerald-400">{player.kills}</span> /{' '}
                        <span className="text-rose-400">{player.deaths}</span> /{' '}
                        <span className="text-amber-400">{player.assists}</span>
                      </td>

                      {/* Networth */}
                      <td className="py-2.5 px-2 text-right font-bold text-amber-400">
                        {formatGold(player.networth)}
                      </td>

                      {/* GPM / XPM */}
                      <td className="py-2.5 px-2 text-right text-slate-300">
                        <span>{player.goldPerMinute}</span> / <span className="text-slate-500">{player.experiencePerMinute}</span>
                      </td>

                      {/* Hero Damage */}
                      <td className="py-2.5 px-2 text-right text-slate-300">
                        {player.heroDamage.toLocaleString()}
                      </td>

                      {/* Ally Healing */}
                      <td className="py-2.5 px-2 text-right font-mono">
                        {player.heroHealing > 0 ? (
                          <span className="text-teal-400 font-bold">{player.heroHealing.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Tower Damage */}
                      <td className="py-2.5 px-2 text-right text-slate-400">
                        {player.towerDamage.toLocaleString()}
                      </td>

                      {/* Items & Neutral */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {player.items.map((itemId, idx) => {
                            const item = getItem(itemId);
                            return (
                              <div
                                key={idx}
                                className="w-6 h-4.5 rounded bg-slate-950 border border-slate-800 overflow-hidden shrink-0"
                                title={item.displayName}
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.displayName}
                                    className="w-full h-full object-cover"
                                    onError={handleItemImageError}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                          {/* Neutral item */}
                          {player.neutralItem ? (
                            <div
                              className="w-5 h-4.5 rounded-full border border-amber-500/60 overflow-hidden shrink-0 ml-1 bg-slate-950"
                              title={getItem(player.neutralItem).displayName}
                            >
                              <img
                                src={getItem(player.neutralItem).imageUrl}
                                alt={t('neutralItemAlt')}
                                className="w-full h-full object-cover"
                                onError={handleItemImageError}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* IMP Rating */}
                      <td className="py-2.5 px-3 text-center">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black ${impStyle.bg} ${impStyle.text} ${impStyle.border}`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>{player.imp >= 0 ? `+${player.imp}` : player.imp}</span>
                        </div>
                      </td>

                      {/* Expand / Collapse Indicator */}
                      <td className="py-2.5 px-2 text-center text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 hover:text-slate-200" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Quick Inspection Drawer */}
                    {isExpanded && (
                      <tr className="bg-[#0b1019] border-y border-cyan-500/40">
                        <td colSpan={11} className="p-4 sm:p-5">
                          <div className="space-y-4 font-sans">
                            {/* Top Info Bar: Player Summary & Redirection Button */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                              <div className="flex items-center gap-3">
                                <img
                                  src={hero.avatarUrl}
                                  alt={hero.displayName}
                                  className="w-12 h-7 object-cover rounded-lg border border-slate-700 shadow-md"
                                  onError={handleHeroImageError}
                                />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-white">{player.name}</span>
                                    <span className="text-xs text-cyan-400 font-mono font-bold">({hero.displayName})</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                                      {formatRoleName(player.role)} • {formatLaneName(player.lane)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>
                                      {t('kda')}: <strong className="text-emerald-400">{player.kills}</strong> / <strong className="text-rose-400">{player.deaths}</strong> / <strong className="text-cyan-400">{player.assists}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>{t('farmShort')}: <strong className="text-amber-300">{player.goldPerMinute} {t('gpmShort')}</strong></span>
                                    <span>•</span>
                                    <span>{t('imp')}: <strong className={player.imp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{player.imp >= 0 ? `+${player.imp}` : player.imp}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Dedicated Redirect Button to Deep Performance Tab */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToPerformance(player.playerSlot);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40 border border-cyan-400/40 transition transform active:scale-95 shrink-0"
                              >
                                <span>{t('viewFullPerformance')}</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Section 1: Ordem e Tempo dos Itens Comprados (Sem Consumíveis, Flex-Wrap) */}
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2.5">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-cyan-400" />
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                    {t('itemOrderTitle')}
                                  </span>
                                  {hideConsumables && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                                      {t('coreItemsOnlyBadge')}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => setHideConsumables(!hideConsumables)}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition font-mono"
                                    title={t('toggleConsumablesTooltip')}
                                  >
                                    <Filter className="w-3 h-3 text-cyan-400" />
                                    <span>{hideConsumables ? t('showAllItems') : t('hideConsumables')}</span>
                                  </button>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {t('itemCount', { count: filteredTimings.length })}
                                  </span>
                                </div>
                              </div>

                              {filteredTimings.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2.5 pb-1 pt-1">
                                  {filteredTimings.map((itemEvent, idx) => {
                                    const item = getItem(itemEvent.itemId);
                                    const isCore = itemEvent.isCoreItem || item.cost >= 1800;

                                    return (
                                      <div
                                        key={idx}
                                        className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border transition-all ${
                                          isCore
                                            ? 'bg-slate-900/90 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                        }`}
                                        title={`${item.displayName} - ${item.cost > 0 ? formatGold(item.cost) : 'Item'}`}
                                      >
                                        {/* Item Icon */}
                                        <div className="w-8 h-6 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0 shadow-inner">
                                          <img
                                            src={item.imageUrl}
                                            alt={item.displayName}
                                            className="w-full h-full object-cover"
                                            onError={handleItemImageError}
                                          />
                                        </div>

                                        {/* Item Name & Buy Timing */}
                                        <div className="flex flex-col">
                                          <div className="text-[10px] font-bold text-slate-200 truncate max-w-[110px]" title={item.displayName}>
                                            {item.displayName}
                                          </div>
                                          <div className="flex items-center gap-1 text-[9px] font-mono">
                                            <span className={isCore ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                                              {formatPurchaseTime(itemEvent.time)}
                                            </span>
                                            {item.cost > 0 && (
                                              <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-amber-300">{formatGold(item.cost)}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 font-mono py-2">
                                  {t('noItemsForFilter')}
                                </div>
                              )}
                            </div>

                            {/* Section 2: Outros Detalhes Importantes (Combate, Laning e Estruturas) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
                              {/* 1. Dano em Heróis */}
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="text-[10px] text-slate-400 uppercase font-mono">{t('heroDamageFull')}</div>
                                <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                                  {player.heroDamage.toLocaleString()}
                                </div>
                              </div>

                              {/* 2. Dano em Torres */}
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="text-[10px] text-slate-400 uppercase font-mono">{t('towerDamageFull')}</div>
                                <div className="text-sm font-black text-amber-400 font-mono mt-0.5">
                                  {player.towerDamage.toLocaleString()}
                                </div>
                              </div>

                              {/* 3. Cura Realizada */}
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="text-[10px] text-slate-400 uppercase font-mono">{t('healingToAllies')}</div>
                                <div className="text-sm font-black text-teal-400 font-mono mt-0.5">
                                  {player.heroHealing.toLocaleString()}
                                </div>
                              </div>

                              {/* 4. Last Hits & Denies */}
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="text-[10px] text-slate-400 uppercase font-mono">{t('csLastHitsDenies')}</div>
                                <div className="text-sm font-black text-white font-mono mt-0.5">
                                  {player.numLastHits} / <span className="text-slate-400">{player.numDenies}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Global Expansion Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">
            {t('scoreboard')}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {t('scoreboardExpandedCount', { open: expandedSlots.size, total: players.length })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAllExpanded ? (
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-800 shadow-sm"
              title={t('collapseAllTooltip')}
            >
              <ChevronsDownUp className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('collapseAll')}</span>
            </button>
          ) : (
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-800 shadow-sm"
              title={t('expandAllTooltip')}
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('expandAll')}</span>
            </button>
          )}
        </div>
      </div>

      {renderTeamSection(radiantPlayers, true)}
      {renderTeamSection(direPlayers, false)}
    </div>
  );
};
