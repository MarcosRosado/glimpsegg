import { Role } from '../types/dota';

export interface RoleBaseline {
  role: Role;
  roleName: string;
  cs10Min: number;
  denies10Min: number;
  gpm: number;
  xpm: number;
  kda: number;
  killParticipationPct: number;
  heroDamagePerMin: number;
  towerDamage: number;
  wardsPlaced: number;
  sentriesPlaced: number;
  campsStacked: number;
  maxAcceptableDeaths: number;
  firstCoreTimingMin: number;
}

export const ROLE_BASELINES: Record<Role, RoleBaseline> = {
  POSITION_1: {
    role: 'POSITION_1',
    roleName: 'Carry (Pos 1)',
    cs10Min: 62,
    denies10Min: 9,
    gpm: 680,
    xpm: 720,
    kda: 4.2,
    killParticipationPct: 55,
    heroDamagePerMin: 650,
    towerDamage: 4500,
    wardsPlaced: 1,
    sentriesPlaced: 2,
    campsStacked: 2,
    maxAcceptableDeaths: 4,
    firstCoreTimingMin: 14.5, // e.g. BF/Maelstrom/Radiance/Manta
  },
  POSITION_2: {
    role: 'POSITION_2',
    roleName: 'Mid (Pos 2)',
    cs10Min: 58,
    denies10Min: 12,
    gpm: 620,
    xpm: 750,
    kda: 4.0,
    killParticipationPct: 65,
    heroDamagePerMin: 780,
    towerDamage: 3000,
    wardsPlaced: 2,
    sentriesPlaced: 3,
    campsStacked: 2,
    maxAcceptableDeaths: 5,
    firstCoreTimingMin: 13.0,
  },
  POSITION_3: {
    role: 'POSITION_3',
    roleName: 'Offlane (Pos 3)',
    cs10Min: 48,
    denies10Min: 8,
    gpm: 490,
    xpm: 580,
    kda: 3.0,
    killParticipationPct: 62,
    heroDamagePerMin: 580,
    towerDamage: 2500,
    wardsPlaced: 2,
    sentriesPlaced: 3,
    campsStacked: 2,
    maxAcceptableDeaths: 6,
    firstCoreTimingMin: 12.5, // Blink / Pipe / Crimson
  },
  POSITION_4: {
    role: 'POSITION_4',
    roleName: 'Soft Support (Pos 4)',
    cs10Min: 18,
    denies10Min: 4,
    gpm: 380,
    xpm: 480,
    kda: 2.8,
    killParticipationPct: 70,
    heroDamagePerMin: 420,
    towerDamage: 800,
    wardsPlaced: 8,
    sentriesPlaced: 12,
    campsStacked: 5,
    maxAcceptableDeaths: 7,
    firstCoreTimingMin: 16.0, // Force / Glimmer / Blink
  },
  POSITION_5: {
    role: 'POSITION_5',
    roleName: 'Hard Support (Pos 5)',
    cs10Min: 12,
    denies10Min: 5,
    gpm: 330,
    xpm: 430,
    kda: 2.4,
    killParticipationPct: 66,
    heroDamagePerMin: 340,
    towerDamage: 400,
    wardsPlaced: 16,
    sentriesPlaced: 20,
    campsStacked: 6,
    maxAcceptableDeaths: 7,
    firstCoreTimingMin: 18.0, // Glimmer / Pavise / Solar Crest
  },
  UNKNOWN: {
    role: 'UNKNOWN',
    roleName: 'Flex / Unknown',
    cs10Min: 40,
    denies10Min: 5,
    gpm: 500,
    xpm: 550,
    kda: 3.0,
    killParticipationPct: 60,
    heroDamagePerMin: 500,
    towerDamage: 1500,
    wardsPlaced: 4,
    sentriesPlaced: 6,
    campsStacked: 3,
    maxAcceptableDeaths: 5,
    firstCoreTimingMin: 15.0,
  },
};

export function getRoleBaseline(role: Role): RoleBaseline {
  return ROLE_BASELINES[role] || ROLE_BASELINES.UNKNOWN;
}
