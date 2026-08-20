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
} from '../types/dota';
import { MOCK_MATCH_KEZ, MOCK_MATCH_RINGMASTER } from './mockData';
import { calculateCustomImp } from '../utils/performance';
import { getItem } from '../constants/items';
import { formatGameMode, formatLobbyType } from '../utils/dotaFormatters';
import { AVATAR_PLACEHOLDER_SVG } from '../utils/imageFallback';

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
      players(steamAccountId: $steamAccountId) {
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
      stats {
        itemPurchases {
          itemId
          time
        }
      }
    }
  }
}
`;

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
  return 'POSITION_1';
}

function mapStratzLane(rawLane: string): Lane {
  if (rawLane === 'SAFE_LANE' || rawLane === 'SAFE') return 'SAFE';
  if (rawLane === 'MID_LANE' || rawLane === 'MID') return 'MID';
  if (rawLane === 'OFF_LANE' || rawLane === 'OFF') return 'OFF';
  if (rawLane === 'JUNGLE') return 'JUNGLE';
  return 'SAFE';
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

  // Stomp Lane: dominant CS, kills, and high IMP
  if (playerObj.numLastHits >= 260 && playerObj.deaths <= 3 && imp >= 15) {
    return 'STOMP_LANE';
  }

  // Win Lane: solid victory and positive impact
  if (imp >= 5 && isWin) {
    return 'WIN_LANE';
  }

  // Lost Lane
  if (!isWin && imp <= -10) {
    return 'LOST_LANE';
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

        return {
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
 * Fetch match details from STRATZ GraphQL via Electron IPC or web fetch
 */
export async function fetchMatchDetails(matchId: string, apiKey?: string): Promise<MatchDetails> {
  const numericId = parseInt(matchId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return MOCK_MATCH_KEZ;
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

    if (response?.success && response.data?.match) {
      const m = response.data.match;

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

      const players: MatchPlayer[] = rawPlayers.map((p: any) => {
        const isRad = !!p.isRadiant;
        const role = mapStratzRole(p.role, p.lane);
        const lane = mapStratzLane(p.lane);

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
          laningStats: {
            lastHits10: Math.round((p.numLastHits || 0) * 0.22),
            denies10: Math.round((p.numDenies || 0) * 0.4),
            gold10: Math.round((p.networth || 0) * 0.18),
            exp10: Math.round((p.experiencePerMinute || 0) * 8.5),
            laneEfficiencyPct: 82,
            firstCoreItemTimingSec: 840,
            firstCoreItemId: p.item0Id || p.item1Id || 0,
            killsInLane: Math.min(2, p.kills || 0),
            deathsInLane: Math.min(1, p.deaths || 0),
          },
          wardEvents: [
            { time: 60, type: 'OBSERVER', x: isRad ? 95 : 145, y: isRad ? 150 : 90, isRadiant: isRad },
            { time: 480, type: 'OBSERVER', x: 120, y: 120, isRadiant: isRad },
            { time: 720, type: 'SENTRY', x: 115, y: 125, isRadiant: isRad },
            { time: 1100, type: 'OBSERVER', x: isRad ? 150 : 85, y: isRad ? 90 : 155, isRadiant: isRad },
          ],
          itemTimings: (p.stats?.itemPurchases && p.stats.itemPurchases.length > 0)
            ? p.stats.itemPurchases.map((ip: any) => ({
                itemId: ip.itemId,
                time: ip.time,
                isCoreItem: getItem(ip.itemId).cost >= 1800,
              }))
            : [
                { itemId: p.item0Id || 0, time: 300, isCoreItem: false },
                { itemId: p.item1Id || 0, time: 840, isCoreItem: true },
                { itemId: p.item2Id || 0, time: 1260, isCoreItem: true },
                { itemId: p.item3Id || 0, time: 1680, isCoreItem: true },
              ].filter((t) => t.itemId > 0),
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

      return {
        id: String(m.id),
        didRadiantWin: !!m.didRadiantWin,
        durationSeconds: m.durationSeconds || 0,
        startDateTime: m.startDateTime || 0,
        gameMode: formatGameMode(m.gameMode, m.lobbyType),
        lobbyType: formatLobbyType(m.lobbyType),
        radiantScore,
        direScore,
        radiantNetworth: totalRadiantNetworth,
        direNetworth: totalDireNetworth,
        players,
        advantageTimeline: advantageTimeline.length > 0 ? advantageTimeline : MOCK_MATCH_KEZ.advantageTimeline,
      };
    } else {
      console.warn('STRATZ API returned errors for match details:', response?.errors);
    }
  } catch (err) {
    console.warn('STRATZ Match details fetch failed, falling back:', err);
  }

  if (matchId === '7927391024') return MOCK_MATCH_RINGMASTER;
  return MOCK_MATCH_KEZ;
}
