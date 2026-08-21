import { MatchDetails, MatchPlayer, PlayerProfileSummary } from '../types/dota';
import {
  buildVisionData,
  computePlayerVisionStats,
  emptyVisionData,
  wardsBySlot,
} from './visionMapper';

export const MOCK_PROFILE: PlayerProfileSummary = {
  steamAccountId: '155353139',
  steamId64: '76561198115618867',
  name: 'ArteezyFanboy',
  avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
  profileUri: 'https://steamcommunity.com/profiles/76561198115618867',
  seasonRank: 72, // Divine 2
  leaderboardRank: undefined,
  totalMatches: 3420,
  winCount: 1881,
  winRate: 55.0,
  mostPlayedHeroes: [
    { heroId: 145, matchCount: 42, winCount: 27, winRate: 64.3, avgKda: 4.8, avgImp: 28 }, // Kez
    { heroId: 131, matchCount: 38, winCount: 23, winRate: 60.5, avgKda: 3.6, avgImp: 21 }, // Ringmaster
    { heroId: 1, matchCount: 412, winCount: 243, winRate: 59.0, avgKda: 4.2, avgImp: 19 }, // Anti-Mage
    { heroId: 74, matchCount: 380, winCount: 198, winRate: 52.1, avgKda: 3.4, avgImp: 12 }, // Invoker
    { heroId: 8, matchCount: 295, winCount: 168, winRate: 56.9, avgKda: 3.9, avgImp: 16 }, // Juggernaut
  ],
  recentMatches: [
    {
      matchId: '7928410291',
      heroId: 145, // Kez
      isRadiant: true,
      isVictory: true,
      durationSeconds: 2240, // 37:20
      startDateTime: Math.floor(Date.now() / 1000) - 7200, // 2h ago
      kills: 14,
      deaths: 2,
      assists: 11,
      kda: 12.5,
      numLastHits: 345,
      numDenies: 16,
      goldPerMinute: 785,
      experiencePerMinute: 840,
      imp: 36,
      role: 'POSITION_1',
      lane: 'SAFE',
      award: 'MVP',
      items: [63, 145, 147, 116, 139, 208], // Power Treads, Battle Fury, Manta, BKB, Butterfly, Abyssal
      neutralItem: 386, // Aviana's Feather
    },
    {
      matchId: '7927391024',
      heroId: 131, // Ringmaster
      isRadiant: false,
      isVictory: true,
      durationSeconds: 1980, // 33:00
      startDateTime: Math.floor(Date.now() / 1000) - 28800, // 8h ago
      kills: 6,
      deaths: 3,
      assists: 22,
      kda: 9.3,
      numLastHits: 58,
      numDenies: 7,
      goldPerMinute: 410,
      experiencePerMinute: 520,
      imp: 26,
      role: 'POSITION_4',
      lane: 'OFF',
      award: 'TOP_SUPPORT',
      items: [180, 218, 232, 1, 108, 0], // Arcane Boots, Glimmer, Aether Lens, Blink, Aghs
      neutralItem: 334, // Spell Prism
    },
    {
      matchId: '7926104820',
      heroId: 1, // Anti-Mage
      isRadiant: true,
      isVictory: true,
      durationSeconds: 2450, // 40:50
      startDateTime: Math.floor(Date.now() / 1000) - 86400, // 1d ago
      kills: 11,
      deaths: 1,
      assists: 8,
      kda: 19.0,
      numLastHits: 480,
      numDenies: 14,
      goldPerMinute: 890,
      experiencePerMinute: 920,
      imp: 42,
      role: 'POSITION_1',
      lane: 'SAFE',
      award: 'MVP',
      items: [63, 145, 147, 116, 139, 208],
      neutralItem: 389, // Pirate Hat
    },
    {
      matchId: '7925019382',
      heroId: 74, // Invoker
      isRadiant: false,
      isVictory: false,
      durationSeconds: 2640, // 44:00
      startDateTime: Math.floor(Date.now() / 1000) - 172800, // 2d ago
      kills: 8,
      deaths: 7,
      assists: 14,
      kda: 3.1,
      numLastHits: 290,
      numDenies: 19,
      goldPerMinute: 560,
      experiencePerMinute: 690,
      imp: -8,
      role: 'POSITION_2',
      lane: 'MID',
      items: [48, 108, 116, 235, 1, 640], // BoT, Aghs, BKB, Octarine, Blink, Wind Waker
      neutralItem: 334,
    },
    {
      matchId: '7924194012',
      heroId: 8, // Juggernaut
      isRadiant: true,
      isVictory: true,
      durationSeconds: 1820, // 30:20
      startDateTime: Math.floor(Date.now() / 1000) - 259200, // 3d ago
      kills: 12,
      deaths: 3,
      assists: 9,
      kda: 7.0,
      numLastHits: 280,
      numDenies: 11,
      goldPerMinute: 720,
      experiencePerMinute: 780,
      imp: 24,
      role: 'POSITION_1',
      lane: 'SAFE',
      items: [50, 145, 147, 116, 168, 0],
      neutralItem: 301,
    },
    {
      matchId: '7923001923',
      heroId: 138, // Muerta
      isRadiant: false,
      isVictory: false,
      durationSeconds: 2890,
      startDateTime: Math.floor(Date.now() / 1000) - 345600,
      kills: 9,
      deaths: 8,
      assists: 7,
      kda: 2.0,
      numLastHits: 360,
      numDenies: 8,
      goldPerMinute: 610,
      experiencePerMinute: 680,
      imp: -14,
      role: 'POSITION_1',
      lane: 'SAFE',
      items: [63, 166, 116, 141, 698, 147],
      neutralItem: 386,
    }
  ],
};

