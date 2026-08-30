import {
  MatchDetails,
  MatchPlayer,
  PlayerMatchSummary,
  PlayerProfileSummary,
  Role,
  Lane,
  MatchDynamicType,
  PeerTeammate,
  ActivityDay,
  AbilityBuildEntry,
  DamageReport,
  HeroAverageEntry,
  ItemTimingEvent,
  LaneOutcome,
  MatchAnalysisOutcome,
  LaningStats,
  MatchDataAvailability,
  PlayerLaneResult,
  PlayerTimeSeries,
} from '../types/dota';
import { calculateCustomImp } from '../utils/performance';
import { getItem } from '../constants/items';
import { formatGameMode, formatLobbyType } from '../utils/dotaFormatters';
import { AVATAR_PLACEHOLDER_SVG } from '../utils/imageFallback';
import { buildVisionData, computePlayerVisionStats, wardsBySlot } from './visionMapper';
import { cumulativeAt, sumDeltas } from '../utils/insights/timeSeries';

export const DEFAULT_STRATZ_TOKEN = '';

export const GET_PLAYER_PROFILE_QUERY = `
query GetPlayerProfile($steamAccountId: Long!) {
  player(steamAccountId: $steamAccountId) {
    steamAccount {
      id
      name
      avatar
      profileUri
      seasonRank
      seasonLeaderboardRank
    }
    matchCount
    winCount
    heroesPerformance {
      heroId
      matchCount
      winCount
      avgKills
      avgDeaths
      avgAssists
      imp
    }
    matches(request: { take: 100 }) {
      id
      didRadiantWin
      durationSeconds
      startDateTime
      gameMode
      lobbyType
      bracket
      topLaneOutcome
      midLaneOutcome
      bottomLaneOutcome
      towerStatusRadiant
      towerStatusDire
      allPlayers: players {
        partyId
        isRadiant
        kills
        assists
        heroDamage
      }
      players(steamAccountId: $steamAccountId) {
        partyId
        heroId
        isRadiant
        kills
        deaths
        assists
        numLastHits
        numDenies
        goldPerMinute
        experiencePerMinute
        networth
        imp
        role
        lane
        award
        level
        gold
        heroDamage
        towerDamage
        heroHealing
        item0Id
        item1Id
        item2Id
        item3Id
        item4Id
        item5Id
        backpack0Id
        backpack1Id
        backpack2Id
        neutral0Id
      }
    }
  }
}
`;

export const GET_MATCH_DETAILS_QUERY = `
query GetMatchDetails($matchId: Long!) {
  match(id: $matchId) {
    id
    didRadiantWin
    durationSeconds
    startDateTime
    gameMode
    lobbyType
    radiantKills
    direKills
    radiantNetworthLeads
    radiantExperienceLeads
    parsedDateTime
    bracket
    actualRank
    analysisOutcome
    firstBloodTime
    topLaneOutcome
    midLaneOutcome
    bottomLaneOutcome
    playbackData {
      wardEvents {
        indexId
        time
        positionX
        positionY
        fromPlayer
        wardType
        action
        playerDestroyed
      }
    }
    players {
      steamAccountId
      steamAccount {
        id
        name
        avatar
        seasonRank
      }
      isRadiant
      playerSlot
      heroId
      kills
      deaths
      assists
      imp
      goldPerMinute
      experiencePerMinute
      networth
      heroDamage
      towerDamage
      heroHealing
      role
      lane
      position
      variant
      level
      invisibleSeconds
      behavior
      intentionalFeeding
      award
      item0Id
      item1Id
      item2Id
      item3Id
      item4Id
      item5Id
      backpack0Id
      backpack1Id
      backpack2Id
      neutral0Id
      numLastHits
      numDenies
      abilities {
        abilityId
        time
        level
        isTalent
      }
      heroAverage {
        time
        position
        matchCount
        winCount
        cs
        dn
        networth
        xp
        kills
        deaths
        assists
        heroDamage
        towerDamage
        campsStacked
        level
        killContributionAverage
        kDAAverage
        stunCount
        stunDuration
        disableCount
        disableDuration
      }
      stats {
        itemPurchases {
          itemId
          time
        }
        lastHitsPerMinute
        deniesPerMinute
        networthPerMinute
        experiencePerMinute
        goldPerMinute
        heroDamagePerMinute
        towerDamagePerMinute
        healPerMinute
        heroDamageReceivedPerMinute
        campStack
        level
        wards {
          time
          type
          positionX
          positionY
        }
        wardDestruction {
          time
          gold
          experience
          isWard
        }
        deathEvents {
          time
          attacker
          byAbility
          byItem
          goldFed
          xpFed
          goldLost
          timeDead
          positionX
          positionY
          isBurst
          isEngagedOnDeath
          isWardWalkThrough
          isAttemptTpOut
          isDieBack
          hasHealAvailable
        }
        heroDamageReport {
          receivedTotal {
            physicalDamage
            magicalDamage
            pureDamage
            heal
            stunCount
            stunDuration
            disableCount
            disableDuration
            slowCount
            slowDuration
          }
          receivedTargets {
            target
            amount
          }
          receivedSourceAbility {
            abilityId
            count
            amount
          }
          receivedSourceItem {
            itemId
            count
            amount
          }
        }
      }
    }
  }
}
`;

