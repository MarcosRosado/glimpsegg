import { MatchPlayer, MatchDetails, DetailedCombatStats, DetailedFarmStats, DetailedObjectiveStats, AbilityUpgrade } from '../types/dota';
import { getItem } from '../constants/items';
import { getHero } from '../constants/heroes';
import { getHeroAbilities } from '../constants/abilities';

// Standard benchmarks for core items (seconds)
const ITEM_BENCHMARKS: Record<number, number> = {
  145: 840,  // Battle Fury (14:00)
  147: 1200, // Manta Style (20:00)
  116: 1440, // Black King Bar (24:00)
  139: 1800, // Butterfly (30:00)
  208: 2100, // Abyssal Blade (35:00)
  1: 840,    // Blink Dagger (14:00)
  108: 1260, // Aghanim's Scepter (21:00)
  218: 960,  // Glimmer Cape (16:00)
  232: 900,  // Aether Lens (15:00)
  121: 1020, // Orchid (17:00)
  686: 1560, // Bloodthorn (26:00)
  640: 1920, // Kaya and Sange (32:00)
  152: 1200, // Shadow Blade (20:00)
  249: 1680, // Silver Edge (28:00)
  114: 1500, // Heart of Tarrasque (25:00)
  149: 1080, // Crystalys (18:00)
  141: 1620, // Daedalus (27:00)
  158: 1380, // Sange and Yasha (23:00)
  174: 1260, // Diffusal Blade (21:00)
  236: 1320, // Dragon Lance (22:00)
  263: 1680, // Hurricane Pike (28:00)
  166: 780,  // Maelstrom (13:00)
  247: 1560, // Mjollnir (26:00)
  137: 1260, // Radiance (21:00)
  156: 1500, // Satanic (25:00)
  180: 360,  // Arcane Boots (6:00)
  63: 270,   // Power Treads (4:30)
  50: 270,   // Phase Boots (4:30)
};

/**
 * Returns benchmark timing in seconds for a given item, or default estimation based on gold cost
 */
export function getItemBenchmarkSeconds(itemId: number, cost: number): number {
  if (ITEM_BENCHMARKS[itemId]) return ITEM_BENCHMARKS[itemId];
  if (cost >= 5000) return 1800; // ~30 min
  if (cost >= 4000) return 1440; // ~24 min
  if (cost >= 2500) return 1080; // ~18 min
  if (cost >= 1500) return 720;  // ~12 min
  if (cost >= 800) return 360;   // ~6 min
  return 180; // ~3 min
}

/**
 * Enriches a player with detailed combat stats if missing
 */
export function getEnrichedCombatStats(player: MatchPlayer, durationSec: number): DetailedCombatStats {
  if (player.combatStats) return player.combatStats;

  const totalDmg = Math.max(1000, player.heroDamage);
  const isCaster = ['POSITION_2', 'POSITION_4', 'POSITION_5'].includes(player.role);
  
  const magicPct = isCaster ? 0.65 : 0.25;
  const physPct = isCaster ? 0.25 : 0.68;
  const purePct = Math.max(0.05, 1 - (magicPct + physPct));

  const physicalDamage = Math.round(totalDmg * physPct);
  const magicalDamage = Math.round(totalDmg * magicPct);
  const pureDamage = Math.round(totalDmg * purePct);

  const damageReceived = player.heroDamageReceived || Math.round(player.deaths * 2400 + totalDmg * 0.45);
  const damageMitigated = Math.round(damageReceived * 0.42);

  const baseStun = player.role === 'POSITION_4' || player.role === 'POSITION_5' ? 38.5 : 16.2;
  const stunDurationSec = parseFloat((baseStun + (player.assists * 1.8)).toFixed(1));
  const disableDurationSec = parseFloat((stunDurationSec * 1.45).toFixed(1));

  const healingProvided = player.heroHealing || (player.role === 'POSITION_5' ? 4850 : player.role === 'POSITION_4' ? 2200 : 450);

  const kills = player.kills;
  const doubleKills = Math.floor(kills / 3);
  const tripleKills = Math.floor(kills / 6);
  const ultraKills = kills >= 10 ? 1 : 0;
  const rampages = kills >= 14 ? 1 : 0;
  const soloKills = Math.max(0, Math.floor(kills * 0.35));
  const killstreakMax = Math.min(kills, Math.max(3, kills - player.deaths + 2));

  return {
    physicalDamage,
    magicalDamage,
    pureDamage,
    damageReceived,
    damageMitigated,
    stunDurationSec,
    disableDurationSec,
    healingProvided,
    soloKills,
    doubleKills,
    tripleKills,
    ultraKills,
    rampages,
    killstreakMax,
    firstBloodClaimed: kills >= 8 && player.isRadiant,
  };
}