const MOCK_KEZ_BASE = {
  id: '7928410291',
  didRadiantWin: true,
  durationSeconds: 2240, // 37:20
  startDateTime: Math.floor(Date.now() / 1000) - 7200,
  gameMode: 'All Pick Ranqueado',
  lobbyType: 'Ranqueada',
  radiantScore: 42,
  direScore: 23,
  radiantNetworth: 98500,
  direNetworth: 64200,
  advantageTimeline: [
    { minute: 0, goldAdvantage: 0, experienceAdvantage: 0, radiantScore: 0, direScore: 0 },
    { minute: 5, goldAdvantage: 450, experienceAdvantage: 600, radiantScore: 2, direScore: 1 },
    { minute: 10, goldAdvantage: 1850, experienceAdvantage: 1400, radiantScore: 6, direScore: 3 },
    { minute: 15, goldAdvantage: 3200, experienceAdvantage: 2800, radiantScore: 11, direScore: 7 },
    { minute: 20, goldAdvantage: 6800, experienceAdvantage: 5400, radiantScore: 18, direScore: 11 },
    { minute: 25, goldAdvantage: 11500, experienceAdvantage: 9200, radiantScore: 26, direScore: 15 },
    { minute: 30, goldAdvantage: 19800, experienceAdvantage: 16400, radiantScore: 33, direScore: 19 },
    { minute: 35, goldAdvantage: 28400, experienceAdvantage: 24100, radiantScore: 39, direScore: 21 },
    { minute: 37, goldAdvantage: 34300, experienceAdvantage: 28900, radiantScore: 42, direScore: 23 },
  ],
  players: [
    // RADIANT (Winners)
    {
      steamAccountId: '155353139',
      name: 'ArteezyFanboy',
      avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
      seasonRank: 72,
      isRadiant: true,
      playerSlot: 0,
      heroId: 145, // Kez
      kills: 14,
      deaths: 2,
      assists: 11,
      numLastHits: 345,
      numDenies: 16,
      goldPerMinute: 785,
      experiencePerMinute: 840,
      networth: 29300,
      heroDamage: 38400,
      towerDamage: 8200,
      heroHealing: 0,
      imp: 36,
      role: 'POSITION_1',
      lane: 'SAFE',
      award: 'MVP',
      items: [63, 145, 147, 116, 139, 208],
      backpack: [40, 11, 0],
      neutralItem: 386,
      laningStats: {
        lastHits10: 68,
        denies10: 16,
        gold10: 4850,
        exp10: 5200,
        laneResult: 'STOMP_WON',
        firstCoreItemTimingSec: 810, // 13:30 Battlefury
        firstCoreItemId: 145,
        killsInLane: 2,
        deathsInLane: 0,
      },
      itemTimings: [
        { itemId: 63, time: 240, isCoreItem: false }, // Power Treads 4:00
        { itemId: 145, time: 810, isCoreItem: true }, // Battle Fury 13:30
        { itemId: 147, time: 1180, isCoreItem: true }, // Manta Style 19:40
        { itemId: 116, time: 1470, isCoreItem: true }, // BKB 24:30
        { itemId: 139, time: 1820, isCoreItem: true }, // Butterfly 30:20
        { itemId: 208, time: 2110, isCoreItem: true }, // Abyssal Blade 35:10
      ],
    },
    {
      steamAccountId: '24910284',
      name: 'MidOrFeed',
      avatar: 'https://avatars.steamstatic.com/9782b14c35e9cb19058b76c8c9735e5d32be8c53_full.jpg',
      seasonRank: 74,
      isRadiant: true,
      playerSlot: 1,
      heroId: 17, // Storm Spirit
      kills: 11,
      deaths: 4,
      assists: 14,
      numLastHits: 280,
      numDenies: 12,
      goldPerMinute: 670,
      experiencePerMinute: 760,
      networth: 24900,
      heroDamage: 32100,
      towerDamage: 2400,
      heroHealing: 0,
      imp: 18,
      role: 'POSITION_2',
      lane: 'MID',
      items: [63, 121, 1, 116, 686, 640],
      backpack: [41, 0, 0],
      neutralItem: 334,
      laningStats: {
        lastHits10: 56,
        denies10: 12,
        gold10: 4200,
        exp10: 5100,
        laneResult: 'WON',
        firstCoreItemTimingSec: 960,
        firstCoreItemId: 121,
        killsInLane: 1,
        deathsInLane: 1,
      },
    },
    {
      steamAccountId: '8392104',
      name: 'GigaChadOfflane',
      avatar: 'https://avatars.steamstatic.com/c10ef1b143c7bcf7b2cbbab4b4d7943c22ffbe55_full.jpg',
      seasonRank: 71,
      isRadiant: true,
      playerSlot: 2,
      heroId: 104, // Legion Commander
      kills: 9,
      deaths: 5,
      assists: 16,
      numLastHits: 210,
      numDenies: 8,
      goldPerMinute: 540,
      experiencePerMinute: 620,
      networth: 20100,
      heroDamage: 24500,
      towerDamage: 3100,
      heroHealing: 3400,
      imp: 14,
      role: 'POSITION_3',
      lane: 'OFF',
      items: [50, 1, 116, 127, 168, 208],
      backpack: [0, 0, 0],
      neutralItem: 385,
    },
    {
      steamAccountId: '9920194',
      name: 'VisionGod',
      avatar: 'https://avatars.steamstatic.com/b98471e4cb8ff2008892018898912e737482811a_full.jpg',
      seasonRank: 70,
      isRadiant: true,
      playerSlot: 3,
      heroId: 86, // Rubick
      kills: 4,
      deaths: 6,
      assists: 24,
      numLastHits: 64,
      numDenies: 5,
      goldPerMinute: 390,
      experiencePerMinute: 490,
      networth: 14500,
      heroDamage: 18200,
      towerDamage: 450,
      heroHealing: 0,
      imp: 19,
      role: 'POSITION_4',
      lane: 'OFF',
      items: [180, 1, 232, 108, 218, 0],
      backpack: [0, 0, 0],
      neutralItem: 334,
    },
    {
      steamAccountId: '3104928',
      name: 'Pos5Sacrifice',
      avatar: 'https://avatars.steamstatic.com/08249cb8ff2008892018898912e737482811a910_full.jpg',
      seasonRank: 69,
      isRadiant: true,
      playerSlot: 4,
      heroId: 5, // Crystal Maiden
      kills: 4,
      deaths: 6,
      assists: 26,
      numLastHits: 42,
      numDenies: 9,
      goldPerMinute: 340,
      experiencePerMinute: 440,
      networth: 12600,
      heroDamage: 14900,
      towerDamage: 250,
      heroHealing: 0,
      imp: 15,
      role: 'POSITION_5',
      lane: 'SAFE',
      items: [214, 218, 254, 108, 1, 0],
      backpack: [40, 0, 0],
      neutralItem: 357,
    },

    // DIRE (Losers)
    {
      steamAccountId: '55102948',
      name: 'NightmareCarry',
      avatar: 'https://avatars.steamstatic.com/9782b14c35e9cb19058b76c8c9735e5d32be8c11_full.jpg',
      seasonRank: 73,
      isRadiant: false,
      playerSlot: 128,
      heroId: 44, // Phantom Assassin
      kills: 7,
      deaths: 6,
      assists: 8,
      numLastHits: 290,
      numDenies: 9,
      goldPerMinute: 580,
      experiencePerMinute: 660,
      networth: 21500,
      heroDamage: 27400,
      towerDamage: 1200,
      heroHealing: 0,
      imp: -12,
      role: 'POSITION_1',
      lane: 'SAFE',
      items: [50, 145, 116, 168, 143, 0],
      backpack: [0, 0, 0],
      neutralItem: 386,
    },
    {
      steamAccountId: '4820194',
      name: 'MidDiff',
      avatar: 'https://avatars.steamstatic.com/c10ef1b143c7bcf7b2cbbab4b4d7943c22ffbe11_full.jpg',
      seasonRank: 72,
      isRadiant: false,
      playerSlot: 129,
      heroId: 74, // Invoker
      kills: 6,
      deaths: 8,
      assists: 9,
      numLastHits: 240,
      numDenies: 15,
      goldPerMinute: 510,
      experiencePerMinute: 610,
      networth: 18900,
      heroDamage: 25100,
      towerDamage: 1400,
      heroHealing: 0,
      imp: -16,
      role: 'POSITION_2',
      lane: 'MID',
      items: [48, 108, 116, 1, 235, 0],
      backpack: [0, 0, 0],
      neutralItem: 334,
    },
    {
      steamAccountId: '3910294',
      name: 'CentaurEnjoyer',
      avatar: 'https://avatars.steamstatic.com/b98471e4cb8ff2008892018898912e7374828122_full.jpg',
      seasonRank: 71,
      isRadiant: false,
      playerSlot: 130,
      heroId: 2, // Axe
      kills: 5,
      deaths: 9,
      assists: 10,
      numLastHits: 160,
      numDenies: 4,
      goldPerMinute: 420,
      experiencePerMinute: 510,
      networth: 15600,
      heroDamage: 19800,
      towerDamage: 600,
      heroHealing: 0,
      imp: -22,
      role: 'POSITION_3',
      lane: 'OFF',
      items: [50, 1, 127, 116, 108, 0],
      backpack: [0, 0, 0],
      neutralItem: 304,
    },
    {
      steamAccountId: '7729104',
      name: 'CrowdControl',
      avatar: 'https://avatars.steamstatic.com/08249cb8ff2008892018898912e737482811a933_full.jpg',
      seasonRank: 70,
      isRadiant: false,
      playerSlot: 131,
      heroId: 26, // Lion
      kills: 3,
      deaths: 10,
      assists: 12,
      numLastHits: 35,
      numDenies: 2,
      goldPerMinute: 290,
      experiencePerMinute: 380,
      networth: 10800,
      heroDamage: 11400,
      towerDamage: 100,
      heroHealing: 0,
      imp: -25,
      role: 'POSITION_4',
      lane: 'OFF',
      items: [214, 1, 218, 108, 0, 0],
      backpack: [0, 0, 0],
      neutralItem: 289,
    },
    {
      steamAccountId: '8810294',
      name: 'OgreSmash',
      avatar: 'https://avatars.steamstatic.com/9782b14c35e9cb19058b76c8c9735e5d32be8c99_full.jpg',
      seasonRank: 69,
      isRadiant: false,
      playerSlot: 132,
      heroId: 30, // Witch Doctor
      kills: 2,
      deaths: 9,
      assists: 11,
      numLastHits: 38,
      numDenies: 6,
      goldPerMinute: 280,
      experiencePerMinute: 360,
      networth: 10400,
      heroDamage: 13200,
      towerDamage: 200,
      heroHealing: 4100,
      imp: -24,
      role: 'POSITION_5',
      lane: 'SAFE',
      items: [214, 218, 108, 609, 0, 0],
      backpack: [0, 0, 0],
      neutralItem: 290,
    }
  ]
};

