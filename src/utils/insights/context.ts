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

/**
 * Minuto de comparacao para metricas de fim de jogo: o minuto final da partida, mas
 * nunca alem do alcance da curva — passar disso seria extrapolar.
 */
function resolveEndMinute(player: MatchPlayer, durationMin: number): number | null {
  const maxMin = heroAverageMaxMinute(player.heroAverageCurve ?? null);
  return maxMin === null ? null : Math.min(Math.floor(durationMin), maxMin);
}

function buildBenchmarks(player: MatchPlayer, position: Role, endMin: number | null): BenchmarkSet {
  const curve = player.heroAverageCurve ?? null;
  const roleBaseline = getRoleBaseline(player.role);

  const at10 = heroAverageAt(curve, 10, position);
  const atEnd = endMin === null ? null : heroAverageAt(curve, endMin, position);

  return {
    cs10: at10 ? benchFromHeroAverage(at10.cs, at10.matchCount) : benchFromRole(roleBaseline.cs10Min),
    dn10: at10 ? benchFromHeroAverage(at10.dn, at10.matchCount) : benchFromRole(roleBaseline.denies10Min),
    networth10: at10 ? benchFromHeroAverage(at10.networth, at10.matchCount) : null,
    // Patrimonio contra patrimonio. Sem fallback para ROLE_BASELINE de proposito:
    // `ROLE_BASELINES.gpm` e ouro GANHO por minuto, outra unidade — cair nele traria
    // de volta exatamente a comparacao enviesada que esta linha existe para corrigir.
    // Sem curva, a regra nao dispara, e isso e um resultado valido.
    networthPerMin: atEnd && endMin
      ? benchFromHeroAverage(atEnd.networth / Math.max(1, endMin), atEnd.matchCount)
      : null,
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
    // `killContributionAverage` costuma NAO vir da STRATZ (a fixture real de partida
    // parseada nao traz o campo). Quando falta, o valor usado e a constante de
    // ROLE_BASELINES — e ela precisa sair rotulada como tal. Antes saia como
    // HERO_AVERAGE com sampleSize na casa dos milhares, ou seja, a UI exibia chip de
    // "media do heroi · n=4425" em cima de uma estimativa estatica.
    killParticipationPct:
      atEnd && atEnd.killContributionAverage
        ? benchFromHeroAverage(atEnd.killContributionAverage * 100, atEnd.matchCount)
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
  const endMin = resolveEndMinute(player, durationMin);
  const networthAtEnd = endMin === null ? null : cumulativeAt(player.series?.networthPerMinute, endMin);
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
    benchmarks: buildBenchmarks(player, position, endMin),
    heroAverage: player.heroAverageCurve ?? null,
    measured: {
      cs10: sumDeltas(player.series?.lastHitsPerMinute, 0, 10),
      dn10: sumDeltas(player.series?.deniesPerMinute, 0, 10),
      // CUMULATIVO: le a posicao 10, nao soma.
      networth10: cumulativeAt(player.series?.networthPerMinute, 10),
      // Medido no MESMO minuto do benchmark, senao a razao compara janelas diferentes.
      networthPerMin:
        networthAtEnd !== null && endMin ? networthAtEnd / Math.max(1, endMin) : null,
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
