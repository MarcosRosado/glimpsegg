import { HeroAverageEntry, PlayerTimeSeries, Role } from '../../types/dota';

/**
 * O UNICO modulo que indexa as series por minuto da STRATZ.
 *
 * POR QUE ISSO É CENTRALIZADO
 * ---------------------------
 * Os arrays da API tem duas semanticas diferentes e nada no nome deles avisa qual:
 *
 *   lastHitsPerMinute, deniesPerMinute, campStack, heroDamagePerMinute, ...
 *       => DELTA por minuto. Indice i cobre o minuto i -> i+1.
 *          Verificado: sum(lastHitsPerMinute) === numLastHits.
 *          Logo CS@10 = soma dos 10 primeiros.
 *
 *   networthPerMinute
 *       => CUMULATIVO. Indice i é o valor NO minuto i.
 *          Verificado: [600, 899, 1026, ...] e o ultimo === networth.
 *          Logo networth@10 = arr[10], NAO a soma.
 *
 *   heroAverage[]
 *       => CUMULATIVO e com campo `timeMin` proprio. Indexe pelo campo, nunca pela
 *          posicao no array.
 *
 * Trocar soma por indexacao aqui produz erro de ~4,5x e um card afirmando que o
 * jogador estava catastroficamente atras. É o erro mais caro possivel neste codigo.
 */

/** Soma um array de DELTA por minuto no intervalo [fromMin, toMinExclusive). */
export function sumDeltas(
  arr: number[] | null | undefined,
  fromMin: number,
  toMinExclusive: number,
): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const from = Math.max(0, Math.floor(fromMin));
  const to = Math.min(arr.length, Math.floor(toMinExclusive));
  if (to <= from) return null;
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    const v = arr[i];
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
  }
  return sum;
}

/** Soma o array de DELTA inteiro. */
export function sumAll(arr: number[] | null | undefined): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return sumDeltas(arr, 0, arr.length);
}

/**
 * Le um array CUMULATIVO no minuto `min`.
 * Retorna null se a serie termina antes — nao extrapola.
 */
export function cumulativeAt(arr: number[] | null | undefined, min: number): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const i = Math.floor(min);
  if (i < 0 || i >= arr.length) return null;
  const v = arr[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Ultimo valor de um array cumulativo. */
export function cumulativeLast(arr: number[] | null | undefined): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return cumulativeAt(arr, arr.length - 1);
}

/**
 * Amostra minima para tratar a curva `heroAverage` como benchmark confiavel.
 * Abaixo disso preferimos degradar para ROLE_BASELINE a fingir precisao.
 */
export const HERO_AVERAGE_MIN_SAMPLE = 200;

/**
 * Le a curva `heroAverage` no minuto `min`.
 *
 * - Indexa pelo campo `timeMin`, nunca pela posicao no array.
 * - Filtra pela `position` do jogador quando informada; se essa posicao nao existe
 *   na curva, cai para a de maior `matchCount`.
 * - Retorna null passado o fim da curva (em vez de clampar) e null quando a amostra
 *   é fina — comparacao alem do alcance da curva é PULADA, nao aproximada.
 */
export function heroAverageAt(
  curve: HeroAverageEntry[] | null | undefined,
  min: number,
  position?: Role | string,
): HeroAverageEntry | null {
  if (!Array.isArray(curve) || curve.length === 0) return null;

  let pool = curve;
  if (position) {
    const forPosition = curve.filter((e) => e.position === position);
    if (forPosition.length > 0) {
      pool = forPosition;
    } else {
      // Sem a posicao pedida: usa a posicao mais representada na curva.
      const byPosition = new Map<string, { count: number; entries: HeroAverageEntry[] }>();
      for (const e of curve) {
        const key = String(e.position);
        const bucket = byPosition.get(key);
        if (bucket) {
          bucket.count = Math.max(bucket.count, e.matchCount);
          bucket.entries.push(e);
        } else {
          byPosition.set(key, { count: e.matchCount, entries: [e] });
        }
      }
      let best: HeroAverageEntry[] | null = null;
      let bestCount = -1;
      for (const bucket of byPosition.values()) {
        if (bucket.count > bestCount) {
          bestCount = bucket.count;
          best = bucket.entries;
        }
      }
      if (best) pool = best;
    }
  }

  const target = Math.floor(min);
  const entry = pool.find((e) => e.timeMin === target);
  if (!entry) return null;
  if (entry.matchCount < HERO_AVERAGE_MIN_SAMPLE) return null;
  return entry;
}

/** O maior `timeMin` presente na curva — alem dele nao existe benchmark. */
export function heroAverageMaxMinute(curve: HeroAverageEntry[] | null | undefined): number | null {
  if (!Array.isArray(curve) || curve.length === 0) return null;
  return curve.reduce((max, e) => (e.timeMin > max ? e.timeMin : max), -Infinity);
}

/** Helper: as series tem dado utilizavel? */
export function hasSeriesData(series: PlayerTimeSeries | null | undefined): boolean {
  if (!series) return false;
  return (
    (Array.isArray(series.lastHitsPerMinute) && series.lastHitsPerMinute.length > 0) ||
    (Array.isArray(series.networthPerMinute) && series.networthPerMinute.length > 0)
  );
}