const VALID_POSITIONS: Role[] = [
  'POSITION_1',
  'POSITION_2',
  'POSITION_3',
  'POSITION_4',
  'POSITION_5',
];

/** Enum `position` cru da STRATZ. Diferente de `role`, que é derivado. */
function mapStratzPosition(raw: unknown): Role | undefined {
  if (typeof raw === 'string' && (VALID_POSITIONS as string[]).includes(raw)) {
    return raw as Role;
  }
  return undefined;
}

function numberArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));
}

function mapTimeSeries(stats: any): PlayerTimeSeries | null {
  if (!stats) return null;
  const series: PlayerTimeSeries = {
    lastHitsPerMinute: numberArray(stats.lastHitsPerMinute),
    deniesPerMinute: numberArray(stats.deniesPerMinute),
    networthPerMinute: numberArray(stats.networthPerMinute),
    experiencePerMinute: numberArray(stats.experiencePerMinute),
    goldPerMinute: numberArray(stats.goldPerMinute),
    heroDamagePerMinute: numberArray(stats.heroDamagePerMinute),
    towerDamagePerMinute: numberArray(stats.towerDamagePerMinute),
    healPerMinute: numberArray(stats.healPerMinute),
    heroDamageReceivedPerMinute: numberArray(stats.heroDamageReceivedPerMinute),
    campStack: numberArray(stats.campStack),
    level: numberArray(stats.level),
  };
  const hasAny = Object.values(series).some((v) => v !== null);
  return hasAny ? series : null;
}

/**
 * `heroAverage` da STRATZ tem `time` em MINUTOS. Renomeamos para `timeMin` aqui,
 * na unica fronteira de conversao, para nao confundir com `time` em segundos dos
 * eventos de partida.
 */
function mapHeroAverage(raw: unknown): HeroAverageEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = raw
    .filter((e: any) => e && typeof e.time === 'number')
    .map((e: any) => ({
      timeMin: e.time,
      position: e.position || 'UNKNOWN',
      matchCount: e.matchCount || 0,
      winCount: e.winCount || 0,
      cs: e.cs || 0,
      dn: e.dn || 0,
      networth: e.networth || 0,
      xp: e.xp || 0,
      kills: e.kills || 0,
      deaths: e.deaths || 0,
      assists: e.assists || 0,
      heroDamage: e.heroDamage || 0,
      towerDamage: e.towerDamage || 0,
      campsStacked: e.campsStacked || 0,
      level: e.level || 0,
      killContributionAverage: e.killContributionAverage || 0,
      kDAAverage: e.kDAAverage || 0,
      stunCount: e.stunCount || 0,
      stunDuration: e.stunDuration || 0,
      disableCount: e.disableCount || 0,
      disableDuration: e.disableDuration || 0,
    }));
  return entries.length > 0 ? entries : null;
}

