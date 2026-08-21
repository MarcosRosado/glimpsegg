import { HeroAverageEntry, MatchDetails, MatchPlayer } from '../../types/dota';
import { heroAverageAt, heroAverageMaxMinute } from './timeSeries';
import { wilsonLowerBound } from './wilson';

/**
 * Perfil de ameaca DERIVADO DA PARTIDA MEDIDA.
 *
 * A alternativa seria uma tabela de counters por heroi (126x126), que apodrece a cada
 * patch. Aqui cada arquetipo sai de um campo real da resposta da STRATZ: a divisao
 * fisico/magico do dano recebido, a razao de controle contra a media do proprio heroi,
 * tempo invisivel do inimigo, cura do time inimigo. Isso é o que permite a frase
 * causal — "porque 62% do dano foi magico" — que win rate puro nao consegue produzir.
 */

export type ThreatArchetype =
  | 'MAGIC_BURST'
  | 'PHYSICAL_RIGHT_CLICK'
  | 'HARD_LOCKDOWN'
  | 'PURE_DAMAGE'
  | 'SLOW_KITE'
  | 'INVISIBILITY'
  | 'HEAL_SUSTAIN';

export interface ThreatSource {
  heroId: number;
  amount: number;
  pct: number;
}

export interface ThreatAbility {
  abilityId: number;
  count: number;
  amount: number;
  pct: number;
}

export interface HardMatchup {
  heroId: number;
  /** Win rate do NOSSO heroi contra este — vem de `winsAverage` (winCount/matchCount). */
  ourWinRate: number;
  /** Limite inferior de Wilson, para amostra pequena nao virar conclusao. */
  ourWinRateLower: number;
  matchCount: number;
  synergy: number;
}

export interface ThreatProfile {
  physicalPct: number;
  magicalPct: number;
  purePct: number;
  totalReceived: number;
  /** Controle sofrido / media do heroi. null quando nao ha benchmark. */
  controlRatio: number | null;
  slowRatio: number | null;
  topAttacker: ThreatSource | null;
  topAbility: ThreatAbility | null;
  topItemSource: { itemId: number; amount: number } | null;
  archetypes: ThreatArchetype[];
  hardestMatchups: HardMatchup[];
}

export interface MatchupRow {
  heroId2: number;
  /** winCount/matchCount do nosso heroi contra o heroId2. O campo do CONFRONTO. */
  winsAverage: number;
  winCount: number;
  matchCount: number;
  synergy: number;
}

const MAGIC_BURST_PCT = 0.55;
const PHYSICAL_PCT = 0.6;
const PURE_PCT = 0.15;
const CONTROL_RATIO = 1.4;
const SLOW_RATIO = 1.5;
const INVIS_SECONDS = 120;

/** Amostra minima para tratar um confronto como conclusao, nao como ruido. */
export const MATCHUP_MIN_SAMPLE = 150;

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/**
 * Razao de controle contra a media do heroi.
 *
 * As unidades de `stunDuration`/`disableDuration` da STRATZ sao ambiguas (1979 para 20
 * stuns num jogo de 2387s nao fecha como segundos nem como ms). Mas numerador e
 * denominador vem da MESMA API na MESMA unidade, entao a RAZAO é solida — e é so ela
 * que usamos. Nunca afirmamos segundos absolutos.
 */
function controlRatioVsHeroAverage(
  player: MatchPlayer,
  curve: HeroAverageEntry[] | null,
  durationMin: number,
): number | null {
  const rt = player.damageReport?.receivedTotal;
  if (!rt) return null;
  const maxMin = heroAverageMaxMinute(curve);
  if (maxMin === null) return null;
  const bench = heroAverageAt(curve, Math.min(Math.floor(durationMin), maxMin), player.position);
  if (!bench) return null;
  const benchControl = bench.stunDuration + bench.disableDuration;
  if (benchControl <= 0) return null;
  return (rt.stunDuration + rt.disableDuration) / benchControl;
}

function slowRatioVsHeroAverage(
  player: MatchPlayer,
  curve: HeroAverageEntry[] | null,
  durationMin: number,
): number | null {
  const rt = player.damageReport?.receivedTotal;
  if (!rt || rt.slowDuration <= 0) return null;
  const maxMin = heroAverageMaxMinute(curve);
  if (maxMin === null) return null;
  const bench = heroAverageAt(curve, Math.min(Math.floor(durationMin), maxMin), player.position);
  // heroAverage nao expoe slowDuration; usamos disableDuration como proxy de escala.
  if (!bench || bench.disableDuration <= 0) return null;
  return rt.slowDuration / (bench.disableDuration * 3);
}

