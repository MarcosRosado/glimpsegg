import type { PlayerMatchSummary } from '../types/dota';

/**
 * Agregado de uma fatia do anel de heróis do Início: um herói, ou "outros" (`heroId === null`)
 * com os heróis que não couberam.
 */
export interface HeroShareSlice {
  heroId: number | null;
  /** Quantos heróis a fatia junta: 1, ou o número de heróis em "outros". */
  heroCount: number;
  count: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  /** Soma e contagem só das partidas COM Glint: nota ausente nunca entra como 0. */
  glintSum: number;
  glintCount: number;
}

export interface HeroShare {
  total: number;
  wins: number;
  /** Mais jogado primeiro; "outros", quando existe, por último. */
  slices: HeroShareSlice[];
}

/**
 * Abaixo disto a fatia não ganha cor de winrate: com uma ou duas partidas o winrate só pode
 * ser 0%, 50% ou 100%, e pintar 100% de verde forte afirmaria um padrão que não existe.
 */
export const HERO_SHARE_MIN_SAMPLE = 3;

const emptySlice = (heroId: number | null): HeroShareSlice => ({
  heroId,
  heroCount: heroId === null ? 0 : 1,
  count: 0,
  wins: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  glintSum: 0,
  glintCount: 0,
});

function add(slice: HeroShareSlice, m: PlayerMatchSummary): void {
  slice.count += 1;
  if (m.isVictory) slice.wins += 1;
  slice.kills += m.kills;
  slice.deaths += m.deaths;
  slice.assists += m.assists;
  if (typeof m.glint === 'number' && Number.isFinite(m.glint)) {
    slice.glintSum += m.glint;
    slice.glintCount += 1;
  }
}

/**
 * Heróis das partidas dadas, do mais jogado ao menos. Passando de `maxSlices`, os que sobram
 * viram uma fatia "outros" — fatia de uma partida só vira um fio no anel e não se lê.
 * Empate de contagem: o herói jogado mais recentemente primeiro (a lista vem do mais novo).
 */
export function summarizeHeroShare(matches: PlayerMatchSummary[], maxSlices = 7): HeroShare {
  const byHero = new Map<number, HeroShareSlice & { firstIndex: number }>();
  matches.forEach((m, i) => {
    let s = byHero.get(m.heroId);
    if (!s) {
      s = { ...emptySlice(m.heroId), firstIndex: i };
      byHero.set(m.heroId, s);
    }
    add(s, m);
  });

  const ranked = [...byHero.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
  const strip = ({ firstIndex: _i, ...s }: HeroShareSlice & { firstIndex: number }): HeroShareSlice => s;

  let slices: HeroShareSlice[];
  if (ranked.length <= maxSlices) {
    slices = ranked.map(strip);
  } else {
    // Uma fatia a menos para os heróis: "outros" ocupa a última vaga.
    const kept = ranked.slice(0, Math.max(1, maxSlices - 1)).map(strip);
    const other = emptySlice(null);
    for (const s of ranked.slice(kept.length)) {
      other.heroCount += 1;
      other.count += s.count;
      other.wins += s.wins;
      other.kills += s.kills;
      other.deaths += s.deaths;
      other.assists += s.assists;
      other.glintSum += s.glintSum;
      other.glintCount += s.glintCount;
    }
    slices = [...kept, other];
  }

  return { total: matches.length, wins: matches.filter((m) => m.isVictory).length, slices };
}

/**
 * Posição da fatia na escala divergente de winrate, de -1 (derrotas) a +1 (vitórias), com 0 no
 * neutro. Satura a 25 pontos de 50%. `null` abaixo da amostra mínima: a fatia fica neutra.
 */
export function winRateTilt(slice: Pick<HeroShareSlice, 'count' | 'wins'>): number | null {
  if (slice.count < HERO_SHARE_MIN_SAMPLE) return null;
  const wr = (slice.wins / slice.count) * 100;
  return Math.max(-1, Math.min(1, (wr - 50) / 25));
}