/** `abilities[].time` vem em SEGUNDOS. */
function mapAbilityBuild(raw: unknown): AbilityBuildEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = raw
    .filter((a: any) => a && typeof a.abilityId === 'number')
    .map((a: any) => ({
      abilityId: a.abilityId,
      timeSec: typeof a.time === 'number' ? a.time : 0,
      level: typeof a.level === 'number' ? a.level : 0,
      isTalent: !!a.isTalent,
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
  return entries.length > 0 ? entries : null;
}

function mapDamageReport(raw: any): DamageReport | null {
  if (!raw) return null;
  const rt = raw.receivedTotal;
  const report: DamageReport = {
    receivedTotal: rt
      ? {
          physicalDamage: rt.physicalDamage || 0,
          magicalDamage: rt.magicalDamage || 0,
          pureDamage: rt.pureDamage || 0,
          heal: rt.heal || 0,
          stunCount: rt.stunCount || 0,
          stunDuration: rt.stunDuration || 0,
          disableCount: rt.disableCount || 0,
          disableDuration: rt.disableDuration || 0,
          slowCount: rt.slowCount || 0,
          slowDuration: rt.slowDuration || 0,
        }
      : null,
    receivedTargets: Array.isArray(raw.receivedTargets)
      ? raw.receivedTargets
          .filter((t: any) => t && typeof t.target === 'number')
          .map((t: any) => ({ heroId: t.target, amount: t.amount || 0 }))
      : [],
    receivedSourceAbility: Array.isArray(raw.receivedSourceAbility)
      ? raw.receivedSourceAbility
          .filter((a: any) => a && typeof a.abilityId === 'number')
          .map((a: any) => ({ abilityId: a.abilityId, count: a.count || 0, amount: a.amount || 0 }))
      : [],
    receivedSourceItem: Array.isArray(raw.receivedSourceItem)
      ? raw.receivedSourceItem
          .filter((i: any) => i && typeof i.itemId === 'number')
          .map((i: any) => ({ itemId: i.itemId, count: i.count || 0, amount: i.amount || 0 }))
      : [],
  };
  const hasAny =
    report.receivedTotal ||
    report.receivedTargets.length > 0 ||
    report.receivedSourceAbility.length > 0 ||
    report.receivedSourceItem.length > 0;
  return hasAny ? report : null;
}

/**
 * `MatchAnalysisOutcomeType` da STRATZ. Os quatro valores vieram de introspecao do
 * schema, nao de palpite. `NONE` significa "sem veredito" e vira `null` — a UI omite,
 * em vez de traduzir "nenhum" para uma frase que soaria como diagnostico.
 */
function normalizeAnalysisOutcome(raw: unknown): MatchAnalysisOutcome | null {
  const valid: MatchAnalysisOutcome[] = ['STOMPED', 'COMEBACK', 'CLOSE_GAME'];
  return typeof raw === 'string' && (valid as string[]).includes(raw)
    ? (raw as MatchAnalysisOutcome)
    : null;
}

/** Fim da fase de rotas, em segundos. Convencao do Dota, usada tambem por `cs10`/`dn10`. */
const LANE_PHASE_SECONDS = 600;

function normalizeLaneOutcome(raw: unknown): LaneOutcome | null {
  const valid: LaneOutcome[] = [
    'TIE',
    'RADIANT_VICTORY',
    'RADIANT_STOMP',
    'DIRE_VICTORY',
    'DIRE_STOMP',
  ];
  return typeof raw === 'string' && (valid as string[]).includes(raw) ? (raw as LaneOutcome) : null;
}

/**
 * Traduz o resultado de lane da STRATZ (que é por lane do mapa e por faccao) para o
 * ponto de vista do jogador.
 *
 * Cuidado com a geometria: a safelane do Radiant é a bottom lane, e a safelane do
 * Dire é a top lane. Trocar isso inverte o veredito de lane de metade dos jogadores.
 */
export function resolvePlayerLaneResult(
  lane: Lane,
  isRadiant: boolean,
  outcomes: { top: LaneOutcome | null; mid: LaneOutcome | null; bottom: LaneOutcome | null },
): PlayerLaneResult {
  let outcome: LaneOutcome | null = null;
  if (lane === 'MID') {
    outcome = outcomes.mid;
  } else if (lane === 'SAFE') {
    outcome = isRadiant ? outcomes.bottom : outcomes.top;
  } else if (lane === 'OFF') {
    outcome = isRadiant ? outcomes.top : outcomes.bottom;
  }
  if (!outcome) return 'UNKNOWN';
  if (outcome === 'TIE') return 'TIE';
  const radiantWonLane = outcome === 'RADIANT_VICTORY' || outcome === 'RADIANT_STOMP';
  const wasStomp = outcome === 'RADIANT_STOMP' || outcome === 'DIRE_STOMP';
  const playerWon = radiantWonLane === isRadiant;
  if (playerWon) return wasStomp ? 'STOMP_WON' : 'WON';
  return wasStomp ? 'STOMP_LOST' : 'LOST';
}

/**
 * laningStats a partir das series REAIS por minuto.
 * Retorna undefined quando nao ha series — ausencia de dado nao é zero.
 */
function buildLaningStats(
  raw: any,
  series: PlayerTimeSeries | null,
  laneResult: PlayerLaneResult,
  itemTimings: ItemTimingEvent[] | undefined,
): LaningStats | undefined {
  if (!series) return undefined;
  const lastHits10 = sumDeltas(series.lastHitsPerMinute, 0, 10);
  const denies10 = sumDeltas(series.deniesPerMinute, 0, 10);
  if (lastHits10 === null && denies10 === null) return undefined;

  const firstCore = itemTimings?.find((t) => t.isCoreItem);

  return {
    lastHits10: lastHits10 ?? 0,
    denies10: denies10 ?? 0,
    // networthPerMinute é CUMULATIVO: le a posicao 10, nao soma.
    gold10: cumulativeAt(series.networthPerMinute, 10) ?? 0,
    exp10: sumDeltas(series.experiencePerMinute, 0, 10) ?? 0,
    laneResult,
    firstCoreItemTimingSec: firstCore ? firstCore.time : null,
    firstCoreItemId: firstCore ? firstCore.itemId : null,
    // Preenchidos no pos-passe, depois que `vision.deaths` existe. `null` ate la, e
    // `null` para sempre se a partida nao trouxer eventos de morte.
    kills10: null,
    deaths10: null,
  };
}

/** `stats.itemPurchases[].time` vem em SEGUNDOS. Sem compras, sem itemTimings. */
function mapItemTimings(stats: any): ItemTimingEvent[] | undefined {
  const purchases = stats?.itemPurchases;
  if (!Array.isArray(purchases) || purchases.length === 0) return undefined;
  return purchases
    .filter((ip: any) => ip && typeof ip.itemId === 'number' && ip.itemId > 0)
    .map((ip: any) => ({
      itemId: ip.itemId,
      time: typeof ip.time === 'number' ? ip.time : 0,
      isCoreItem: getItem(ip.itemId).cost >= 1800,
    }))
    .sort((a, b) => a.time - b.time);
}

/** O que de fato voltou nesta resposta. Calculado uma vez, nunca adivinhado depois. */
function computeAvailability(rawMatch: any, players: MatchPlayer[]): MatchDataAvailability {
  const some = (fn: (p: MatchPlayer) => boolean) => players.some(fn);
  const laneOutcomes =
    !!normalizeLaneOutcome(rawMatch?.topLaneOutcome) ||
    !!normalizeLaneOutcome(rawMatch?.midLaneOutcome) ||
    !!normalizeLaneOutcome(rawMatch?.bottomLaneOutcome);
  return {
    parsed: !!rawMatch?.parsedDateTime,
    perMinuteStats: some((p) => !!p.series?.lastHitsPerMinute?.length),
    networthSeries: some((p) => !!p.series?.networthPerMinute?.length),
    deathEvents: some((p) => !!p.deathEvents?.length),
    damageReport: some((p) => !!p.damageReport?.receivedTotal),
    wards: false, // preenchido depois de construir `vision`
    advantageTimeline: false, // preenchido depois de montar a curva
    heroAverage: some((p) => !!p.heroAverageCurve?.length),
    abilities: some((p) => !!p.abilityBuild?.length),
    laneOutcomes,
  };
}

function mapStratzRole(rawRole: string, rawLane: string): Role {
  if (rawRole === 'HARD_SUPPORT') return 'POSITION_5';
  if (rawRole === 'LIGHT_SUPPORT') return 'POSITION_4';
  if (rawRole === 'CORE') {
    if (rawLane === 'MID_LANE') return 'POSITION_2';
    if (rawLane === 'OFF_LANE') return 'POSITION_3';
    return 'POSITION_1';
  }
  if (rawRole === 'POSITION_1' || rawRole === 'POSITION_2' || rawRole === 'POSITION_3' || rawRole === 'POSITION_4' || rawRole === 'POSITION_5') {
    return rawRole as Role;
  }
  // 'UNKNOWN', nao 'POSITION_1': `ROLE_BASELINES` tem entrada para UNKNOWN, e chutar
  // carry media um pos 5 contra cs10=62 / gpm=680.
  return 'UNKNOWN';
}

/**
 * O default era `'SAFE'`, e isso nao era inofensivo: `resolvePlayerLaneResult` entao
 * entregava a um roamer (ou a qualquer lane desconhecida) o veredito da safelane da
 * faccao dele. `UNKNOWN` faz o veredito virar 'UNKNOWN', que a UI omite.
 */
function mapStratzLane(rawLane: string): Lane {
  if (rawLane === 'SAFE_LANE' || rawLane === 'SAFE') return 'SAFE';
  if (rawLane === 'MID_LANE' || rawLane === 'MID') return 'MID';
  if (rawLane === 'OFF_LANE' || rawLane === 'OFF') return 'OFF';
  if (rawLane === 'JUNGLE') return 'JUNGLE';
  if (rawLane === 'ROAMING' || rawLane === 'ROAM') return 'ROAMING';
  return 'UNKNOWN';
}

/**
 * Quantos jogadores entraram na fila junto com o nosso.
 *
 * A STRATZ so entrega `partyId` por jogador — o tamanho do grupo e a contagem
 * de quantos compartilham o mesmo id. `partyId` nulo no proprio jogador ja e
 * resposta: entrou sozinho. O que nao da para responder e quando o alias
 * `allPlayers` nao veio (query recusada, campo removido); ai o retorno e `null`
 * e a UI omite, em vez de fingir "solo".
 */
export function derivePartySize(allPlayers: any, partyId: any): number | null {
  if (partyId === null || partyId === undefined) return 1;
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) return null;

  const size = allPlayers.filter((p: any) => p && p.partyId === partyId).length;
  return size > 0 ? size : null;
}

/** Mascara de 11 torres. `0x7FF` = nenhuma torre do time caiu. */
export const ALL_TOWERS_STANDING = 0x7ff;

/**
 * Participacao em abates e fatia de dano, do time do jogador.
 *
 * Precisa dos 10 jogadores porque as duas sao RAZOES sobre o total do time — nao da
 * para derivar do registro de um jogador so. `allPlayers` ausente (query recusada ou
 * campo removido) devolve `null` nos dois, e a tag some. Zero seria uma afirmacao.
 */
export function deriveTeamShares(
  allPlayers: any,
  isRadiant: boolean,
  player: { kills: number; assists: number; heroDamage: number },
): { killParticipationPct: number | null; damageSharePct: number | null } {
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
    return { killParticipationPct: null, damageSharePct: null };
  }
  const team = allPlayers.filter((p: any) => p && !!p.isRadiant === isRadiant);
  if (team.length === 0) return { killParticipationPct: null, damageSharePct: null };

  const teamKills = team.reduce((sum: number, p: any) => sum + (p.kills || 0), 0);
  const teamDamage = team.reduce((sum: number, p: any) => sum + (p.heroDamage || 0), 0);

  return {
    // Time com 0 abates é dado valido, mas a razao nao existe — nao é 0%.
    killParticipationPct:
      teamKills > 0 ? ((player.kills + player.assists) / teamKills) * 100 : null,
    damageSharePct: teamDamage > 0 ? (player.heroDamage / teamDamage) * 100 : null,
  };
}