/**
 * Enriches a player with detailed farming and economy stats
 */
export function getEnrichedFarmStats(player: MatchPlayer, durationSec: number): DetailedFarmStats {
  if (player.farmStats) return player.farmStats;

  const totalCS = Math.max(1, player.numLastHits);
  const cs10 = player.laningStats?.lastHits10 || Math.round(totalCS * 0.22);
  const cs5 = Math.round(cs10 * 0.45);
  const cs15 = Math.round(cs10 + (totalCS - cs10) * 0.35);
  const cs20 = Math.round(cs10 + (totalCS - cs10) * 0.6);

  const networth = Math.max(1000, player.networth);
  const isCore = ['POSITION_1', 'POSITION_2', 'POSITION_3'].includes(player.role);

  const laneCreepGold = Math.round(networth * (isCore ? 0.48 : 0.32));
  const neutralGold = Math.round(networth * (isCore ? 0.28 : 0.12));
  const heroKillGold = Math.round(player.kills * 280 + player.assists * 135);
  const towerGold = Math.round(networth * 0.08);
  const passiveGold = Math.max(500, networth - (laneCreepGold + neutralGold + heroKillGold + towerGold));

  const isSupport = ['POSITION_4', 'POSITION_5'].includes(player.role);
  const campsStacked = isSupport ? Math.floor(durationSec / 320) : Math.floor(durationSec / 900);
  const stacksCleared = isCore ? Math.floor(durationSec / 450) : 1;

  const runesBounty = Math.floor(durationSec / 360);
  const runesPower = player.role === 'POSITION_2' ? Math.floor(durationSec / 240) : Math.floor(durationSec / 600);
  const runesWisdom = Math.floor(durationSec / 420);

  return {
    cs5Min: cs5,
    cs10Min: cs10,
    cs15Min: cs15,
    cs20Min: cs20,
    laneCreepGold,
    neutralGold,
    heroKillGold,
    towerGold,
    passiveGold,
    campsStacked,
    stacksCleared,
    runesBounty,
    runesPower,
    runesWisdom,
  };
}

/**
 * Enriches objective participation stats
 */
export function getEnrichedObjectiveStats(player: MatchPlayer, durationSec: number): DetailedObjectiveStats {
  if (player.objectiveStats) return player.objectiveStats;

  const roshanKills = Math.min(3, Math.floor(durationSec / 900));
  const tormentorParticipation = durationSec >= 1200 ? 1 : 0;
  const courierKills = player.role === 'POSITION_4' ? 1 : 0;
  const towerKills = Math.max(1, Math.floor(player.towerDamage / 2200));
  const barracksKills = Math.floor(player.towerDamage / 4500);
  const buybackCount = player.deaths >= 4 ? 1 : 0;

  return {
    roshanKills,
    tormentorParticipation,
    courierKills,
    towerKills,
    barracksKills,
    buybackCount,
    outpostsCaptured: Math.floor(durationSec / 720),
  };
}

/**
 * Returns realistic ability level upgrade sequence for the hero with real names and icons
 */