const MOCK_RINGMASTER_BASE = {
  id: '7927391024',
  didRadiantWin: false,
  durationSeconds: 1980, // 33:00
  startDateTime: Math.floor(Date.now() / 1000) - 28800,
  gameMode: 'All Pick Ranqueado',
  lobbyType: 'Ranqueada',
  radiantScore: 19,
  direScore: 38,
  radiantNetworth: 58200,
  direNetworth: 86400,
  advantageTimeline: [
    { minute: 0, goldAdvantage: 0, experienceAdvantage: 0 },
    { minute: 5, goldAdvantage: -300, experienceAdvantage: -400 },
    { minute: 10, goldAdvantage: -1500, experienceAdvantage: -1200 },
    { minute: 15, goldAdvantage: -4200, experienceAdvantage: -3800 },
    { minute: 20, goldAdvantage: -8900, experienceAdvantage: -7600 },
    { minute: 25, goldAdvantage: -16400, experienceAdvantage: -13200 },
    { minute: 30, goldAdvantage: -24200, experienceAdvantage: -20100 },
    { minute: 33, goldAdvantage: -28200, experienceAdvantage: -23400 },
  ],
  players: [
    // RADIANT (Losers)
    {
      steamAccountId: '88102941',
      name: 'SlarkPlayer',
      avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
      seasonRank: 71,
      isRadiant: true,
      playerSlot: 0,
      heroId: 28, // Slardar
      kills: 5,
      deaths: 7,
      assists: 6,
      numLastHits: 195,
      numDenies: 8,
      goldPerMinute: 460,
      experiencePerMinute: 540,
      networth: 15200,
      heroDamage: 18900,
      towerDamage: 1100,
      heroHealing: 0,
      imp: -18,
      role: 'POSITION_1',
      lane: 'SAFE',
      items: [63, 1, 116, 208, 0, 0],
      backpack: [0, 0, 0],
      neutralItem: 301,
    },
    // DIRE (Winners)
    {
      steamAccountId: '155353139',
      name: 'ArteezyFanboy',
      avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
      seasonRank: 72,
      isRadiant: false,
      playerSlot: 128,
      heroId: 131, // Ringmaster
      kills: 6,
      deaths: 3,
      assists: 22,
      numLastHits: 58,
      numDenies: 7,
      goldPerMinute: 410,
      experiencePerMinute: 520,
      networth: 13500,
      heroDamage: 22800,
      towerDamage: 750,
      heroHealing: 1200,
      imp: 26,
      role: 'POSITION_4',
      lane: 'OFF',
      award: 'TOP_SUPPORT',
      items: [180, 218, 232, 1, 108, 0],
      backpack: [40, 0, 0],
      neutralItem: 334,
      laningStats: {
        lastHits10: 18,
        denies10: 7,
        gold10: 2400,
        exp10: 3100,
        laneResult: 'LOST',
        firstCoreItemTimingSec: 720, // 12:00 Glimmer
        firstCoreItemId: 218,
        killsInLane: 3,
        deathsInLane: 1,
      },
      itemTimings: [
        { itemId: 180, time: 280, isCoreItem: false },
        { itemId: 218, time: 720, isCoreItem: true },
        { itemId: 232, time: 1080, isCoreItem: true },
        { itemId: 1, time: 1420, isCoreItem: true },
      ],
    },
    {
      steamAccountId: '9928104',
      name: 'RazorGod',
      avatar: 'https://avatars.steamstatic.com/9782b14c35e9cb19058b76c8c9735e5d32be8c53_full.jpg',
      seasonRank: 73,
      isRadiant: false,
      playerSlot: 129,
      heroId: 15, // Razor
      kills: 14,
      deaths: 2,
      assists: 14,
      numLastHits: 280,
      numDenies: 15,
      goldPerMinute: 720,
      experiencePerMinute: 790,
      networth: 23800,
      heroDamage: 36400,
      towerDamage: 6800,
      heroHealing: 0,
      imp: 38,
      role: 'POSITION_1',
      lane: 'SAFE',
      award: 'MVP',
      items: [50, 116, 147, 139, 267, 168],
      backpack: [0, 0, 0],
      neutralItem: 386,
    }
  ]
};

