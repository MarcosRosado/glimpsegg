import { PlayerMatchSummary } from '../types/dota';

/**
 * Agregados das últimas partidas, compartilhados pela stat rail do topbar e pelo
 * RecentFormCard — antes cada um calculava o mesmo por conta própria.
 *
 * Devolve números, não strings: formatar é decisão de quem renderiza.
 */
export interface RecentFormStats {
  count: number;
  wins: number;
  losses: number;
  /** Já arredondado, 0-100. */
  winRate: number;
  avgImp: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  /** (kills + assists) / deaths, com piso de 1 morte para não estourar em Infinity. */
  kdaRatio: number;
  avgGpm: number;
  avgXpm: number;
}

const EMPTY: RecentFormStats = {
  count: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  avgImp: 0,
  avgKills: 0,
  avgDeaths: 0,
  avgAssists: 0,
  kdaRatio: 0,
  avgGpm: 0,
  avgXpm: 0,
};

export function computeRecentFormStats(
  matches: PlayerMatchSummary[] | undefined,
  sampleSize = 10,
): RecentFormStats {
  const sample = matches?.slice(0, sampleSize) || [];
  const count = sample.length;
  if (count === 0) return EMPTY;

  // Os `|| 0` são obrigatórios: campos como `imp` podem vir nulos da API.
  const sum = (pick: (m: PlayerMatchSummary) => number) =>
    sample.reduce((acc, m) => acc + (pick(m) || 0), 0);

  const wins = sample.filter((m) => m.isVictory).length;
  const totalKills = sum((m) => m.kills);
  const totalDeaths = sum((m) => m.deaths);
  const totalAssists = sum((m) => m.assists);

  return {
    count,
    wins,
    losses: count - wins,
    winRate: Math.round((wins / count) * 100),
    avgImp: Math.round(sum((m) => m.imp) / count),
    avgKills: totalKills / count,
    avgDeaths: totalDeaths / count,
    avgAssists: totalAssists / count,
    kdaRatio: (totalKills + totalAssists) / Math.max(1, totalDeaths),
    avgGpm: Math.round(sum((m) => m.goldPerMinute) / count),
    avgXpm: Math.round(sum((m) => m.experiencePerMinute) / count),
  };
}
