import { MatchDetails, MatchPlayer } from '../types/dota';

export type AwardType = 'EXTREME_MVP' | 'MVP' | 'TOP_CORE' | 'TOP_SUPPORT' | 'LVP' | 'EXTREME_LVP';

export interface PlayerAwardInfo {
  playerSlot: number;
  heroId: number;
  playerName: string;
  isRadiant: boolean;
  award: AwardType;
  title: string;
  subtitle: string;
  badgeColor: string;
  glowColor: string;
  score: number;
  highlightStats: string;
}

export interface TeamAggregates {
  radiantKills: number;
  direKills: number;
  radiantNetworth: number;
  direNetworth: number;
  radiantHeroDamage: number;
  direHeroDamage: number;
  radiantTowerDamage: number;
  direTowerDamage: number;
  radiantHealing: number;
  direHealing: number;
  radiantWards: number;
  direWards: number;
}

export function computeMatchAwards(match: MatchDetails): {
  awards: PlayerAwardInfo[];
  aggregates: TeamAggregates;
} {
  const players = match.players || [];
  if (players.length === 0) {
    return {
      awards: [],
      aggregates: {
        radiantKills: match.radiantScore,
        direKills: match.direScore,
        radiantNetworth: match.radiantNetworth,
        direNetworth: match.direNetworth,
        radiantHeroDamage: 0,
        direHeroDamage: 0,
        radiantTowerDamage: 0,
        direTowerDamage: 0,
        radiantHealing: 0,
        direHealing: 0,
        radiantWards: 0,
        direWards: 0,
      },
    };
  }

  // Calculate Aggregates
  let radiantHeroDamage = 0;
  let direHeroDamage = 0;
  let radiantTowerDamage = 0;
  let direTowerDamage = 0;
  let radiantHealing = 0;
  let direHealing = 0;
  let radiantWards = 0;
  let direWards = 0;

  players.forEach((p) => {
    if (p.isRadiant) {
      radiantHeroDamage += p.heroDamage || 0;
      radiantTowerDamage += p.towerDamage || 0;
      radiantHealing += p.heroHealing || 0;
      radiantWards += (p.wardEvents ? p.wardEvents.length : 4);
    } else {
      direHeroDamage += p.heroDamage || 0;
      direTowerDamage += p.towerDamage || 0;
      direHealing += p.heroHealing || 0;
      direWards += (p.wardEvents ? p.wardEvents.length : 3);
    }
  });

  const aggregates: TeamAggregates = {
    radiantKills: match.radiantScore || players.filter((p) => p.isRadiant).reduce((s, p) => s + p.kills, 0),
    direKills: match.direScore || players.filter((p) => !p.isRadiant).reduce((s, p) => s + p.kills, 0),
    radiantNetworth: match.radiantNetworth || players.filter((p) => p.isRadiant).reduce((s, p) => s + p.networth, 0),
    direNetworth: match.direNetworth || players.filter((p) => !p.isRadiant).reduce((s, p) => s + p.networth, 0),
    radiantHeroDamage,
    direHeroDamage,
    radiantTowerDamage,
    direTowerDamage,
    radiantHealing,
    direHealing,
    radiantWards,
    direWards,
  };

  // Sort players by IMP / Impact
  const sortedByImp = [...players].sort((a, b) => (b.imp || 0) - (a.imp || 0));
  const topPlayer = sortedByImp[0];
  const lowestPlayer = sortedByImp[sortedByImp.length - 1];

  const awards: PlayerAwardInfo[] = [];

  // 1. MVP or EXTREME MVP
  if (topPlayer) {
    const isExtreme = (topPlayer.imp || 0) >= 30 || (topPlayer.kills >= 20 && topPlayer.deaths <= 4);
    awards.push({
      playerSlot: topPlayer.playerSlot,
      heroId: topPlayer.heroId,
      playerName: topPlayer.name,
      isRadiant: topPlayer.isRadiant,
      award: isExtreme ? 'EXTREME_MVP' : 'MVP',
      title: isExtreme ? 'EXTREME MVP' : 'MVP',
      subtitle: isExtreme ? 'Desempenho lendário com impacto decisivo' : 'Maior impacto na partida',
      badgeColor: isExtreme ? 'from-amber-400 to-yellow-500 text-black' : 'from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/50',
      glowColor: '#f59e0b',
      score: topPlayer.imp || 0,
      highlightStats: `${topPlayer.kills}/${topPlayer.deaths}/${topPlayer.assists} • ${topPlayer.goldPerMinute} GPM • +${topPlayer.imp} IMP`,
    });
  }

  // 2. TOP CORE (Pos 1, 2, 3)
  const cores = players.filter((p) => ['POSITION_1', 'POSITION_2', 'POSITION_3'].includes(p.role));
  const topCore = [...cores].sort((a, b) => {
    // Score based on networth + damage + imp
    const scoreA = (a.networth * 0.4) + (a.heroDamage * 0.4) + ((a.imp || 0) * 500);
    const scoreB = (b.networth * 0.4) + (b.heroDamage * 0.4) + ((b.imp || 0) * 500);
    return scoreB - scoreA;
  })[0];

  if (topCore && (!topPlayer || topCore.playerSlot !== topPlayer.playerSlot)) {
    awards.push({
      playerSlot: topCore.playerSlot,
      heroId: topCore.heroId,
      playerName: topCore.name,
      isRadiant: topCore.isRadiant,
      award: 'TOP_CORE',
      title: 'TOP CORE',
      subtitle: 'Melhor eficiência de farm, combate e dano',
      badgeColor: 'from-purple-500/30 to-indigo-600/30 text-purple-200 border border-purple-500/50',
      glowColor: '#a855f7',
      score: topCore.imp || 0,
      highlightStats: `${topCore.kills}/${topCore.deaths}/${topCore.assists} • ${topCore.heroDamage.toLocaleString()} Dano • ${topCore.goldPerMinute} GPM`,
    });
  }

  // 3. TOP SUPPORT (Pos 4, 5)
  const supports = players.filter((p) => ['POSITION_4', 'POSITION_5'].includes(p.role));
  const topSupport = [...supports].sort((a, b) => {
    const scoreA = (a.assists * 800) + (a.heroHealing * 1.2) + ((a.imp || 0) * 400);
    const scoreB = (b.assists * 800) + (b.heroHealing * 1.2) + ((b.imp || 0) * 400);
    return scoreB - scoreA;
  })[0];

  if (topSupport) {
    awards.push({
      playerSlot: topSupport.playerSlot,
      heroId: topSupport.heroId,
      playerName: topSupport.name,
      isRadiant: topSupport.isRadiant,
      award: 'TOP_SUPPORT',
      title: 'TOP SUPPORT',
      subtitle: 'Maior utilidade, controle de visão e assistências',
      badgeColor: 'from-teal-500/30 to-emerald-600/30 text-teal-200 border border-teal-500/50',
      glowColor: '#14b8a6',
      score: topSupport.imp || 0,
      highlightStats: `${topSupport.assists} Assistências • ${topSupport.kills} Kills • ${topSupport.imp >= 0 ? '+' + topSupport.imp : topSupport.imp} IMP`,
    });
  }

  // 4. LVP or EXTREME LVP
  if (lowestPlayer && (lowestPlayer.imp || 0) < -5) {
    const isExtremeLvp = (lowestPlayer.imp || 0) <= -15 || lowestPlayer.deaths >= 10;
    awards.push({
      playerSlot: lowestPlayer.playerSlot,
      heroId: lowestPlayer.heroId,
      playerName: lowestPlayer.name,
      isRadiant: lowestPlayer.isRadiant,
      award: isExtremeLvp ? 'EXTREME_LVP' : 'LVP',
      title: isExtremeLvp ? 'EXTREME LVP' : 'LVP',
      subtitle: isExtremeLvp ? 'Alto número de mortes críticas e menor impacto' : 'Menor contribuição líquida na partida',
      badgeColor: isExtremeLvp ? 'from-rose-600/40 to-red-800/40 text-rose-300 border border-rose-500/60' : 'from-rose-900/30 to-red-950/30 text-rose-400 border border-rose-700/40',
      glowColor: '#f43f5e',
      score: lowestPlayer.imp || 0,
      highlightStats: `${lowestPlayer.kills}/${lowestPlayer.deaths}/${lowestPlayer.assists} • ${lowestPlayer.imp} IMP`,
    });
  }

  return { awards, aggregates };
}