function classifyMatchDynamic(m: any, playerObj: any, isWin: boolean, imp: number): MatchDynamicType {
  const durMin = (m.durationSeconds || 2100) / 60;
  const kda = (playerObj.kills + playerObj.assists) / Math.max(1, playerObj.deaths);

  // Stomp: fast victory with crushing stats
  if (isWin && durMin <= 32 && (kda >= 5.5 || playerObj.goldPerMinute >= 750 || imp >= 30)) {
    return 'STOMP';
  }

  // Comeback: late game triumph from behind
  if (isWin && durMin >= 45 && (playerObj.deaths >= 6 || imp <= 0)) {
    return 'COMEBACK';
  }

  // Impacto individual. Deliberadamente NAO depende de `isWin`: era a clausula
  // `imp >= 5 && isWin` que tornava impossivel reportar uma partida bem jogada e
  // perdida — o caso que trouxe esta correcao.
  if (imp >= 5) {
    return 'HIGH_IMPACT';
  }

  if (imp <= -10) {
    return 'LOW_IMPACT';
  }

  return 'EVEN_MATCH';
}

/**
 * Fetch teammates / peers from OpenDota API
 */
export async function fetchPlayerPeers(steamAccountId: string): Promise<PeerTeammate[]> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steamAccountId}/peers`);
    if (!res.ok) return [];
    const peers = await res.json();
    if (!Array.isArray(peers)) return [];

    return peers
      .filter((p: any) => p.account_id && p.with_games > 0)
      .slice(0, 15)
      .map((p: any) => ({
        accountId: p.account_id,
        name: p.personaname || `Player ${p.account_id}`,
        avatar: p.avatar || AVATAR_PLACEHOLDER_SVG,
        withGames: p.with_games || 0,
        withWin: p.with_win || 0,
        winRateWith: p.with_games ? parseFloat(((p.with_win / p.with_games) * 100).toFixed(1)) : 50.0,
        againstGames: p.against_games || 0,
        againstWin: p.against_win || 0,
        lastPlayed: p.last_played || 0,
      }));
  } catch (e) {
    console.warn('Could not load OpenDota peers:', e);
    return [];
  }
}

/**
 * Fetch player profile from STRATZ GraphQL via Electron IPC or web fetch
 */
export async function fetchPlayerProfile(steamAccountId: string, apiKey?: string): Promise<PlayerProfileSummary | null> {
  const numericId = parseInt(steamAccountId, 10);
  const token = (apiKey || '').trim();
  if (!token || isNaN(numericId) || numericId <= 0) {
    return null;
  }

  try {
    let response;
    if (window.api && typeof window.api.stratzQuery === 'function') {
      response = await window.api.stratzQuery<any>(GET_PLAYER_PROFILE_QUERY, { steamAccountId: numericId }, token);
    } else {
      const res = await fetch('https://api.stratz.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'STRATZ_API',
        },
        body: JSON.stringify({
          query: GET_PLAYER_PROFILE_QUERY,
          variables: { steamAccountId: numericId },
        }),
      });
      const json = await res.json();
      response = { success: res.ok && !json.errors, data: json.data, errors: json.errors };
    }

    if (response?.success && response.data?.player) {
      const p = response.data.player;
      const account = p.steamAccount || {};

      const recentMatches: PlayerMatchSummary[] = (p.matches || []).map((m: any) => {
        const playerObj = m.players?.[0] || {};
        const isRad = !!playerObj.isRadiant;
        const isWin = (isRad && m.didRadiantWin) || (!isRad && !m.didRadiantWin);
        const k = playerObj.kills || 0;
        const d = playerObj.deaths || 0;
        const a = playerObj.assists || 0;
        const kda = d === 0 ? (k + a) * 1.2 : (k + a) / d;

        const role = mapStratzRole(playerObj.role, playerObj.lane);
        const lane = mapStratzLane(playerObj.lane);

        // For standard heroes, preserve native IMP; for unindexed heroes (imp === null), compute calibrated heuristic
        let imp = playerObj.imp;
        if (imp === null || imp === undefined) {
          const tempPlayer: MatchPlayer = {
            steamAccountId: String(account.id || steamAccountId),
            name: account.name || 'Player',
            avatar: account.avatar || '',
            seasonRank: account.seasonRank || 64,
            isRadiant: isRad,
            playerSlot: 0,
            heroId: playerObj.heroId || 0,
            kills: k,
            deaths: d,
            assists: a,
            numLastHits: playerObj.numLastHits || 0,
            numDenies: playerObj.numDenies || 0,
            goldPerMinute: playerObj.goldPerMinute || 0,
            experiencePerMinute: playerObj.experiencePerMinute || 0,
            networth: playerObj.networth || 0,
            heroDamage: 0,
            towerDamage: 0,
            heroHealing: 0,
            imp: 0,
            role,
            lane,
            items: [],
            backpack: [],
          };
          imp = calculateCustomImp(tempPlayer, 30, m.durationSeconds || 2100);
        }

        const dynamicType = classifyMatchDynamic(m, playerObj, isWin, imp);
        // Mesmas funcoes do caminho de detalhe. Partida nao parseada devolve os tres
        // campos nulos, e o resultado e 'UNKNOWN' — que a UI omite em vez de estimar.
        const heroDamage = playerObj.heroDamage || 0;
        const shares = deriveTeamShares(m.allPlayers, isRad, {
          kills: k,
          assists: a,
          heroDamage,
        });
        // Torres do PROPRIO lado. `null` quando a API nao mandou a mascara.
        const ownTowerStatus = isRad ? m.towerStatusRadiant : m.towerStatusDire;
        const keptAllTowers =
          typeof ownTowerStatus === 'number' ? ownTowerStatus === ALL_TOWERS_STANDING : undefined;

        const laneResult = resolvePlayerLaneResult(lane, isRad, {
          top: normalizeLaneOutcome(m.topLaneOutcome),
          mid: normalizeLaneOutcome(m.midLaneOutcome),
          bottom: normalizeLaneOutcome(m.bottomLaneOutcome),
        });

        return {
          // Cru, nao formatado: quem renderiza decide o idioma e a abreviacao.
          gameMode: m.gameMode != null ? String(m.gameMode) : undefined,
          lobbyType: m.lobbyType != null ? String(m.lobbyType) : undefined,
          networth: playerObj.networth || 0,
          partySize: derivePartySize(m.allPlayers, playerObj.partyId),
          bracket: typeof m.bracket === 'number' ? m.bracket : null,
          matchId: String(m.id),
          heroId: playerObj.heroId || 0,
          isRadiant: isRad,
          isVictory: isWin,
          durationSeconds: m.durationSeconds || 0,
          startDateTime: m.startDateTime || Math.floor(Date.now() / 1000),
          kills: k,
          deaths: d,
          assists: a,
          kda: parseFloat(kda.toFixed(1)),
          numLastHits: playerObj.numLastHits || 0,
          numDenies: playerObj.numDenies || 0,
          goldPerMinute: playerObj.goldPerMinute || 0,
          experiencePerMinute: playerObj.experiencePerMinute || 0,
          imp,
          role,
          lane,
          award: playerObj.award,
          dynamicType,
          laneResult,
          // Ausente = a API nao devolveu. A tag some; nunca vira 0.
          level: typeof playerObj.level === 'number' ? playerObj.level : undefined,
          unspentGold: typeof playerObj.gold === 'number' ? playerObj.gold : undefined,
          heroDamage: typeof playerObj.heroDamage === 'number' ? playerObj.heroDamage : undefined,
          towerDamage: typeof playerObj.towerDamage === 'number' ? playerObj.towerDamage : undefined,
          heroHealing: typeof playerObj.heroHealing === 'number' ? playerObj.heroHealing : undefined,
          killParticipationPct: shares.killParticipationPct,
          damageSharePct: shares.damageSharePct,
          keptAllTowers,
          items: [
            playerObj.item0Id || 0,
            playerObj.item1Id || 0,
            playerObj.item2Id || 0,
            playerObj.item3Id || 0,
            playerObj.item4Id || 0,
            playerObj.item5Id || 0,
          ],
          neutralItem: playerObj.neutral0Id || 0,
        };
      });

      const rawHeroes: any[] = p.heroesPerformance || [];
      const mostPlayed = rawHeroes
        .sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0))
        .slice(0, 8)
        .map((h: any) => {
          const k = h.avgKills || 0;
          const d = h.avgDeaths || 0;
          const a = h.avgAssists || 0;
          const kda = d === 0 ? k + a : (k + a) / d;

          return {
            heroId: h.heroId,
            matchCount: h.matchCount || 0,
            winCount: h.winCount || 0,
            winRate: h.matchCount ? parseFloat(((h.winCount / h.matchCount) * 100).toFixed(1)) : 0,
            avgKda: parseFloat(kda.toFixed(1)),
            avgImp: h.imp !== null && h.imp !== undefined ? h.imp : 0,
          };
        });

      // Calculate 30-day activity days
      const daysMap: Record<string, { count: number; wins: number; losses: number }> = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        daysMap[key] = { count: 0, wins: 0, losses: 0 };
      }

      recentMatches.forEach((m) => {
        const dateKey = new Date(m.startDateTime * 1000).toISOString().slice(0, 10);
        if (daysMap[dateKey]) {
          daysMap[dateKey].count++;
          if (m.isVictory) daysMap[dateKey].wins++;
          else daysMap[dateKey].losses++;
        }
      });

      const activityDays: ActivityDay[] = Object.entries(daysMap).map(([date, val]) => ({
        date,
        count: val.count,
        wins: val.wins,
        losses: val.losses,
      }));

      // Fetch Peers (friends played with)
      const peers = await fetchPlayerPeers(String(account.id || steamAccountId));

      const totalMatches = p.matchCount || recentMatches.length || 100;
      const winCount = p.winCount || recentMatches.filter((m) => m.isVictory).length;

      return {
        steamAccountId: String(account.id || steamAccountId),
        steamId64: String(BigInt(account.id || steamAccountId) + BigInt('76561197960265728')),
        name: account.name || 'Unknown Player',
        avatar: account.avatar || AVATAR_PLACEHOLDER_SVG,
        profileUri: account.profileUri || `https://steamcommunity.com/profiles/${String(BigInt(account.id || steamAccountId) + BigInt('76561197960265728'))}`,
        seasonRank: account.seasonRank || 64,
        leaderboardRank: account.seasonLeaderboardRank,
        totalMatches,
        winCount,
        winRate: totalMatches ? parseFloat(((winCount / totalMatches) * 100).toFixed(1)) : 50.0,
        recentMatches,
        mostPlayedHeroes: mostPlayed,
        peers: peers.length > 0 ? peers : undefined,
        activityDays,
      };
    } else {
      console.warn('STRATZ API returned errors or empty data:', response?.errors);
      return null;
    }
  } catch (err) {
    console.warn('STRATZ API fetch failed:', err);
    return null;
  }

  return null;
}

