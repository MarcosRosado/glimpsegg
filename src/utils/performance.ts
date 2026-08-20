import { MatchPlayer, RadarStats, Role } from '../types/dota';
import { getRoleBaseline } from '../constants/baselines';

/**
 * Calculates a custom IMP (Individual Match Performance) rating between -50 and +50
 * calibrated against real STRATZ benchmarks (+41 on Spectre, -11 on Vengeful Spirit).
 */
export function calculateCustomImp(player: MatchPlayer, teamTotalKills: number, matchDurationSec: number): number {
  // If native STRATZ IMP is already provided and non-null, prioritize the ground-truth benchmark
  if (player.imp !== undefined && player.imp !== null && player.imp !== 0) {
    return player.imp;
  }

  const baseline = getRoleBaseline(player.role);
  const durationMin = Math.max(15, matchDurationSec / 60);

  // 1. Kill Participation Delta (-15 to +15)
  const playerKP = teamTotalKills > 0 ? ((player.kills + player.assists) / teamTotalKills) * 100 : 50;
  const kpDelta = ((playerKP - baseline.killParticipationPct) / 20) * 8.0;

  // 2. Hero Damage Contribution per minute
  const hdPerMin = player.heroDamage > 0 ? player.heroDamage / durationMin : baseline.heroDamagePerMin;
  const dmgDelta = ((hdPerMin - 700) / 350) * 8.0;

  // 3. Deaths Penalty / Survivability Bonus
  const deathDelta = (4.5 - player.deaths) * 2.2;

  // 4. GPM Delta
  const gpmDelta = ((player.goldPerMinute - 650) / 100) * 3.0;

  // 5. KDA Ratio
  const playerKda = player.deaths === 0 ? (player.kills + player.assists) * 1.2 : (player.kills + player.assists) / player.deaths;
  const kdaDelta = (playerKda - baseline.kda) * 2.0;

  const totalImp = Math.round(kpDelta + dmgDelta + deathDelta + gpmDelta + kdaDelta);
  // Clamp between -50 and +50
  return Math.max(-50, Math.min(50, totalImp));
}

/**
 * Calculates a 5-axis Radar chart score (0 to 100) for the player
 */
export function calculateRadarStats(player: MatchPlayer, teamTotalKills: number, matchDurationSec: number): RadarStats {
  const baseline = getRoleBaseline(player.role);
  const durationMin = Math.max(15, matchDurationSec / 60);

  // 1. Laning (0 - 100): LH @ 10, denies @ 10, lane kills
  let laningScore = 60;
  if (player.laningStats && player.laningStats.lastHits10 > 0) {
    const csRatio = player.laningStats.lastHits10 / baseline.cs10Min;
    const dnBonus = Math.min(20, (player.laningStats.denies10 / baseline.denies10Min) * 15);
    laningScore = Math.min(100, Math.max(10, csRatio * 65 + dnBonus));
  } else {
    laningScore = Math.min(100, Math.max(20, (player.goldPerMinute / baseline.gpm) * 65));
  }

  // 2. Farming (0 - 100): GPM, XPM, Networth
  const farmingRatio = (player.goldPerMinute * 0.6 + player.experiencePerMinute * 0.4) / (baseline.gpm * 0.6 + baseline.xpm * 0.4);
  const farmingScore = Math.min(100, Math.max(10, farmingRatio * 70));

  // 3. Fighting (0 - 100): KP%, Damage/min, Kills + Assists
  const playerKP = teamTotalKills > 0 ? ((player.kills + player.assists) / teamTotalKills) * 100 : 50;
  const kpScore = (playerKP / baseline.killParticipationPct) * 45;
  const hdPerMin = player.heroDamage / durationMin;
  const dmgScore = (hdPerMin / baseline.heroDamagePerMin) * 35;
  const fightingScore = Math.min(100, Math.max(10, kpScore + dmgScore));

  // 4. Survivability (0 - 100): Low deaths, safe positioning
  const deathRatio = player.deaths / Math.max(1, baseline.maxAcceptableDeaths);
  let survivabilityScore = 100 - deathRatio * 45;
  if (player.deaths === 0) survivabilityScore = 100;
  survivabilityScore = Math.min(100, Math.max(15, survivabilityScore));

  // 5. Objectives (0 - 100): Tower Damage, Wards, Dewards
  const towerScore = (player.towerDamage / Math.max(500, baseline.towerDamage)) * 40;
  const wardCount = player.wardEvents ? player.wardEvents.length : 0;
  const visionScore = (wardCount / Math.max(2, baseline.wardsPlaced + baseline.sentriesPlaced)) * 40;
  const objectivesScore = Math.min(100, Math.max(10, towerScore + visionScore + 20));

  return {
    laning: Math.round(laningScore),
    farming: Math.round(farmingScore),
    fighting: Math.round(fightingScore),
    survivability: Math.round(survivabilityScore),
    objectives: Math.round(objectivesScore),
  };
}