// ---------------------------------------------------------------------------
// Dados de visao do modo demo
//
// Definidos na FORMA CRUA da STRATZ e passados pelo MESMO mapper da producao
// (`buildVisionData`). Ou seja: o demo exercita o caminho real em vez de um
// atalho proprio — se o mapper quebrar, o modo demo quebra junto e a gente ve.
//
// Os dois mocks cobrem de proposito as duas fontes reais:
//   MOCK_MATCH_KEZ        -> playbackData (tempo de vida, deward e autor reais)
//   MOCK_MATCH_RINGMASTER -> stats.wards (tempo de vida estimado, sem deward posicionado)
// O caminho 'NONE' é coberto por teste unitario, nao por um terceiro mock.
// ---------------------------------------------------------------------------

interface RawWard {
  indexId: number;
  time: number;
  positionX: number;
  positionY: number;
  fromPlayer: number;
  wardType: 'OBSERVER' | 'SENTRY';
  killedAt?: number;
  killedBy?: number;
}

/** Coordenadas conferidas contra o terreno de public/minimap.png. */
const KEZ_RAW_WARDS: RawWard[] = [
  // Pre-horn: sentries de block nos camps, tempo negativo de proposito.
  { indexId: 101, time: -52, positionX: 122, positionY: 130, fromPlayer: 4, wardType: 'SENTRY' },
  { indexId: 102, time: -18, positionX: 124, positionY: 126, fromPlayer: 132, wardType: 'SENTRY' },
  // Wards de lane iniciais.
  { indexId: 110, time: 24, positionX: 108, positionY: 152, fromPlayer: 4, wardType: 'OBSERVER' },
  { indexId: 111, time: 30, positionX: 148, positionY: 104, fromPlayer: 132, wardType: 'OBSERVER' },
  { indexId: 112, time: 42, positionX: 96, positionY: 138, fromPlayer: 3, wardType: 'OBSERVER' },
  // Contestacao de runa e rio.
  { indexId: 120, time: 360, positionX: 114, positionY: 136, fromPlayer: 4, wardType: 'OBSERVER', killedAt: 520, killedBy: 131 },
  { indexId: 121, time: 400, positionX: 136, positionY: 118, fromPlayer: 132, wardType: 'OBSERVER' },
  { indexId: 122, time: 430, positionX: 118, positionY: 128, fromPlayer: 3, wardType: 'SENTRY' },
  // Meio de jogo: pressao e visao de Roshan.
  { indexId: 130, time: 700, positionX: 104, positionY: 144, fromPlayer: 4, wardType: 'OBSERVER' },
  { indexId: 131, time: 760, positionX: 132, positionY: 112, fromPlayer: 131, wardType: 'OBSERVER', killedAt: 880, killedBy: 3 },
  { indexId: 132, time: 790, positionX: 112, positionY: 142, fromPlayer: 3, wardType: 'SENTRY' },
  { indexId: 133, time: 940, positionX: 128, positionY: 138, fromPlayer: 4, wardType: 'OBSERVER' },
  { indexId: 134, time: 1010, positionX: 152, positionY: 96, fromPlayer: 132, wardType: 'OBSERVER', killedAt: 1120, killedBy: 4 },
  // Ward perdida muito cedo (alimenta o KPI "perdidas cedo").
  { indexId: 140, time: 1180, positionX: 140, positionY: 120, fromPlayer: 4, wardType: 'OBSERVER', killedAt: 1210, killedBy: 130 },
  { indexId: 141, time: 1240, positionX: 90, positionY: 130, fromPlayer: 131, wardType: 'OBSERVER' },
  { indexId: 142, time: 1300, positionX: 120, positionY: 148, fromPlayer: 3, wardType: 'SENTRY' },
  // Alto: visao de highground e pit.
  { indexId: 150, time: 1560, positionX: 156, positionY: 108, fromPlayer: 4, wardType: 'OBSERVER' },
  { indexId: 151, time: 1620, positionX: 160, positionY: 116, fromPlayer: 3, wardType: 'SENTRY' },
  { indexId: 152, time: 1700, positionX: 100, positionY: 120, fromPlayer: 132, wardType: 'OBSERVER', killedAt: 1810, killedBy: 4 },
  { indexId: 153, time: 1880, positionX: 164, positionY: 112, fromPlayer: 4, wardType: 'OBSERVER' },
  { indexId: 154, time: 1960, positionX: 168, positionY: 120, fromPlayer: 3, wardType: 'SENTRY' },
  { indexId: 155, time: 2040, positionX: 172, positionY: 116, fromPlayer: 4, wardType: 'OBSERVER' },
  // Ward que a engine nao conseguiu atribuir (existe de verdade nos dados da STRATZ).
  { indexId: 160, time: 1400, positionX: 126, positionY: 124, fromPlayer: 250, wardType: 'OBSERVER' },
];

