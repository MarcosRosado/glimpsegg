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
  /**
   * Média do Glint (experimental, 0-100) SÓ das partidas que têm nota. `null` quando
   * nenhuma tem: zero seria uma nota, e a UI esconde a métrica em vez de exibi-lo.
   */
  avgGlint: number | null;
  /** Quantas partidas da amostra entraram em `avgGlint` — é o "N" que a UI declara. */
  glintCount: number;
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
  avgGlint: null,
  glintCount: 0,
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

  // Os `|| 0` são obrigatórios: campos numéricos podem vir nulos da API.
  const sum = (pick: (m: PlayerMatchSummary) => number) =>
    sample.reduce((acc, m) => acc + (pick(m) || 0), 0);

  const wins = sample.filter((m) => m.isVictory).length;
  const totalKills = sum((m) => m.kills);
  const totalDeaths = sum((m) => m.deaths);
  const totalAssists = sum((m) => m.assists);

  // O Glint fica FORA do `sum` acima de propósito: ali nulo vira 0, e para uma nota de
  // 0 a 100 isso puxaria a média para baixo a cada partida sem tabela de percentil.
  const glints = sample
    .map((m) => m.glint)
    .filter((g): g is number => typeof g === 'number' && Number.isFinite(g));

  return {
    count,
    wins,
    losses: count - wins,
    winRate: Math.round((wins / count) * 100),
    avgGlint: glints.length > 0 ? Math.round(glints.reduce((a, g) => a + g, 0) / glints.length) : null,
    glintCount: glints.length,
    avgKills: totalKills / count,
    avgDeaths: totalDeaths / count,
    avgAssists: totalAssists / count,
    kdaRatio: (totalKills + totalAssists) / Math.max(1, totalDeaths),
    avgGpm: Math.round(sum((m) => m.goldPerMinute) / count),
    avgXpm: Math.round(sum((m) => m.experiencePerMinute) / count),
  };
}
