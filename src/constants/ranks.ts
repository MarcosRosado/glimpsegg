export interface RankTierInfo {
  tier: number;
  name: string;
  subTier: number;
  fullName: string;
  approxMmr: number;
  badgeUrl: string;
  starUrl?: string;
  color: string;
}

const VALVE_RANK_IMG_BASE = 'https://www.opendota.com/assets/images/dota2/rank_icons';

export const RANK_NAMES: Record<number, string> = {
  1: 'Herald',
  2: 'Guardian',
  3: 'Crusader',
  4: 'Archon',
  5: 'Legend',
  6: 'Ancient',
  7: 'Divine',
  8: 'Immortal',
};

export const RANK_COLORS: Record<number, string> = {
  1: '#a1a1aa', // Zinc
  2: '#60a5fa', // Blue
  3: '#34d399', // Emerald
  4: '#fbbf24', // Amber
  5: '#f87171', // Red/Orange
  6: '#c084fc', // Purple
  7: '#e879f9', // Pink
  8: '#f59e0b', // Gold Immortal
};

export function getRankTierInfo(seasonRank?: number, leaderboardRank?: number): RankTierInfo {
  if (!seasonRank || seasonRank <= 0) {
    return {
      tier: 0,
      name: 'Uncalibrated',
      subTier: 0,
      fullName: 'Uncalibrated',
      approxMmr: 1000,
      badgeUrl: `${VALVE_RANK_IMG_BASE}/rank_icon_0.png`,
      color: '#71717a',
    };
  }

  const tier = Math.floor(seasonRank / 10);
  const subTier = seasonRank % 10;
  const name = RANK_NAMES[tier] || 'Immortal';

  // Approximate MMR estimation formula
  let baseMmr = 0;
  if (tier === 1) baseMmr = 0 + subTier * 150;
  else if (tier === 2) baseMmr = 770 + subTier * 150;
  else if (tier === 3) baseMmr = 1540 + subTier * 150;
  else if (tier === 4) baseMmr = 2310 + subTier * 150;
  else if (tier === 5) baseMmr = 3080 + subTier * 150;
  else if (tier === 6) baseMmr = 3850 + subTier * 150;
  else if (tier === 7) baseMmr = 4620 + subTier * 150;
  else if (tier === 8) baseMmr = 5600 + (leaderboardRank ? Math.max(0, 10000 - leaderboardRank * 2) : 500);

  const fullName = tier === 8 
    ? (leaderboardRank ? `Immortal #${leaderboardRank}` : 'Immortal')
    : `${name} [${subTier}]`;

  return {
    tier,
    name,
    subTier,
    fullName,
    approxMmr: baseMmr,
    badgeUrl: `${VALVE_RANK_IMG_BASE}/rank_icon_${tier}.png`,
    starUrl: subTier > 0 && tier < 8 ? `${VALVE_RANK_IMG_BASE}/rank_star_${subTier}.png` : undefined,
    color: RANK_COLORS[tier] || '#f59e0b',
  };
}