/** Expande cada ward em eventos SPAWN/DESPAWN no formato do playbackData. */
function toPlaybackWardEvents(wards: RawWard[]) {
  const events: any[] = [];
  for (const w of wards) {
    events.push({
      indexId: w.indexId,
      time: w.time,
      positionX: w.positionX,
      positionY: w.positionY,
      fromPlayer: w.fromPlayer,
      wardType: w.wardType,
      action: 'SPAWN',
      playerDestroyed: null,
    });
    if (w.killedAt !== undefined) {
      events.push({
        indexId: w.indexId,
        time: w.killedAt,
        positionX: w.positionX,
        positionY: w.positionY,
        fromPlayer: w.fromPlayer,
        wardType: w.wardType,
        action: 'DESPAWN',
        playerDestroyed: w.killedBy ?? null,
      });
    }
  }
  return events;
}

/** Mortes do demo, para o heatmap ter o que mostrar. */
const KEZ_RAW_DEATHS: Record<number, any[]> = {
  0: [
    { time: 980, positionX: 140, positionY: 118, timeDead: 22, goldLost: 180, isBurst: true, isEngagedOnDeath: true },
    { time: 1720, positionX: 158, positionY: 110, timeDead: 44, goldLost: 320, isBurst: false, isEngagedOnDeath: true },
  ],
  3: [
    { time: 610, positionX: 118, positionY: 132, timeDead: 20, goldLost: 90, isWardWalkThrough: true },
    { time: 1150, positionX: 136, positionY: 122, timeDead: 30, goldLost: 140, isBurst: true },
    { time: 1880, positionX: 162, positionY: 114, timeDead: 48, goldLost: 210, isDieBack: true },
  ],
  4: [
    { time: 520, positionX: 114, positionY: 136, timeDead: 18, goldLost: 70, isWardWalkThrough: true },
    { time: 1210, positionX: 140, positionY: 120, timeDead: 32, goldLost: 120, isBurst: true },
  ],
  128: [
    { time: 880, positionX: 132, positionY: 112, timeDead: 26, goldLost: 200, isEngagedOnDeath: true },
    { time: 1520, positionX: 120, positionY: 130, timeDead: 40, goldLost: 260, isBurst: true },
    { time: 2100, positionX: 172, positionY: 118, timeDead: 55, goldLost: 340, isDieBack: true },
  ],
  132: [
    { time: 1120, positionX: 152, positionY: 96, timeDead: 28, goldLost: 150, isWardWalkThrough: true },
    { time: 1810, positionX: 100, positionY: 120, timeDead: 46, goldLost: 230, isBurst: true },
  ],
};

