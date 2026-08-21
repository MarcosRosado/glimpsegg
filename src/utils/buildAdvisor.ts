import { ItemTimingEvent } from '../types/dota';
import { wilsonLowerBound, wilsonUpperBound } from './insights/wilson';
import { ThreatArchetype, ThreatProfile } from './insights/threatProfile';
import { COUNTER_ITEMS } from '../constants/counterItems';

/**
 * Recomendador de build, 100% puro.
 *
 * A SACADA CENTRAL: "item de build" é definido como "item que aparece no
 * `itemFullPurchase` deste heroi/posicao/ranque". Isso torna IRRELEVANTE a ausencia
 * de metadado de componente no ITEMS_MAP — o agregado da propria API so contem itens
 * completos, entao intersectar as compras do jogador (que incluem consumivel e
 * componente) com esse conjunto devolve exatamente a build real, com zero
 * conhecimento de grafo de itens.
 */

/** Uma linha de `heroStats.itemFullPurchase`. `time` vem em MINUTOS. */
export interface ItemFullPurchaseRow {
  itemId: number;
  timeMin: number;
  matchCount: number;
  winCount: number;
}

export type BuildVerdictKind = 'LATE' | 'MISSING' | 'OFF_META' | 'GOOD' | 'COUNTER_PICK';

export interface BuildVerdict {
  kind: BuildVerdictKind;
  itemId: number;
  playerTimeMin?: number;
  bestBandMin?: [number, number];
  bestBandWinRate?: number;
  playerBandWinRate?: number;
  heroBaselineWinRate: number;
  sampleSize: number;
  threatArchetype?: ThreatArchetype;
  attributedHeroId?: number;
  attributedAbilityId?: number;
  /** 0..1, alimenta o score das regras. */
  magnitude: number;
}

export interface BuildAdvice {
  verdicts: BuildVerdict[];
  heroBaselineWinRate: number;
  /** Quantas partidas sustentam o agregado inteiro. */
  totalSample: number;
  bracketIsPlayerSpecific: boolean;
}

/** Amostra minima por janela de tempo para um veredito. */
const MIN_BAND_SAMPLE = 150;
/** Amostra minima para acusar um item de estar abaixo da media. */
const MIN_OFF_META_SAMPLE = 300;
/** Diferenca minima de win rate (em pontos) para valer um veredito. */
const MIN_WR_GAP_POINTS = 4;
const OFF_META_GAP_POINTS = 5;
const BAND_WIDTH_MIN = 3;
const LATE_TOLERANCE_MIN = 3;

const MAX_LATE = 2;
const MAX_MISSING = 2;
const MAX_OFF_META = 1;
const MAX_GOOD = 2;
const MAX_COUNTER = 2;

interface ItemAggregate {
  itemId: number;
  totalMatches: number;
  totalWins: number;
  wilsonLower: number;
  wilsonUpper: number;
  /** Minuto -> {n, wins} */
  byMinute: Map<number, { n: number; wins: number }>;
  p50Min: number;
}

function aggregate(rows: ItemFullPurchaseRow[]): Map<number, ItemAggregate> {
  const map = new Map<number, ItemAggregate>();
  for (const r of rows) {
    if (!r || typeof r.itemId !== 'number' || r.itemId <= 0) continue;
    let agg = map.get(r.itemId);
    if (!agg) {
      agg = {
        itemId: r.itemId,
        totalMatches: 0,
        totalWins: 0,
        wilsonLower: 0,
        wilsonUpper: 0,
        byMinute: new Map(),
        p50Min: 0,
      };
      map.set(r.itemId, agg);
    }
    agg.totalMatches += r.matchCount;
    agg.totalWins += r.winCount;
    const slot = agg.byMinute.get(r.timeMin);
    if (slot) {
      slot.n += r.matchCount;
      slot.wins += r.winCount;
    } else {
      agg.byMinute.set(r.timeMin, { n: r.matchCount, wins: r.winCount });
    }
  }

  for (const agg of map.values()) {
    agg.wilsonLower = wilsonLowerBound(agg.totalWins, agg.totalMatches);
    agg.wilsonUpper = wilsonUpperBound(agg.totalWins, agg.totalMatches);
    agg.p50Min = weightedMedianMinute(agg.byMinute);
  }
  return map;
}

function weightedMedianMinute(byMinute: Map<number, { n: number; wins: number }>): number {
  const minutes = [...byMinute.entries()].sort((a, b) => a[0] - b[0]);
  const total = minutes.reduce((sum, [, v]) => sum + v.n, 0);
  if (total === 0) return 0;
  let acc = 0;
  for (const [min, v] of minutes) {
    acc += v.n;
    if (acc >= total / 2) return min;
  }
  return minutes[minutes.length - 1][0];
}

