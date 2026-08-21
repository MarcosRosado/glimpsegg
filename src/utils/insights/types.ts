import {
  BenchmarkSource,
  HeroAverageEntry,
  InsightCategory,
  MatchDataAvailability,
  MatchDeathEvent,
  MatchDetails,
  MatchPlayer,
  Role,
} from '../../types/dota';
import { BuildAdvice } from '../buildAdvisor';
import { ThreatProfile } from './threatProfile';

/**
 * Identidade estavel de cada regra. Uniao FECHADA de proposito: `ruleText.ts` declara
 * um `Record<RuleId, ...>`, logo o `tsc -b` falha se uma regra nascer sem texto.
 * É a unica garantia estrutural disponivel num projeto com `strict: false`.
 */
export type RuleId =
  // Laning
  | 'laningCsHigh'
  | 'laningCsLow'
  | 'laningDeniesHigh'
  | 'laningLaneStomped'
  | 'laningLaneLost'
  // Farming
  | 'farmingGpmHigh'
  | 'farmingGpmLow'
  | 'farmingStacksHigh'
  | 'farmingCurveBehind'
  // Fighting
  | 'fightKpHigh'
  | 'fightKpLow'
  | 'fightDamageShareHigh'
  | 'fightDamageLow'
  // Discipline
  | 'disciplineLowDeaths'
  | 'disciplineHighDeaths'
  // Objectives
  | 'objectiveTowerHigh'
  | 'objectiveTowerLow'
  // Vision
  | 'visionCoverageHigh'
  | 'visionCoverageLow'
  | 'visionUptimeLow'
  | 'visionWardsLostEarly'
  | 'visionDewardsHigh'
  // Deaths
  | 'deathsBurst'
  | 'deathsWardWalk'
  | 'deathsDieBack'
  | 'deathsTpInterrupted'
  | 'deathsHealUnused'
  | 'deathsTimeDead'
  | 'deathsNemesis'
  // Build
  | 'buildItemLate'
  | 'buildItemMissing'
  | 'buildItemOffMeta'
  | 'buildItemGood'
  // Matchup
  | 'matchupHardCounter'
  | 'matchupThreatMagical'
  | 'matchupThreatPhysical'
  | 'matchupThreatLockdown'
  | 'matchupCounterItem'
  // Composto (a manchete)
  | 'compositeBurstNoDispel';

export interface RuleHit {
  type: 'STRENGTH' | 'IMPROVEMENT';
  /** Magnitude normalizada do desvio, 0..1. Vira score 0..100. */
  magnitude: number;
  params: Record<string, number | string>;
  source: BenchmarkSource;
  sampleSize?: number;
  timestampSec?: number;
  heroRefs?: number[];
  itemRefs?: number[];
}

export interface InsightRule {
  id: RuleId;
  category: InsightCategory;
  /** Flags de disponibilidade exigidas. Faltando qualquer uma, a regra é PULADA. */
  requires: (keyof MatchDataAvailability)[];
  /** Posicoes para as quais a regra faz sentido. Vazio/ausente = todas. */
  positions?: Role[];
  evaluate: (ctx: InsightContext) => RuleHit | null;
}

/** Valor de comparacao com procedencia — para a UI nunca apresentar estimativa como fato. */
export interface Benchmarked {
  value: number;
  source: BenchmarkSource;
  sampleSize?: number;
}

export interface BenchmarkSet {
  cs10: Benchmarked | null;
  dn10: Benchmarked | null;
  networth10: Benchmarked | null;
  gpm: Benchmarked | null;
  xpm: Benchmarked | null;
  heroDamage: Benchmarked | null;
  towerDamage: Benchmarked | null;
  campsStacked: Benchmarked | null;
  deaths: Benchmarked | null;
  killParticipationPct: Benchmarked | null;
}

export interface InsightContext {
  player: MatchPlayer;
  match: MatchDetails;
  availability: MatchDataAvailability;
  /** Posicao efetiva: `position` da STRATZ quando existe, senao o `role` derivado. */
  position: Role;
  durationMin: number;
  isWinner: boolean;
  benchmarks: BenchmarkSet;
  heroAverage: HeroAverageEntry[] | null;
  /** Estatisticas medidas do jogador, ja normalizadas. */
  measured: {
    cs10: number | null;
    dn10: number | null;
    networth10: number | null;
    killParticipationPct: number | null;
    damageSharePct: number | null;
    heroDamagePerMin: number;
    campsStacked: number | null;
  };
  deaths: MatchDeathEvent[];
  threat: ThreatProfile | null;
  build: BuildAdvice | null;
  enemyHeroIds: number[];
  allyHeroIds: number[];
}