/**
 * Mapeia a resposta crua de GetMatchDetails para MatchDetails.
 *
 * Exportada e pura de proposito: é o que os testes exercitam contra a fixture real.
 * O bug das quatro wards hardcoded sobreviveu por 12 commits porque este caminho
 * nao tinha como ser verificado sem subir o app inteiro.
 */
export function mapStratzMatch(m: any): MatchDetails {

  // Calculate total radiant and dire kills
  let radiantScore = 0;
  let direScore = 0;
  if (Array.isArray(m.radiantKills)) {
    radiantScore = m.radiantKills.reduce((sum: number, k: number) => sum + k, 0);
  }
  if (Array.isArray(m.direKills)) {
    direScore = m.direKills.reduce((sum: number, k: number) => sum + k, 0);
  }

  // Map players
  const rawPlayers: any[] = m.players || [];
  if (radiantScore === 0) {
    radiantScore = rawPlayers.filter((p) => p.isRadiant).reduce((sum, p) => sum + (p.kills || 0), 0);
  }
  if (direScore === 0) {
    direScore = rawPlayers.filter((p) => !p.isRadiant).reduce((sum, p) => sum + (p.kills || 0), 0);
  }

  const laneOutcomes = {
    top: normalizeLaneOutcome(m.topLaneOutcome),
    mid: normalizeLaneOutcome(m.midLaneOutcome),
    bottom: normalizeLaneOutcome(m.bottomLaneOutcome),
  };

  const players: MatchPlayer[] = rawPlayers.map((p: any) => {
    const isRad = !!p.isRadiant;
    const role = mapStratzRole(p.role, p.lane);
    const lane = mapStratzLane(p.lane);
    const series = mapTimeSeries(p.stats);
    const itemTimings = mapItemTimings(p.stats);
    const laneResult = resolvePlayerLaneResult(lane, isRad, laneOutcomes);

    const playerObj: MatchPlayer = {
      steamAccountId: String(p.steamAccountId || p.steamAccount?.id || '0'),
      name: p.steamAccount?.name || `Player ${p.playerSlot}`,
      avatar: p.steamAccount?.avatar || '',
      seasonRank: p.steamAccount?.seasonRank || 64,
      isRadiant: isRad,
      playerSlot: p.playerSlot || 0,
      heroId: p.heroId || 0,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      numLastHits: p.numLastHits || 0,
      numDenies: p.numDenies || 0,
      goldPerMinute: p.goldPerMinute || 0,
      experiencePerMinute: p.experiencePerMinute || 0,
      networth: p.networth || 0,
      heroDamage: p.heroDamage || 0,
      towerDamage: p.towerDamage || 0,
      heroHealing: p.heroHealing || 0,
      imp: p.imp !== null && p.imp !== undefined ? p.imp : 0,
      role,
      lane,
      award: p.award,
      items: [
        p.item0Id || 0,
        p.item1Id || 0,
        p.item2Id || 0,
        p.item3Id || 0,
        p.item4Id || 0,
        p.item5Id || 0,
      ],
      backpack: [p.backpack0Id || 0, p.backpack1Id || 0, p.backpack2Id || 0],
      neutralItem: p.neutral0Id || 0,
      position: mapStratzPosition(p.position),
      variant: typeof p.variant === 'number' ? p.variant : null,
      level: typeof p.level === 'number' ? p.level : null,
      invisibleSeconds: typeof p.invisibleSeconds === 'number' ? p.invisibleSeconds : null,
      behavior: typeof p.behavior === 'number' ? p.behavior : null,
      intentionalFeeding:
        typeof p.intentionalFeeding === 'boolean' ? p.intentionalFeeding : null,
      series,
      heroAverageCurve: mapHeroAverage(p.heroAverage),
      abilityBuild: mapAbilityBuild(p.abilities),
      damageReport: mapDamageReport(p.stats?.heroDamageReport),
      deathEvents: null, // preenchido a partir de `vision.deaths`, ja normalizado
      // laningStats agora vem das series REAIS por minuto. Antes era inventado a
      // partir de totais da partida inteira (numLastHits * 0.22) com
      // laneEfficiencyPct: 82 e firstCoreItemTimingSec: 840 literais.
      // Sem series, fica `undefined` — nao zerado, nao estimado.
      laningStats: buildLaningStats(p, series, laneResult, itemTimings),
      // wardEvents e preenchido depois, a partir de `vision`, ja fatiado por slot.
      // Aqui existiam quatro wards hardcoded identicas em todos os 10 jogadores.
      itemTimings,
    };

    // If STRATZ didn't calculate IMP (e.g. on Kez / Ringmaster where imp === null), compute calibrated heuristic
    if (p.imp === null || p.imp === undefined) {
      playerObj.imp = calculateCustomImp(playerObj, isRad ? radiantScore : direScore, m.durationSeconds || 2100);
    }

    return playerObj;
  });

  // Advantage timeline from radiantNetworthLeads and radiantExperienceLeads
  const nwLeads: number[] = m.radiantNetworthLeads || [];
  const xpLeads: number[] = m.radiantExperienceLeads || [];
  const len = Math.max(nwLeads.length, xpLeads.length);

  const advantageTimeline = Array.from({ length: len }, (_, i) => ({
    minute: i,
    goldAdvantage: nwLeads[i] || 0,
    experienceAdvantage: xpLeads[i] || 0,
  }));

  const totalRadiantNetworth = players.filter((p) => p.isRadiant).reduce((sum, p) => sum + p.networth, 0);
  const totalDireNetworth = players.filter((p) => !p.isRadiant).reduce((sum, p) => sum + p.networth, 0);

  const durationSeconds = m.durationSeconds || 0;

  // Visao vem de uma fonte unica no nivel da partida (contem OS DOIS times) e é
  // depois fatiada por slot em cada jogador. Sem dado, `source` é 'NONE' e nada
  // é inventado — era exatamente aqui que nasciam as quatro wards falsas.
  const vision = buildVisionData(m, players, durationSeconds);
  const bySlot = wardsBySlot(vision);
  const deathsBySlot = new Map<number, typeof vision.deaths>();
  for (const d of vision.deaths) {
    const list = deathsBySlot.get(d.slot);
    if (list) list.push(d);
    else deathsBySlot.set(d.slot, [d]);
  }
  for (const player of players) {
    if (vision.source === 'NONE') {
      // undefined = sem dado. Diferente de [] (tem dado, colocou zero ward).
      player.wardEvents = undefined;
    } else {
      player.wardEvents = bySlot.get(player.playerSlot) ?? [];
    }
    player.visionStats = computePlayerVisionStats(vision, player.playerSlot);
    player.deathEvents = deathsBySlot.get(player.playerSlot) ?? null;

    // Abates/mortes ate o minuto 10. Sao "ate 10 min", nao "na rota": nao da para
    // recortar por regiao do mapa com confianca, e o rotulo da UI diz isso.
    if (player.laningStats && vision.source !== 'NONE') {
      const own = deathsBySlot.get(player.playerSlot) ?? [];
      player.laningStats.deaths10 = own.filter((d) => d.time <= LANE_PHASE_SECONDS).length;
      player.laningStats.kills10 = vision.deaths.filter(
        (d) => d.attackerSlot === player.playerSlot && d.time <= LANE_PHASE_SECONDS,
      ).length;
    }
  }

  const availability = computeAvailability(m, players);
  availability.wards = vision.source !== 'NONE';
  availability.advantageTimeline = advantageTimeline.length > 0;

  return {
    id: String(m.id),
    didRadiantWin: !!m.didRadiantWin,
    durationSeconds,
    startDateTime: m.startDateTime || 0,
    gameMode: formatGameMode(m.gameMode, m.lobbyType),
    lobbyType: formatLobbyType(m.lobbyType),
    radiantScore,
    direScore,
    radiantNetworth: totalRadiantNetworth,
    direNetworth: totalDireNetworth,
    players,
    // Curva vazia continua vazia. Cair para `MOCK_MATCH_KEZ.advantageTimeline` aqui
    // pintava o grafico de OUTRA partida sem marcar `isMockData`, entao a tela
    // mostrava ouro e XP inventados como se fossem desta partida.
    advantageTimeline,
    parsedDateTime: m.parsedDateTime ?? null,
    bracket: typeof m.bracket === 'number' ? m.bracket : null,
    actualRank: typeof m.actualRank === 'number' ? m.actualRank : null,
    analysisOutcome: normalizeAnalysisOutcome(m.analysisOutcome),
    firstBloodTime: typeof m.firstBloodTime === 'number' ? m.firstBloodTime : null,
    laneOutcomes,
    vision,
    availability,
  };
}