export function buildThreatProfile(
  player: MatchPlayer,
  match: MatchDetails,
  matchupRows: MatchupRow[] | null,
): ThreatProfile | null {
  const report = player.damageReport;
  if (!report?.receivedTotal) return null;

  const rt = report.receivedTotal;
  const total = rt.physicalDamage + rt.magicalDamage + rt.pureDamage;
  const durationMin = match.durationSeconds / 60;

  const physicalPct = safeDiv(rt.physicalDamage, total);
  const magicalPct = safeDiv(rt.magicalDamage, total);
  const purePct = safeDiv(rt.pureDamage, total);

  const enemies = match.players.filter((p) => p.isRadiant !== player.isRadiant);
  const enemyIds = new Set(enemies.map((p) => p.heroId));

  // Considera so dano vindo de heroi inimigo — `receivedTargets` pode trazer neutros.
  const attackerTotal = report.receivedTargets
    .filter((t) => enemyIds.has(t.heroId))
    .reduce((sum, t) => sum + t.amount, 0);
  const topAttackerRaw = report.receivedTargets
    .filter((t) => enemyIds.has(t.heroId))
    .sort((a, b) => b.amount - a.amount)[0];
  const topAttacker: ThreatSource | null = topAttackerRaw
    ? {
        heroId: topAttackerRaw.heroId,
        amount: topAttackerRaw.amount,
        pct: safeDiv(topAttackerRaw.amount, attackerTotal),
      }
    : null;

  const abilityTotal = report.receivedSourceAbility.reduce((sum, a) => sum + a.amount, 0);
  const topAbilityRaw = report.receivedSourceAbility.slice().sort((a, b) => b.amount - a.amount)[0];
  const topAbility: ThreatAbility | null = topAbilityRaw
    ? {
        abilityId: topAbilityRaw.abilityId,
        count: topAbilityRaw.count,
        amount: topAbilityRaw.amount,
        pct: safeDiv(topAbilityRaw.amount, abilityTotal),
      }
    : null;

  const topItemRaw = report.receivedSourceItem.slice().sort((a, b) => b.amount - a.amount)[0];

  const controlRatio = controlRatioVsHeroAverage(player, player.heroAverageCurve ?? null, durationMin);
  const slowRatio = slowRatioVsHeroAverage(player, player.heroAverageCurve ?? null, durationMin);

  const archetypes: ThreatArchetype[] = [];
  if (magicalPct > MAGIC_BURST_PCT) archetypes.push('MAGIC_BURST');
  if (physicalPct > PHYSICAL_PCT) archetypes.push('PHYSICAL_RIGHT_CLICK');
  if (purePct > PURE_PCT) archetypes.push('PURE_DAMAGE');
  if (controlRatio !== null && controlRatio > CONTROL_RATIO) archetypes.push('HARD_LOCKDOWN');
  if (slowRatio !== null && slowRatio > SLOW_RATIO) archetypes.push('SLOW_KITE');
  if (enemies.some((e) => (e.invisibleSeconds ?? 0) > INVIS_SECONDS)) archetypes.push('INVISIBILITY');

  // Cura do time inimigo. `heroAverage` NAO expoe healing, entao nao existe benchmark
  // para comparar — usamos um limiar absoluto conservador e escalado pela duracao.
  // Preferimos deixar de acusar a acusar errado: sem benchmark, o limiar é alto.
  const enemyHealing = enemies.reduce((sum, e) => sum + (e.heroHealing || 0), 0);
  const healingPerMin = durationMin > 0 ? enemyHealing / durationMin : 0;
  if (healingPerMin > 350) archetypes.push('HEAL_SUSTAIN');

  const hardestMatchups: HardMatchup[] = (matchupRows ?? [])
    .filter((r) => enemyIds.has(r.heroId2) && r.matchCount >= MATCHUP_MIN_SAMPLE)
    .map((r) => ({
      heroId: r.heroId2,
      ourWinRate: r.winsAverage,
      ourWinRateLower: wilsonLowerBound(r.winCount, r.matchCount),
      matchCount: r.matchCount,
      synergy: r.synergy,
    }))
    // Mais dificil primeiro = menor win rate NOSSO no confronto.
    .sort((a, b) => a.ourWinRate - b.ourWinRate);

  return {
    physicalPct,
    magicalPct,
    purePct,
    totalReceived: total,
    controlRatio,
    slowRatio,
    topAttacker,
    topAbility,
    topItemSource: topItemRaw ? { itemId: topItemRaw.itemId, amount: topItemRaw.amount } : null,
    archetypes,
    hardestMatchups,
  };
}