/** Fonte PLAYER_STATS: so colocacoes, sem SPAWN/DESPAWN. */
const RINGMASTER_RAW_WARDS: Record<number, any[]> = {
  0: [
    { time: 40, type: 0, positionX: 106, positionY: 150 },
    { time: 480, type: 1, positionX: 118, positionY: 134 },
    { time: 1020, type: 0, positionX: 98, positionY: 140 },
  ],
  128: [
    { time: 55, type: 0, positionX: 150, positionY: 106 },
    { time: 520, type: 1, positionX: 138, positionY: 120 },
  ],
  129: [
    { time: 300, type: 0, positionX: 128, positionY: 132 },
    { time: 900, type: 0, positionX: 144, positionY: 112 },
    { time: 1400, type: 1, positionX: 134, positionY: 124 },
  ],
};

/**
 * Monta um MatchDetails de demo completo, passando a visao pelo mapper de producao
 * e preenchendo os campos novos que o tipo exige.
 */
function finalizeMock(
  base: any,
  opts: {
    source: 'PLAYBACK' | 'PLAYER_STATS';
    laneOutcomes: MatchDetails['laneOutcomes'];
    bracket: number;
    actualRank: number;
    analysisOutcome: MatchDetails['analysisOutcome'];
    firstBloodTime: number;
  },
): MatchDetails {
  const players: MatchPlayer[] = base.players;
  const duration: number = base.durationSeconds;

  const rawMatch: any = { parsedDateTime: Math.floor(Date.now() / 1000) };

  if (opts.source === 'PLAYBACK') {
    rawMatch.playbackData = { wardEvents: toPlaybackWardEvents(KEZ_RAW_WARDS) };
    rawMatch.players = players.map((p) => ({
      stats: { deathEvents: KEZ_RAW_DEATHS[p.playerSlot] ?? [] },
    }));
  } else {
    rawMatch.players = players.map((p) => ({
      stats: {
        wards: RINGMASTER_RAW_WARDS[p.playerSlot] ?? [],
        wardDestruction:
          p.playerSlot === 129 ? [{ time: 760, gold: 120, experience: 60, isWard: true }] : [],
        deathEvents: [],
      },
    }));
  }

  const vision = buildVisionData(rawMatch, players, duration);
  const bySlot = wardsBySlot(vision);
  const deathsBySlot = new Map<number, typeof vision.deaths>();
  for (const d of vision.deaths) {
    const list = deathsBySlot.get(d.slot);
    if (list) list.push(d);
    else deathsBySlot.set(d.slot, [d]);
  }

  for (const player of players) {
    player.wardEvents = vision.source === 'NONE' ? undefined : bySlot.get(player.playerSlot) ?? [];
    player.visionStats = computePlayerVisionStats(vision, player.playerSlot);
    player.deathEvents = deathsBySlot.get(player.playerSlot) ?? null;
  }

  return {
    ...base,
    players,
    parsedDateTime: rawMatch.parsedDateTime,
    bracket: opts.bracket,
    actualRank: opts.actualRank,
    analysisOutcome: opts.analysisOutcome,
    firstBloodTime: opts.firstBloodTime,
    laneOutcomes: opts.laneOutcomes,
    vision,
    availability: {
      parsed: true,
      perMinuteStats: false,
      networthSeries: false,
      deathEvents: vision.deaths.length > 0,
      damageReport: false,
      wards: vision.source !== 'NONE',
      heroAverage: false,
      abilities: false,
      laneOutcomes: true,
    },
  };
}

export const MOCK_MATCH_KEZ: MatchDetails = finalizeMock(MOCK_KEZ_BASE, {
  source: 'PLAYBACK',
  laneOutcomes: { top: 'RADIANT_VICTORY', mid: 'RADIANT_STOMP', bottom: 'DIRE_VICTORY' },
  bracket: 7,
  actualRank: 74,
  analysisOutcome: 'STOMPED',
  firstBloodTime: 132,
});

export const MOCK_MATCH_RINGMASTER: MatchDetails = finalizeMock(MOCK_RINGMASTER_BASE, {
  source: 'PLAYER_STATS',
  laneOutcomes: { top: 'DIRE_VICTORY', mid: 'DIRE_STOMP', bottom: 'TIE' },
  bracket: 5,
  actualRank: 53,
  analysisOutcome: 'CLOSE_GAME',
  firstBloodTime: 96,
});

/** Usado quando nem o modo demo tem visao — mantem o tipo satisfeito sem inventar ward. */
export const EMPTY_VISION = emptyVisionData();