/** Melhor janela contigua de 3 minutos, por limite inferior de Wilson. */
function bestBand(
  agg: ItemAggregate,
): { range: [number, number]; winRate: number; n: number } | null {
  const minutes = [...agg.byMinute.keys()].sort((a, b) => a - b);
  if (minutes.length === 0) return null;
  let best: { range: [number, number]; winRate: number; n: number } | null = null;
  for (const start of minutes) {
    let n = 0;
    let wins = 0;
    for (let m = start; m < start + BAND_WIDTH_MIN; m += 1) {
      const slot = agg.byMinute.get(m);
      if (slot) {
        n += slot.n;
        wins += slot.wins;
      }
    }
    if (n < MIN_BAND_SAMPLE) continue;
    const wr = wilsonLowerBound(wins, n);
    if (!best || wr > best.winRate) {
      best = { range: [start, start + BAND_WIDTH_MIN - 1], winRate: wr, n };
    }
  }
  return best;
}

/** Win rate da janela de 3 minutos que contem `minute`. */
function bandAround(agg: ItemAggregate, minute: number): { winRate: number; n: number } | null {
  let n = 0;
  let wins = 0;
  for (let m = minute - 1; m <= minute + 1; m += 1) {
    const slot = agg.byMinute.get(m);
    if (slot) {
      n += slot.n;
      wins += slot.wins;
    }
  }
  if (n < MIN_BAND_SAMPLE) return null;
  return { winRate: wilsonLowerBound(wins, n), n };
}

/** Magnitude a partir de uma diferenca de win rate: 15 pontos ~= 1.0. */
function magnitudeFromGap(gapPoints: number): number {
  return Math.max(0, Math.min(1, gapPoints / 15));
}