/**
 * Busca detalhes da partida na STRATZ, via IPC do Electron ou fetch do navegador.
 */
export async function fetchMatchDetails(matchId: string, apiKey?: string): Promise<MatchDetails | null> {
  const numericId = parseInt(matchId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return null;
  }

  const token = apiKey || DEFAULT_STRATZ_TOKEN;

  try {
    let response;
    if (window.api && typeof window.api.stratzQuery === 'function') {
      response = await window.api.stratzQuery<any>(GET_MATCH_DETAILS_QUERY, { matchId: numericId }, token);
    } else {
      const res = await fetch('https://api.stratz.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'STRATZ_API',
        },
        body: JSON.stringify({
          query: GET_MATCH_DETAILS_QUERY,
          variables: { matchId: numericId },
        }),
      });
      const json = await res.json();
      response = { success: res.ok && !json.errors, data: json.data, errors: json.errors };
    }

    // Tolerancia a erro parcial: se `match` veio, seguimos mesmo com `errors`
    // preenchido. Um campo novo que a API rejeite tem de degradar para "sem aquele
    // dado", nunca derrubar a tela de partida inteira.
    if (response?.errors?.length) {
      console.warn('[stratz] erros parciais em GetMatchDetails:', response.errors);
    }
    if (response?.data?.match) {
      return mapStratzMatch(response.data.match);
    } else {
      console.warn('STRATZ API returned errors for match details:', response?.errors);
    }
  } catch (err) {
    console.warn('STRATZ Match details fetch failed:', err);
  }

  // Nao existe mais dataset de demonstracao para cair. Antes, uma falha de rede ou um
  // matchId invalido devolvia a partida do Kez marcada com `isMockData`, e a tela
  // abria normalmente com os numeros de OUTRA partida. `null` faz a chamada falhar de
  // verdade, e quem chama mostra o erro.
  return null;
}
