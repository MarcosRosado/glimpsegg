import { MatchPlayer, RadarStats, Role } from '../types/dota';
import { getRoleBaseline } from '../constants/baselines';

/**
 * Calculates a 5-axis Radar chart score (0 to 100) for the player
 */
export function calculateRadarStats(player: MatchPlayer, teamTotalKills: number, matchDurationSec: number): RadarStats {
  const baseline = getRoleBaseline(player.role);
  const durationMin = Math.max(15, matchDurationSec / 60);

  // 1. Laning (0 - 100): LH @ 10 e denies @ 10.
  //
  // Sem series por minuto o eixo é `null` e sai do radar. O fallback anterior media
  // `goldPerMinute / baseline.gpm` — o GPM da PARTIDA INTEIRA — sob o rotulo "Fase de
  // Rotas", que é o mesmo erro de janela que fazia a dashboard chamar de rota perdida
  // um jogo que apenas terminou mal. Ausencia de dado nao é nota de rota.
  let laningScore: number | null = null;
  if (player.laningStats && player.laningStats.lastHits10 > 0) {
    const csRatio = player.laningStats.lastHits10 / baseline.cs10Min;
    const dnBonus = Math.min(20, (player.laningStats.denies10 / baseline.denies10Min) * 15);
    laningScore = Math.min(100, Math.max(10, csRatio * 65 + dnBonus));
  }

  // 2. Farming (0 - 100): GPM, XPM, Networth
  const farmingRatio = (player.goldPerMinute * 0.6 + player.experiencePerMinute * 0.4) / (baseline.gpm * 0.6 + baseline.xpm * 0.4);
  const farmingScore = Math.min(100, Math.max(10, farmingRatio * 70));

  // 3. Fighting (0 - 100): KP%, Damage/min, Kills + Assists
  const playerKP = teamTotalKills > 0 ? ((player.kills + player.assists) / teamTotalKills) * 100 : 50;
  const kpScore = (playerKP / baseline.killParticipationPct) * 45;
  const hdPerMin = player.heroDamage / durationMin;
  const dmgScore = (hdPerMin / baseline.heroDamagePerMin) * 35;
  const fightingScore = Math.min(100, Math.max(10, kpScore + dmgScore));

  // 4. Survivability (0 - 100): Low deaths, safe positioning
  const deathRatio = player.deaths / Math.max(1, baseline.maxAcceptableDeaths);
  let survivabilityScore = 100 - deathRatio * 45;
  if (player.deaths === 0) survivabilityScore = 100;
  survivabilityScore = Math.min(100, Math.max(15, survivabilityScore));

  // 5. Objectives (0 - 100): dano em estrutura + visao.
  //
  // Antes, `wardCount` era sempre 4 (as wards falsas), entao este eixo era uma
  // constante por role. Com dado real, uma partida SEM visao daria 0 e derrubaria o
  // eixo — o que seria trocar uma mentira por outra. Correcao: quando nao ha dado de
  // visao, o termo sai e o peso é REDISTRIBUIDO para o dano em estrutura, em vez de
  // pontuar zero. Ausencia de dado nao é desempenho ruim.
  const hasVision = !!player.visionStats?.hasData;
  const towerRatio = player.towerDamage / Math.max(500, baseline.towerDamage);
  let objectivesScore: number;
  if (hasVision) {
    const wardCount = player.visionStats!.wardsPlaced;
    const wardTarget = Math.max(2, baseline.wardsPlaced + baseline.sentriesPlaced);
    objectivesScore = towerRatio * 40 + (wardCount / wardTarget) * 40 + 20;
  } else {
    // Peso cheio (80) no unico termo medido.
    objectivesScore = towerRatio * 80 + 20;
  }
  objectivesScore = Math.min(100, Math.max(10, objectivesScore));

  return {
    laning: laningScore === null ? null : Math.round(laningScore),
    farming: Math.round(farmingScore),
    fighting: Math.round(fightingScore),
    survivability: Math.round(survivabilityScore),
    objectives: Math.round(objectivesScore),
  };
}
