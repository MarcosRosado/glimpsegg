import { MatchDetails, MatchPlayer, Role } from '../../types/dota';
import { getRoleBaseline } from '../../constants/baselines';
import { effectivePosition } from '../rankBracket';
import { BuildAdvice } from '../buildAdvisor';
import { Benchmarked, BenchmarkSet, InsightContext } from './types';
import { ThreatProfile } from './threatProfile';
import { cumulativeAt, heroAverageAt, heroAverageMaxMinute, sumAll, sumDeltas } from './timeSeries';

/**
 * Monta o contexto de avaliacao das regras.
 *
 * O ponto central: `heroAverage` da STRATZ é o benchmark PRIMARIO — media do proprio
 * heroi, naquela posicao, no patch atual, com amostra na casa dos milhares.
 * `ROLE_BASELINES` foi rebaixado a fallback para partida nao parseada, e quando ele é
 * usado o `source` diz 'ROLE_BASELINE' para a UI poder rotular como estimativa.
 */

function benchFromHeroAverage(value: number, sampleSize: number): Benchmarked {
  return { value, source: 'HERO_AVERAGE', sampleSize };
}

function benchFromRole(value: number): Benchmarked {
  return { value, source: 'ROLE_BASELINE' };
}

function buildBenchmarks(player: MatchPlayer, position: Role, durationMin: number): BenchmarkSet {
  const curve = player.heroAverageCurve ?? null;
  const roleBaseline = getRoleBaseline(player.role);

  const at10 = heroAverageAt(curve, 10, position);
  const maxMin = heroAverageMaxMinute(curve);
  // Para metricas de fim de jogo, compara no minuto final da partida — mas nunca
  // alem do alcance da curva, senao a comparacao seria extrapolacao.
  const endMin = maxMin === null ? null : Math.min(Math.floor(durationMin), maxMin);
  const atEnd = endMin === null ? null : heroAverageAt(curve, endMin, position);

  return {
    cs10: at10 ? benchFromHeroAverage(at10.cs, at10.matchCount) : benchFromRole(roleBaseline.cs10Min),
    dn10: at10 ? benchFromHeroAverage(at10.dn, at10.matchCount) : benchFromRole(roleBaseline.denies10Min),
    networth10: at10 ? benchFromHeroAverage(at10.networth, at10.matchCount) : null,
    // heroAverage nao expoe GPM direto de forma confiavel; derivamos do patrimonio.
    gpm: atEnd && endMin
      ? benchFromHeroAverage(atEnd.networth / Math.max(1, endMin), atEnd.matchCount)
      : benchFromRole(roleBaseline.gpm),
    xpm: atEnd && endMin
      ? benchFromHeroAverage(atEnd.xp / Math.max(1, endMin), atEnd.matchCount)
      : benchFromRole(roleBaseline.xpm),
    heroDamage: atEnd ? benchFromHeroAverage(atEnd.heroDamage, atEnd.matchCount) : null,
    towerDamage: atEnd
      ? benchFromHeroAverage(atEnd.towerDamage, atEnd.matchCount)
      : benchFromRole(roleBaseline.towerDamage),
    campsStacked: atEnd
      ? benchFromHeroAverage(atEnd.campsStacked, atEnd.matchCount)
      : benchFromRole(roleBaseline.campsStacked),
    deaths: atEnd
      ? benchFromHeroAverage(atEnd.deaths, atEnd.matchCount)
      : benchFromRole(roleBaseline.maxAcceptableDeaths),
    killParticipationPct: atEnd
      ? benchFromHeroAverage(atEnd.killContributionAverage
          ? atEnd.killContributionAverage * 100
          : roleBaseline.killParticipationPct, atEnd.matchCount)
      : benchFromRole(roleBaseline.killParticipationPct),
  };
}

export function buildInsightContext(
  player: MatchPlayer,
  match: MatchDetails,
  extras: { threat: ThreatProfile | null; build: BuildAdvice | null },
): InsightContext {
  const position = effectivePosition(player);
  const durationMin = Math.max(1, match.durationSeconds / 60);
  const isWinner =
    (player.isRadiant && match.didRadiantWin) || (!player.isRadiant && !match.didRadiantWin);

  const allies = match.players.filter((p) => p.isRadiant === player.isRadiant);
  const enemies = match.players.filter((p) => p.isRadiant !== player.isRadiant);
  const teamKills = allies.reduce((s, p) => s + p.kills, 0);
  const teamDamage = allies.reduce((s, p) => s + p.heroDamage, 0);

  return {
    player,
    match,
    availability: match.availability,
    position,
    durationMin,
    isWinner,
    benchmarks: buildBenchmarks(player, position, durationMin),
    heroAverage: player.heroAverageCurve ?? null,
    measured: {
      cs10: sumDeltas(player.series?.lastHitsPerMinute, 0, 10),
      dn10: sumDeltas(player.series?.deniesPerMinute, 0, 10),
      // CUMULATIVO: le a posicao 10, nao soma.
      networth10: cumulativeAt(player.series?.networthPerMinute, 10),
      killParticipationPct:
        teamKills > 0 ? ((player.kills + player.assists) / teamKills) * 100 : null,
      damageSharePct: teamDamage > 0 ? (player.heroDamage / teamDamage) * 100 : null,
      heroDamagePerMin: player.heroDamage / durationMin,
      campsStacked: sumAll(player.series?.campStack),
    },
    deaths: player.deathEvents ?? [],
    threat: extras.threat,
    build: extras.build,
    enemyHeroIds: enemies.map((p) => p.heroId),
    allyHeroIds: allies.map((p) => p.heroId),
  };
}