export function getEnrichedAbilityUpgrades(player: MatchPlayer, durationSec: number): AbilityUpgrade[] {
  if (player.abilityUpgrades && player.abilityUpgrades.length > 0) return player.abilityUpgrades;

  const hero = getHero(player.heroId);
  const heroAbilities = getHeroAbilities(player.heroId, hero.shortName);
  const qSkill = heroAbilities.find((a) => a.slot === 'Q') || heroAbilities[0];
  const wSkill = heroAbilities.find((a) => a.slot === 'W') || heroAbilities[1] || heroAbilities[0];
  const eSkill = heroAbilities.find((a) => a.slot === 'E') || heroAbilities[2] || heroAbilities[0];
  const rSkill = heroAbilities.find((a) => a.slot === 'R' || a.isUltimate) || heroAbilities[3] || heroAbilities[0];

  const upgrades: AbilityUpgrade[] = [];
  const maxLevel = Math.min(30, Math.max(16, Math.floor(player.experiencePerMinute * (durationSec / 60) / 820)));

  // Standard build order pattern (Q/W/E prioritization, Ultimates at 6, 12, 18, Talents at 10, 15, 20, 25)
  // Level 1: Q (or W)
  // Level 2: E
  // Level 3: Q
  // Level 4: W
  // Level 5: Q
  // Level 6: R
  // Level 7: Q (Max Q)
  // Level 8: E
  // Level 9: E
  // Level 10: Talent
  // Level 11: E (Max E)
  // Level 12: R
  // Level 13: W
  // Level 14: W (Max W)
  // Level 15: Talent
  // Level 16: Stat/Skill
  // Level 18: R
  // Level 20: Talent
  // Level 25: Talent

  const levelSkillMap: Record<number, { skill: typeof qSkill; slot: 'Q'|'W'|'E'|'R'|'TALENT'; isTalent?: boolean; isUlt?: boolean }> = {
    1: { skill: qSkill, slot: 'Q' },
    2: { skill: eSkill, slot: 'E' },
    3: { skill: qSkill, slot: 'Q' },
    4: { skill: wSkill, slot: 'W' },
    5: { skill: qSkill, slot: 'Q' },
    6: { skill: rSkill, slot: 'R', isUlt: true },
    7: { skill: qSkill, slot: 'Q' },
    8: { skill: eSkill, slot: 'E' },
    9: { skill: eSkill, slot: 'E' },
    10: { skill: { name: 'talent_10', displayName: 'Talento Nvl 10', slot: 'TALENT', imageUrl: '' }, slot: 'TALENT', isTalent: true },
    11: { skill: eSkill, slot: 'E' },
    12: { skill: rSkill, slot: 'R', isUlt: true },
    13: { skill: wSkill, slot: 'W' },
    14: { skill: wSkill, slot: 'W' },
    15: { skill: { name: 'talent_15', displayName: 'Talento Nvl 15', slot: 'TALENT', imageUrl: '' }, slot: 'TALENT', isTalent: true },
    16: { skill: wSkill, slot: 'W' },
    17: { skill: qSkill, slot: 'Q' },
    18: { skill: rSkill, slot: 'R', isUlt: true },
    19: { skill: eSkill, slot: 'E' },
    20: { skill: { name: 'talent_20', displayName: 'Talento Nvl 20', slot: 'TALENT', imageUrl: '' }, slot: 'TALENT', isTalent: true },
    21: { skill: qSkill, slot: 'Q' },
    22: { skill: wSkill, slot: 'W' },
    23: { skill: eSkill, slot: 'E' },
    24: { skill: qSkill, slot: 'Q' },
    25: { skill: { name: 'talent_25', displayName: 'Talento Nvl 25', slot: 'TALENT', imageUrl: '' }, slot: 'TALENT', isTalent: true },
  };

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const timeSec = Math.round((lvl / maxLevel) * durationSec * 0.9 + 50);
    const mapped = levelSkillMap[lvl];

    if (mapped) {
      upgrades.push({
        name: mapped.skill.name,
        displayName: mapped.skill.displayName,
        slot: mapped.slot,
        imageUrl: mapped.skill.imageUrl,
        level: lvl,
        timeSec,
        isTalent: mapped.isTalent || false,
        isUltimate: mapped.isUlt || false,
        type: mapped.isTalent ? 'TALENT' : 'SKILL',
      });
    } else {
      upgrades.push({
        name: `attr_bonus_${lvl}`,
        displayName: `Atributos +2`,
        slot: 'TALENT',
        imageUrl: '',
        level: lvl,
        timeSec,
        isTalent: true,
        type: 'TALENT',
      });
    }
  }

  return upgrades;
}
