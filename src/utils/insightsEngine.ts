import { CoachingInsight, MatchDetails, MatchPlayer } from '../types/dota';
import { getRoleBaseline } from '../constants/baselines';
import { getItem } from '../constants/items';
import { formatDuration, formatGold } from './dotaFormatters';

/**
 * Evaluates a player's match performance and extracts 3 Major Strengths
 * and 3 Actionable Improvements with specific advice.
 */
export function generateMatchInsights(player: MatchPlayer, match: MatchDetails): {
  strengths: CoachingInsight[];
  improvements: CoachingInsight[];
} {
  const baseline = getRoleBaseline(player.role);
  const durationMin = match.durationSeconds / 60;
  const isWinner = (player.isRadiant && match.didRadiantWin) || (!player.isRadiant && !match.didRadiantWin);
  
  // Calculate team stats
  const teamPlayers = match.players.filter((p) => p.isRadiant === player.isRadiant);
  const teamKills = teamPlayers.reduce((sum, p) => sum + p.kills, 0);
  const teamDamage = teamPlayers.reduce((sum, p) => sum + p.heroDamage, 0);
  
  const playerKP = teamKills > 0 ? Math.round(((player.kills + player.assists) / teamKills) * 100) : 0;
  const playerDmgShare = teamDamage > 0 ? Math.round((player.heroDamage / teamDamage) * 100) : 0;
  const hdPerMin = Math.round(player.heroDamage / Math.max(1, durationMin));

  const candidateStrengths: CoachingInsight[] = [];
  const candidateImprovements: CoachingInsight[] = [];

  // --- 1. LANING PHASE CHECKS ---
  if (player.laningStats && player.laningStats.lastHits10 > 0) {
    const lh10 = player.laningStats.lastHits10;
    const dn10 = player.laningStats.denies10;

    if (lh10 >= baseline.cs10Min * 1.1) {
      candidateStrengths.push({
        id: 'str-laning-lh',
        type: 'STRENGTH',
        category: 'LANING',
        title: 'Dominant Laning Phase',
        description: `Secured ${lh10} last hits at 10 minutes (${Math.round(((lh10 - baseline.cs10Min) / baseline.cs10Min) * 100)}% above role target), establishing strong lane control.`,
        statValue: `${lh10} CS @ 10m`,
        benchmarkValue: `${baseline.cs10Min} CS Target`,
        impact: 'HIGH',
      });
    } else if (lh10 < baseline.cs10Min * 0.75 && (player.role === 'POSITION_1' || player.role === 'POSITION_2')) {
      candidateImprovements.push({
        id: 'imp-laning-lh',
        type: 'IMPROVEMENT',
        category: 'LANING',
        title: 'Low Laning Farm Output',
        description: `Only ${lh10} last hits at 10 minutes. Focus on creep aggro, pulling creeps to your ranged creep, and avoiding unnecessary trades when wave is under tower.`,
        statValue: `${lh10} CS @ 10m`,
        benchmarkValue: `${baseline.cs10Min} CS Target`,
        impact: 'HIGH',
      });
    }

    if (dn10 >= baseline.denies10Min * 1.3 && dn10 >= 8) {
      candidateStrengths.push({
        id: 'str-laning-dn',
        type: 'STRENGTH',
        category: 'LANING',
        title: 'Exceptional Wave Denial',
        description: `Starved enemy lane opponents of experience with ${dn10} denies in the first 10 minutes.`,
        statValue: `${dn10} Denies`,
        benchmarkValue: `${baseline.denies10Min} Average`,
        impact: 'MEDIUM',
      });
    }
  }

  // --- 2. ITEM TIMINGS ---
  if (player.itemTimings && player.itemTimings.length > 0) {
    const firstCore = player.itemTimings.find((t) => t.isCoreItem || [116, 145, 147, 137, 1, 108, 166].includes(t.itemId));
    if (firstCore) {
      const coreItemMeta = getItem(firstCore.itemId);
      const timeMin = firstCore.time / 60;
      if (timeMin <= baseline.firstCoreTimingMin) {
        candidateStrengths.push({
          id: 'str-item-timing',
          type: 'STRENGTH',
          category: 'FARMING',
          title: `Rapid ${coreItemMeta.displayName} Spike`,
          description: `Completed ${coreItemMeta.displayName} at ${formatDuration(firstCore.time)}, hitting your first primary power spike ahead of schedule.`,
          statValue: formatDuration(firstCore.time),
          benchmarkValue: `${baseline.firstCoreTimingMin}:00 Target`,
          impact: 'HIGH',
          timestampSec: firstCore.time,
        });
      } else if (timeMin > baseline.firstCoreTimingMin + 4 && (player.role === 'POSITION_1' || player.role === 'POSITION_2' || player.role === 'POSITION_3')) {
        candidateImprovements.push({
          id: 'imp-item-timing',
          type: 'IMPROVEMENT',
          category: 'FARMING',
          title: `Delayed ${coreItemMeta.displayName} Timing`,
          description: `${coreItemMeta.displayName} arrived late at ${formatDuration(firstCore.time)}. Optimize early lane rotations and avoid getting pulled into non-impact skirmishes before your spike.`,
          statValue: formatDuration(firstCore.time),
          benchmarkValue: `${baseline.firstCoreTimingMin}:00 Target`,
          impact: 'HIGH',
          timestampSec: firstCore.time,
        });
      }
    }
  }

  // --- 3. TEAMFIGHT & KILL PARTICIPATION ---
  if (playerKP >= baseline.killParticipationPct + 10) {
    candidateStrengths.push({
      id: 'str-fight-kp',
      type: 'STRENGTH',
      category: 'FIGHTING',
      title: 'High Teamfight Presence',
      description: `Involved in ${playerKP}% of all team kills (${player.kills} kills + ${player.assists} assists), demonstrating strong rotational tempo.`,
      statValue: `${playerKP}% KP`,
      benchmarkValue: `${baseline.killParticipationPct}% Baseline`,
      impact: 'HIGH',
    });
  } else if (playerKP < baseline.killParticipationPct - 18 && teamKills >= 15) {
    candidateImprovements.push({
      id: 'imp-fight-kp',
      type: 'IMPROVEMENT',
      category: 'FIGHTING',
      title: 'Low Kill Participation',
      description: `Only ${playerKP}% kill participation. Carry TP scrolls to respond to tower dives or communicate with team to align smoke timings with your ultimate.`,
      statValue: `${playerKP}% KP`,
      benchmarkValue: `${baseline.killParticipationPct}% Baseline`,
      impact: 'MEDIUM',
    });
  }

  // --- 4. DAMAGE SHARE ---
  if (playerDmgShare >= 30 && (player.role === 'POSITION_1' || player.role === 'POSITION_2' || player.role === 'POSITION_3')) {
    candidateStrengths.push({
      id: 'str-dmg-share',
      type: 'STRENGTH',
      category: 'FIGHTING',
      title: 'Primary Damage Engine',
      description: `Dealt ${playerDmgShare}% of entire team's damage (${player.heroDamage.toLocaleString()} total, ${hdPerMin}/min).`,
      statValue: `${playerDmgShare}% Team Dmg`,
      benchmarkValue: `22% Expected`,
      impact: 'HIGH',
    });
  }

  // --- 5. SURVIVABILITY & DISCIPLINE (DEATHS) ---
  if (player.deaths <= 2 && durationMin >= 25) {
    candidateStrengths.push({
      id: 'str-low-deaths',
      type: 'STRENGTH',
      category: 'DISCIPLINE',
      title: 'Impeccable Positioning',
      description: `Surrendered only ${player.deaths} deaths across a ${Math.round(durationMin)}-minute game, giving minimal catchup gold to opponents.`,
      statValue: `${player.deaths} Deaths`,
      benchmarkValue: `< ${baseline.maxAcceptableDeaths} Allowed`,
      impact: 'HIGH',
    });
  } else if (player.deaths >= baseline.maxAcceptableDeaths + 3) {
    candidateImprovements.push({
      id: 'imp-high-deaths',
      type: 'IMPROVEMENT',
      category: 'DISCIPLINE',
      title: 'Excessive Death Count',
      description: `Died ${player.deaths} times. In the mid-to-late game, ensure vision before crossing river and monitor minimap when enemies are off the map.`,
      statValue: `${player.deaths} Deaths`,
      benchmarkValue: `< ${baseline.maxAcceptableDeaths} Target`,
      impact: 'HIGH',
    });
  }

  // --- 6. OBJECTIVES (TOWER DAMAGE) ---
  if (player.towerDamage >= baseline.towerDamage * 1.4 && player.towerDamage >= 3000) {
    candidateStrengths.push({
      id: 'str-tower-dmg',
      type: 'STRENGTH',
      category: 'OBJECTIVE',
      title: 'Heavy Building Pressure',
      description: `Demolished structures with ${player.towerDamage.toLocaleString()} Tower Damage, converting teamfight victories into map objectives.`,
      statValue: `${player.towerDamage.toLocaleString()} TD`,
      benchmarkValue: `${baseline.towerDamage.toLocaleString()} Target`,
      impact: 'MEDIUM',
    });
  } else if (player.towerDamage < 500 && (player.role === 'POSITION_1' || player.role === 'POSITION_2') && durationMin > 30) {
    candidateImprovements.push({
      id: 'imp-tower-dmg',
      type: 'IMPROVEMENT',
      category: 'OBJECTIVE',
      title: 'Passive Objective Conversion',
      description: `Only ${player.towerDamage} Tower Damage on a core hero. After winning fights, immediately hit nearest tower or take Tormentor/Roshan instead of returning to jungle camps.`,
      statValue: `${player.towerDamage} TD`,
      benchmarkValue: `${baseline.towerDamage.toLocaleString()} Target`,
      impact: 'MEDIUM',
    });
  }

  // --- 7. VISION / SUPPORT VALUE ---
  const wardCount = player.wardEvents ? player.wardEvents.length : 0;
  if ((player.role === 'POSITION_4' || player.role === 'POSITION_5') && wardCount >= 18) {
    candidateStrengths.push({
      id: 'str-vision-coverage',
      type: 'STRENGTH',
      category: 'VISION',
      title: 'Elite Vision Control',
      description: `Placed ${wardCount} wards (Observers & Sentries), locking down crucial Roshan pit and jungle choke points.`,
      statValue: `${wardCount} Wards`,
      benchmarkValue: `${baseline.wardsPlaced + baseline.sentriesPlaced} Baseline`,
      impact: 'HIGH',
    });
  } else if ((player.role === 'POSITION_4' || player.role === 'POSITION_5') && wardCount < 8 && durationMin > 25) {
    candidateImprovements.push({
      id: 'imp-vision-deficit',
      type: 'IMPROVEMENT',
      category: 'VISION',
      title: 'Low Vision Investment',
      description: `Only placed ${wardCount} wards. Ensure Observer Wards never remain at 2 stock in the shop and use Sentries to unblock neutral camps.`,
      statValue: `${wardCount} Wards`,
      benchmarkValue: `${baseline.wardsPlaced + baseline.sentriesPlaced} Target`,
      impact: 'HIGH',
    });
  }

  // Fallbacks to guarantee exactly 3 top strengths and 3 improvements
  if (candidateStrengths.length < 3) {
    if (player.goldPerMinute >= baseline.gpm) {
      candidateStrengths.push({
        id: 'str-gpm-pace',
        type: 'STRENGTH',
        category: 'FARMING',
        title: 'Consistent Economy Scaling',
        description: `Maintained ${player.goldPerMinute} GPM (${formatGold(player.networth)} total networth), allowing reliable late-game item progression.`,
        statValue: `${player.goldPerMinute} GPM`,
        benchmarkValue: `${baseline.gpm} Target`,
        impact: 'MEDIUM',
      });
    } else {
      candidateStrengths.push({
        id: 'str-general-kda',
        type: 'STRENGTH',
        category: 'FIGHTING',
        title: 'Solid Combat Output',
        description: `Delivered ${player.kills} kills and ${player.assists} assists for an overall KDA of ${((player.kills + player.assists) / Math.max(1, player.deaths)).toFixed(1)}.`,
        statValue: `${player.kills}/${player.deaths}/${player.assists}`,
        benchmarkValue: `${baseline.kda} KDA Ratio`,
        impact: 'LOW',
      });
    }
  }

  if (candidateStrengths.length < 3) {
    candidateStrengths.push({
      id: 'str-neutral-utility',
      type: 'STRENGTH',
      category: 'DISCIPLINE',
      title: 'Neutral Item Readiness',
      description: `Consistently secured and slotted timely neutral item upgrades to maximize stat efficiency in team encounters.`,
      statValue: 'Tier Active',
      benchmarkValue: 'On-time Tier slots',
      impact: 'LOW',
    });
  }

  if (candidateImprovements.length < 3) {
    candidateImprovements.push({
      id: 'imp-bkb-timing',
      type: 'IMPROVEMENT',
      category: 'DISCIPLINE',
      title: 'Defensive Dispel Readiness',
      description: `Review defensive counter-items (BKB, Manta, Lotus Orb or Linken's) when opponents possess high lock-down disables.`,
      statValue: 'Dispel Timings',
      benchmarkValue: 'Reactive Counter',
      impact: 'MEDIUM',
    });
  }

  if (candidateImprovements.length < 3) {
    candidateImprovements.push({
      id: 'imp-buyback-discipline',
      type: 'IMPROVEMENT',
      category: 'DISCIPLINE',
      title: 'Late Game Buyback Reserve',
      description: `Always maintain active Buyback gold past the 30:00 minute mark, especially before contesting Roshan or high-ground pushes.`,
      statValue: 'Buyback Security',
      benchmarkValue: 'Always Ready >30m',
      impact: 'HIGH',
    });
  }

  return {
    strengths: candidateStrengths.slice(0, 3),
    improvements: candidateImprovements.slice(0, 3),
  };
}
