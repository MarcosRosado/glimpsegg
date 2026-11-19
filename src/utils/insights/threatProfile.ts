import { MatchDetails, MatchPlayer } from '../../types/dota';
import { wilsonLowerBound } from './wilson';

/**
 * Perfil de ameaca DERIVADO DA PARTIDA MEDIDA.
 *
 * A alternativa seria uma tabela de counters por heroi (126x126), que apodrece a cada
 * patch. Aqui cada arquetipo sai de um campo real da resposta da STRATZ: a divisao
 * fisico/magico do dano recebido, a razao de controle contra a media dos dez jogadores
 * da propria partida, tempo invisivel do inimigo, cura do time inimigo. Isso é o que permite a frase
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
  /**
   * Controle sofrido / media dos DEZ jogadores desta partida (`MATCH_ONLY`).
   * null quando ninguem na partida sofreu controle. Vai de 0 a 10.
   */
  controlRatio: number | null;
  /** Slow sofrido / media dos dez jogadores desta partida. Mesma regra. */
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
/**
 * Limiares de controle e slow — medidos, nao escolhidos no olho.
 *
 * Amostra de 2026-11-19: 40 partidas publicas (400 jogadores) de Guardian a Immortal,
 * do primeiro dia do 7.42. A razao contra a media da partida tem p50 0,87, p75 1,39,
 * p90 2,05. Taxa de disparo por jogador com os pisos abaixo: controle 11,5% (12,2% nas
 * 9 partidas de 25 min ou mais), slow 10,3%. Alvo: 5% a 15%.
 *
 * A AMOSTRA É PEQUENA E CURTA (duracao mediana de 15 min): refazer a medicao com mais
 * partidas antes de mexer em qualquer um destes numeros.
 */
const CONTROL_RATIO = 1.75;
const SLOW_RATIO = 1.75;
/** Pisos de CONTAGEM — a unica unidade inequivoca da API (as duracoes nao fecham como s nem ms). */
const CONTROL_MIN_PER_MIN = 0.75;
const SLOW_MIN_PER_MIN = 1;
const CC_MIN_COUNT = 8;
const INVIS_SECONDS = 120;

/** Amostra minima para tratar um confronto como conclusao, nao como ruido. */
export const MATCHUP_MIN_SAMPLE = 150;

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

type ReceivedTotal = NonNullable<NonNullable<MatchPlayer['damageReport']>['receivedTotal']>;

/**
 * Razao do valor deste jogador contra a MEDIA dos jogadores da partida.
 *
 * POR QUE A PARTIDA E NAO `heroAverage`: `heroAverage.stunDuration`/`disableDuration`
 * é o controle que o heroi CAUSA em media, nao o que ele sofre (Earthshaker: 95 stuns
 * aos 39 min; Lion: 8 disables aos 15; Phantom Lancer: zero). A versao anterior dividia
 * controle SOFRIDO por esse numero: um Phantom Lancer que levou UM stun saia com
 * "511,8x a media", e um Earthshaker nunca disparava por mais que fosse controlado. Na
 * fixture real, Terrorblade dava 141x e Undying 68,6x. Nao existe benchmark de controle
 * sofrido na API, entao a comparacao honesta é com quem jogou a mesma partida.
 *
 * MEDIA e nao mediana: em partida curta a maioria leva zero controle, a mediana é 0 e
 * a razao estoura do mesmo jeito. As duracoes continuam so em RAZAO (numerador e
 * denominador na mesma unidade ambigua); nunca afirmamos segundos absolutos.
 *
 * Exige o relatorio dos dez: com jogador faltando a media seria de outra populacao.
 */
function ratioVsMatchMean(
  player: MatchPlayer,
  match: MatchDetails,
  pick: (rt: ReceivedTotal) => number,
): number | null {
  const own = player.damageReport?.receivedTotal;
  if (!own) return null;
  const values: number[] = [];
  for (const p of match.players) {
    const rt = p.damageReport?.receivedTotal;
    if (!rt) return null;
    values.push(pick(rt));
  }
  if (values.length === 0) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean <= 0) return null;
  return pick(own) / mean;
}

/** Piso de contagem: sem ele, 2 stuns numa partida em que ninguem mais levou stun dao 4,5x. */
function meetsCountFloor(count: number, durationMin: number, perMin: number): boolean {
  return count >= CC_MIN_COUNT && durationMin > 0 && count / durationMin >= perMin;
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

  const controlRatio = ratioVsMatchMean(player, match, (r) => r.stunDuration + r.disableDuration);
  const slowRatio = ratioVsMatchMean(player, match, (r) => r.slowDuration);
  const controlCount = rt.stunCount + rt.disableCount;

  const archetypes: ThreatArchetype[] = [];
  if (magicalPct > MAGIC_BURST_PCT) archetypes.push('MAGIC_BURST');
  if (physicalPct > PHYSICAL_PCT) archetypes.push('PHYSICAL_RIGHT_CLICK');
  if (purePct > PURE_PCT) archetypes.push('PURE_DAMAGE');
  if (
    controlRatio !== null &&
    controlRatio > CONTROL_RATIO &&
    meetsCountFloor(controlCount, durationMin, CONTROL_MIN_PER_MIN)
  ) {
    archetypes.push('HARD_LOCKDOWN');
  }
  if (
    slowRatio !== null &&
    slowRatio > SLOW_RATIO &&
    meetsCountFloor(rt.slowCount, durationMin, SLOW_MIN_PER_MIN)
  ) {
    archetypes.push('SLOW_KITE');
  }
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