export function computeBuildAdvice(input: {
  /** Compras REAIS do jogador. `time` em SEGUNDOS. */
  purchases: ItemTimingEvent[] | null | undefined;
  fullPurchase: ItemFullPurchaseRow[] | null | undefined;
  threat: ThreatProfile | null;
  durationMin: number;
  bracketIsPlayerSpecific: boolean;
}): BuildAdvice | null {
  const { purchases, fullPurchase, threat, durationMin, bracketIsPlayerSpecific } = input;
  if (!Array.isArray(fullPurchase) || fullPurchase.length === 0) return null;

  const aggregates = aggregate(fullPurchase);
  if (aggregates.size === 0) return null;

  const totalSample = [...aggregates.values()].reduce((s, a) => s + a.totalMatches, 0);
  const totalWins = [...aggregates.values()].reduce((s, a) => s + a.totalWins, 0);
  const heroBaselineWinRate = totalSample > 0 ? totalWins / totalSample : 0;

  // Build real do jogador = compras INTERSECTADAS com o universo de itens do agregado.
  // Isso descarta consumivel e componente sem precisar de grafo de itens.
  const playerFirstBuy = new Map<number, number>();
  for (const p of purchases ?? []) {
    if (!aggregates.has(p.itemId)) continue;
    const min = Math.floor(p.time / 60); // compras vem em SEGUNDOS
    const prev = playerFirstBuy.get(p.itemId);
    if (prev === undefined || min < prev) playerFirstBuy.set(p.itemId, min);
  }

  const verdicts: BuildVerdict[] = [];
  const counts: Record<BuildVerdictKind, number> = {
    LATE: 0,
    MISSING: 0,
    OFF_META: 0,
    GOOD: 0,
    COUNTER_PICK: 0,
  };
  const push = (v: BuildVerdict, max: number) => {
    if (counts[v.kind] >= max) return;
    counts[v.kind] += 1;
    verdicts.push(v);
  };

  // --- Itens que o jogador comprou: LATE / OFF_META / GOOD ---
  const bought = [...playerFirstBuy.entries()].sort((a, b) => a[1] - b[1]);
  for (const [itemId, playerMin] of bought) {
    const agg = aggregates.get(itemId)!;
    const band = bestBand(agg);
    if (!band) continue;

    const playerBand = bandAround(agg, playerMin);
    const late = playerMin > band.range[1] + LATE_TOLERANCE_MIN;
    const gapPoints = playerBand ? (band.winRate - playerBand.winRate) * 100 : 0;

    if (late && playerBand && gapPoints >= MIN_WR_GAP_POINTS) {
      push(
        {
          kind: 'LATE',
          itemId,
          playerTimeMin: playerMin,
          bestBandMin: band.range,
          bestBandWinRate: band.winRate,
          playerBandWinRate: playerBand.winRate,
          heroBaselineWinRate,
          sampleSize: band.n,
          magnitude: magnitudeFromGap(gapPoints),
        },
        MAX_LATE,
      );
      continue;
    }

    // OFF_META: usa o limite SUPERIOR — so acusa se nem o melhor caso salva o item.
    if (
      agg.totalMatches >= MIN_OFF_META_SAMPLE &&
      agg.wilsonUpper * 100 < heroBaselineWinRate * 100 - OFF_META_GAP_POINTS
    ) {
      push(
        {
          kind: 'OFF_META',
          itemId,
          playerTimeMin: playerMin,
          bestBandWinRate: agg.wilsonUpper,
          heroBaselineWinRate,
          sampleSize: agg.totalMatches,
          magnitude: magnitudeFromGap(
            (heroBaselineWinRate - agg.wilsonUpper) * 100,
          ),
        },
        MAX_OFF_META,
      );
      continue;
    }

    if (playerMin <= band.range[1] && agg.wilsonLower > heroBaselineWinRate) {
      push(
        {
          kind: 'GOOD',
          itemId,
          playerTimeMin: playerMin,
          bestBandMin: band.range,
          bestBandWinRate: band.winRate,
          heroBaselineWinRate,
          sampleSize: agg.totalMatches,
          magnitude: magnitudeFromGap((agg.wilsonLower - heroBaselineWinRate) * 100),
        },
        MAX_GOOD,
      );
    }
  }

  // --- MISSING: top itens por Wilson que o jogador nao comprou ---
  const ranked = [...aggregates.values()]
    .filter((a) => a.totalMatches >= MIN_OFF_META_SAMPLE)
    .sort((a, b) => b.wilsonLower - a.wilsonLower)
    .slice(0, 5);
  for (const agg of ranked) {
    if (playerFirstBuy.has(agg.itemId)) continue;
    // Nunca apontar item que a partida acabou antes de ele existir.
    if (agg.p50Min > durationMin - 4) continue;
    if (agg.wilsonLower <= heroBaselineWinRate) continue;
    push(
      {
        kind: 'MISSING',
        itemId: agg.itemId,
        bestBandMin: [agg.p50Min, agg.p50Min],
        bestBandWinRate: agg.wilsonLower,
        heroBaselineWinRate,
        sampleSize: agg.totalMatches,
        magnitude: magnitudeFromGap((agg.wilsonLower - heroBaselineWinRate) * 100),
      },
      MAX_MISSING,
    );
  }

  // --- COUNTER_PICK: arquetipo medido x item curado x win rate real ---
  if (threat) {
    for (const archetype of threat.archetypes) {
      const candidates = COUNTER_ITEMS[archetype] ?? [];
      for (const itemId of candidates) {
        const agg = aggregates.get(itemId);
        // A lista curada PROPOE; o win rate do agregado APROVA. Se o item nao vence
        // neste heroi/posicao/patch, ele sai sozinho.
        if (!agg || agg.totalMatches < MIN_BAND_SAMPLE) continue;
        if (agg.wilsonLower <= heroBaselineWinRate) continue;

        const playerMin = playerFirstBuy.get(itemId);
        const band = bestBand(agg);
        const bandRange = band ? band.range : ([agg.p50Min, agg.p50Min] as [number, number]);

        // Ja comprou dentro da janela? Nao é conselho, é acerto — nao repetir aqui.
        if (playerMin !== undefined && playerMin <= bandRange[1] + LATE_TOLERANCE_MIN) continue;

        push(
          {
            kind: 'COUNTER_PICK',
            itemId,
            playerTimeMin: playerMin,
            bestBandMin: bandRange,
            bestBandWinRate: band ? band.winRate : agg.wilsonLower,
            heroBaselineWinRate,
            sampleSize: band ? band.n : agg.totalMatches,
            threatArchetype: archetype,
            attributedHeroId: threat.topAttacker?.heroId,
            attributedAbilityId: threat.topAbility?.abilityId,
            magnitude: Math.max(
              magnitudeFromGap((agg.wilsonLower - heroBaselineWinRate) * 100),
              0.5,
            ),
          },
          MAX_COUNTER,
        );
        break; // um item por arquetipo basta
      }
    }
  }

  if (verdicts.length === 0) return null;

  return { verdicts, heroBaselineWinRate, totalSample, bracketIsPlayerSpecific };
}
