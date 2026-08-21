/**
 * Limites de confianca de Wilson para proporcao binomial.
 *
 * Todo comparativo de win rate no recomendador de build passa por aqui. Sem isso,
 * um item com 3 partidas e 100% de vitoria supera um com 2.553 partidas e 73% —
 * e o app recomendaria ruido estatistico com toda a confianca.
 */

/** z para 95% de confianca. */
export const Z_95 = 1.959963984540054;

function bounds(wins: number, n: number, z: number): { lower: number; upper: number } {
  if (!Number.isFinite(wins) || !Number.isFinite(n) || n <= 0) return { lower: 0, upper: 0 };
  const w = Math.max(0, Math.min(wins, n));
  const p = w / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lower: Math.max(0, (centre - margin) / denom),
    upper: Math.min(1, (centre + margin) / denom),
  };
}

/** Estimativa conservadora: use para RANQUEAR e para afirmar "isto é bom". */
export function wilsonLowerBound(wins: number, n: number, z: number = Z_95): number {
  return bounds(wins, n, z).lower;
}

/** Estimativa otimista: use para afirmar "isto é ruim" (so acusa se nem o melhor caso salva). */
export function wilsonUpperBound(wins: number, n: number, z: number = Z_95): number {
  return bounds(wins, n, z).upper;
}
