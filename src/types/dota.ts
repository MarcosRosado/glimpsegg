export type Role = 'POSITION_1' | 'POSITION_2' | 'POSITION_3' | 'POSITION_4' | 'POSITION_5' | 'UNKNOWN';
export type Lane = 'SAFE' | 'MID' | 'OFF' | 'JUNGLE' | 'ROAMING' | 'UNKNOWN';
export type MatchDynamicType = 'COMEBACK' | 'STOMP' | 'STOMP_LANE' | 'WIN_LANE' | 'DRAW_LANE' | 'LOST_LANE' | 'EVEN_MATCH';

export interface HeroMetadata {
  id: number;
  name: string;
  shortName: string;
  displayName: string;
  primaryAttr: 'str' | 'agi' | 'int' | 'all';
  roles: string[];
  avatarUrl: string;
  iconUrl: string;
}

export interface ItemMetadata {
  id: number;
  name: string;
  displayName: string;
  cost: number;
  isNeutral: boolean;
  tier?: number;
  imageUrl: string;
}

export interface WardPlacement {
  id?: string;
  time: number; // in seconds
  type: 'OBSERVER' | 'SENTRY';
  x: number; // Dota 2 coordinate
  y: number; // Dota 2 coordinate
  isRadiant: boolean;
  duration?: number;
  wasKilled?: boolean;
}

export interface ItemTimingEvent {
  itemId: number;
  time: number; // in seconds
  benchmarkTime?: number;
  isCoreItem?: boolean;
}

export interface AbilityUpgrade {
  abilityId?: number;
  name: string;
  displayName: string;
  slot?: 'Q' | 'W' | 'E' | 'D' | 'F' | 'R' | 'TALENT';
  imageUrl: string;
  level: number;
  timeSec: number;
  isTalent?: boolean;
  isUltimate?: boolean;
  type?: 'SKILL' | 'TALENT';
}

export interface DetailedCombatStats {
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  damageReceived: number;
  damageMitigated: number;
  stunDurationSec: number;
  disableDurationSec: number;
  healingProvided: number;
  soloKills: number;
  doubleKills: number;
  tripleKills: number;
  ultraKills: number;
  rampages: number;
  killstreakMax: number;
  firstBloodClaimed?: boolean;
}

export interface DetailedFarmStats {
  cs5Min: number;
  cs10Min: number;
  cs15Min: number;
  cs20Min: number;
  laneCreepGold: number;
  neutralGold: number;
  heroKillGold: number;
  towerGold: number;
  passiveGold: number;
  campsStacked: number;
  stacksCleared: number;
  runesBounty: number;
  runesPower: number;
  runesWisdom: number;
}

export interface DetailedObjectiveStats {
  roshanKills: number;
  tormentorParticipation: number;
  courierKills: number;
  towerKills: number;
  barracksKills: number;
  buybackCount: number;
  outpostsCaptured?: number;
}

export interface LaningStats {
  lastHits10: number;
  denies10: number;
  gold10: number;
  exp10: number;
  laneEfficiencyPct: number;
  firstCoreItemTimingSec: number;
  firstCoreItemId: number;
  killsInLane: number;
  deathsInLane: number;
}

export interface RadarStats {
  laning: number; // 0 - 100
  farming: number; // 0 - 100
  fighting: number; // 0 - 100
  survivability: number; // 0 - 100
  objectives: number; // 0 - 100
}

export interface CoachingInsight {
  id: string;
  type: 'STRENGTH' | 'IMPROVEMENT';
  category: 'LANING' | 'FARMING' | 'FIGHTING' | 'VISION' | 'DISCIPLINE' | 'OBJECTIVE';
  title: string;
  description: string;
  statValue?: string;
  benchmarkValue?: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  timestampSec?: number;
}

export interface MatchPlayer {
  steamAccountId: string;
  name: string;
  avatar: string;
  seasonRank: number;
  isRadiant: boolean;
  playerSlot: number;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  numLastHits: number;
  numDenies: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  networth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  imp: number; // STRATZ IMP or our custom calculated IMP
  role: Role;
  lane: Lane;
  award?: string;
  items: number[];
  backpack: number[];
  neutralItem?: number;
  laningStats?: LaningStats;
  wardEvents?: WardPlacement[];
  itemTimings?: ItemTimingEvent[];
  abilityUpgrades?: AbilityUpgrade[];
  combatStats?: DetailedCombatStats;
  farmStats?: DetailedFarmStats;
  objectiveStats?: DetailedObjectiveStats;
  csOverTime?: number[];
  networthOverTime?: number[];
  heroDamageDealt?: number;
  heroDamageReceived?: number;
}

export interface AdvantagePoint {
  minute: number;
  goldAdvantage: number; // > 0 Radiant, < 0 Dire
  experienceAdvantage: number;
  radiantScore?: number;
  direScore?: number;
}

export interface MatchDetails {
  id: string;
  didRadiantWin: boolean;
  durationSeconds: number;
  startDateTime: number; // Unix timestamp
  gameMode: string;
  lobbyType: string;
  radiantScore: number;
  direScore: number;
  radiantNetworth: number;
  direNetworth: number;
  players: MatchPlayer[];
  advantageTimeline: AdvantagePoint[];
}

export interface PeerTeammate {
  accountId: number;
  name: string;
  avatar: string;
  withGames: number;
  withWin: number;
  winRateWith: number;
  againstGames: number;
  againstWin: number;
  lastPlayed?: number;
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  wins: number;
  losses: number;
}

export interface PlayerProfileSummary {
  steamAccountId: string;
  steamId64: string;
  name: string;
  avatar: string;
  profileUri?: string;
  seasonRank: number;
  leaderboardRank?: number;
  totalMatches: number;
  winCount: number;
  winRate: number;
  recentMatches: PlayerMatchSummary[];
  mostPlayedHeroes: Array<{
    heroId: number;
    matchCount: number;
    winCount: number;
    winRate: number;
    avgKda: number;
    avgImp: number;
  }>;
  peers?: PeerTeammate[];
  activityDays?: ActivityDay[];
}

export interface ProfileHistoryItem {
  steamAccountId: string;
  steamId64?: string;
  name: string;
  avatar: string;
  seasonRank?: number;
  leaderboardRank?: number;
  lastSearched: number;
  isFavorite: boolean;
}

export interface PlayerMatchSummary {
  matchId: string;
  heroId: number;
  isRadiant: boolean;
  isVictory: boolean;
  durationSeconds: number;
  startDateTime: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  numLastHits: number;
  numDenies: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  imp: number;
  role: Role;
  lane: Lane;
  award?: string;
  dynamicType?: MatchDynamicType;
  items: number[];
  neutralItem?: number;
}

