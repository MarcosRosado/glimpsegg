export type Role = 'POSITION_1' | 'POSITION_2' | 'POSITION_3' | 'POSITION_4' | 'POSITION_5' | 'UNKNOWN';
export type Lane = 'SAFE' | 'MID' | 'OFF' | 'JUNGLE' | 'ROAMING' | 'UNKNOWN';
export type MatchDynamicType = 'COMEBACK' | 'STOMP' | 'STOMP_LANE' | 'WIN_LANE' | 'DRAW_LANE' | 'LOST_LANE' | 'EVEN_MATCH';

export interface HeroMetadata {
  id: number;
  name: string;
  shortName: string;
  displayName: string;
  primaryAttr: 'str' | 'agi' | 'int' | 'all';
  roles: string[];
  avatarUrl: string;
  iconUrl: string;
}

export interface ItemMetadata {
  id: number;
  name: string;
  displayName: string;
  cost: number;
  isNeutral: boolean;
  tier?: number;
  imageUrl: string;
}

export type WardType = 'OBSERVER' | 'SENTRY';
export type MapTeam = 'RADIANT' | 'DIRE' | 'UNKNOWN';

/**
 * De onde vieram os dados de visao desta partida.
 * PLAYBACK      - match.playbackData.wardEvents: tempo de vida, autor e deward reais.
 * PLAYER_STATS  - players[].stats.wards: so colocacoes; tempo de vida é estimado.
 * NONE          - sem dado de visao. A UI mostra estado vazio, nunca ward inventada.
 */
export type VisionSource = 'PLAYBACK' | 'PLAYER_STATS' | 'NONE';

export interface WardPlacement {
  /** Chave estavel para React. `${indexId}-${spawnTime}` no PLAYBACK. */
  key: string;
  indexId?: number;
  type: WardType;
  /** Celula da STRATZ (64..192), crua. Normalize com utils/minimapCoords. */
  x: number;
  y: number;
  team: MapTeam;
  /** playerSlot de quem colocou (0-4 Radiant, 128-132 Dire). null = nao atribuivel. */
  placedBySlot: number | null;
  placedByHeroId?: number;
  /** Relogio da partida em segundos. PODE SER NEGATIVO (ward pre-horn). */
  spawnTime: number;
  expireTime: number;
  lifetimeSeconds: number;
  /** true => `expireTime` é estimativa, nao fato. A UI TEM de rotular. */
  expiryInferred: boolean;
  wasDestroyed: boolean;
  /** null = expirou naturalmente. undefined = desconhecido (fonte sem esse dado). */
  destroyedBySlot?: number | null;
  destroyedByHeroId?: number;
  source: VisionSource;
}

export interface WardDeward {
  time: number;
  bySlot: number | null;
  byHeroId?: number;
  /** Time de quem DESTRUIU a ward. */
  team: MapTeam;
  /** Presente so na fonte PLAYBACK — herdada da ward morta. */
  x?: number;
  y?: number;
  targetType?: WardType;
  gold?: number;
  experience?: number;
}

export interface MatchDeathEvent {
  time: number;
  x: number;
  y: number;
  team: MapTeam;
  slot: number;
  heroId?: number;
  attackerSlot?: number | null;
  byAbilityId?: number | null;
  byItemId?: number | null;
  timeDead?: number;
  goldLost?: number;
  goldFed?: number;
  xpFed?: number;
  isBurst?: boolean;
  isEngagedOnDeath?: boolean;
  isWardWalkThrough?: boolean;
  isAttemptTpOut?: boolean;
  isDieBack?: boolean;
  hasHealAvailable?: boolean;
}

export interface PlayerVisionStats {
  /** false => sem dado. Consumidores TEM de checar isto antes de pontuar visao. */
  hasData: boolean;
  observersPlaced: number;
  sentriesPlaced: number;
  wardsPlaced: number;
  dewards: number;
  avgObserverLifetimeSec: number;
  /** Destruidas com mais de 50% da vida util restante. */
  wardsLostEarly: number;
  /** true => os tempos de vida acima sao estimativa. */
  lifetimeIsEstimated: boolean;
}

export interface VisionData {
  source: VisionSource;
  isReplayParsed: boolean;
  wards: WardPlacement[];
  dewards: WardDeward[];
  deaths: MatchDeathEvent[];
  /** Wards cujo `fromPlayer` nao resolveu para um jogador da partida. */
  unattributedWards: number;
  /** Eventos descartados no pareamento (diagnostico). */
  droppedEvents: number;
}

export interface ItemTimingEvent {
  itemId: number;
  time: number; // in seconds
  benchmarkTime?: number;
  isCoreItem?: boolean;
}

export interface AbilityUpgrade {
  abilityId?: number;
  name: string;
  displayName: string;
  slot?: 'Q' | 'W' | 'E' | 'D' | 'F' | 'R' | 'TALENT';
  imageUrl: string;
  level: number;
  timeSec: number;
  isTalent?: boolean;
  isUltimate?: boolean;
  type?: 'SKILL' | 'TALENT';
}

export interface DetailedCombatStats {
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  damageReceived: number;
  damageMitigated: number;
  stunDurationSec: number;
  disableDurationSec: number;
  healingProvided: number;
  soloKills: number;
  doubleKills: number;
  tripleKills: number;
  ultraKills: number;
  rampages: number;
  killstreakMax: number;
  firstBloodClaimed?: boolean;
}

export interface DetailedFarmStats {
  cs5Min: number;
  cs10Min: number;
  cs15Min: number;
  cs20Min: number;
  laneCreepGold: number;
  neutralGold: number;
  heroKillGold: number;
  towerGold: number;
  passiveGold: number;
  campsStacked: number;
  stacksCleared: number;
  runesBounty: number;
  runesPower: number;
  runesWisdom: number;
}

export interface DetailedObjectiveStats {
  roshanKills: number;
  tormentorParticipation: number;
  courierKills: number;
  towerKills: number;
  barracksKills: number;
  buybackCount: number;
  outpostsCaptured?: number;
}

export type LaneOutcome = 'TIE' | 'RADIANT_VICTORY' | 'RADIANT_STOMP' | 'DIRE_VICTORY' | 'DIRE_STOMP';

/** Resultado da lane do ponto de vista do jogador, derivado de LaneOutcomeEnums. */
export type PlayerLaneResult = 'STOMP_WON' | 'WON' | 'TIE' | 'LOST' | 'STOMP_LOST' | 'UNKNOWN';

export interface LaningStats {
  lastHits10: number;
  denies10: number;
  gold10: number;
  exp10: number;
  /** Resultado real da lane vindo da STRATZ. Nao é mais estimativa. */
  laneResult: PlayerLaneResult;
  firstCoreItemTimingSec: number | null;
  firstCoreItemId: number | null;
  killsInLane: number;
  deathsInLane: number;
}

export interface RadarStats {
  laning: number; // 0 - 100
  farming: number; // 0 - 100
  fighting: number; // 0 - 100
  survivability: number; // 0 - 100
  objectives: number; // 0 - 100
}

export type InsightCategory =
  | 'LANING'
  | 'FARMING'
  | 'FIGHTING'
  | 'VISION'
  | 'DISCIPLINE'
  | 'OBJECTIVE'
  | 'BUILD'
  | 'MATCHUP'
  | 'DEATHS';

export type InsightImpact = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * De onde veio o numero de comparacao. Renderizado como chip de procedencia, para
 * o usuario saber se esta olhando media real do proprio heroi ou estimativa generica.
 */
export type BenchmarkSource =
  /** heroAverage da STRATZ: media do proprio heroi naquela posicao. */
  | 'HERO_AVERAGE'
  /** Agregados heroStats: itemFullPurchase / heroVsHeroMatchup. */
  | 'HERO_STATS'
  /** Fato puro da partida, sem benchmark externo. */
  | 'MATCH_ONLY'
  /** Constante estatica. Fallback para partida nao parseada — rotular como estimativa. */
  | 'ROLE_BASELINE';

/**
 * Um insight NAO carrega texto. Carrega o `ruleId` (que resolve para chaves i18n em
 * utils/insights/ruleText.ts) e `params` com numeros CRUS. A formatacao por locale
 * acontece na borda de render, nao aqui — isso mantem o motor puro e testavel.
 */
export interface CoachingInsight {
  ruleId: string;
  type: 'STRENGTH' | 'IMPROVEMENT';
  category: InsightCategory;
  params: Record<string, number | string>;
  /** 0..100. Unica base de ordenacao. */
  score: number;
  impact: InsightImpact;
  source: BenchmarkSource;
  /** Tamanho da amostra do benchmark, quando existe. Renderizado como "n=". */
  sampleSize?: number;
  timestampSec?: number;
  /** heroIds / itemIds para renderizar como icone dentro do card. */
  heroRefs?: number[];
  itemRefs?: number[];
}

/**
 * Series por minuto vindas de `players[].stats`.
 *
 * ATENCAO A SEMANTICA (verificada contra a API):
 *  - Tudo aqui é DELTA por minuto (indice i cobre o minuto i -> i+1), EXCETO
 *    `networthPerMinute`, que é CUMULATIVO (indice i = valor NO minuto i).
 *  - Confirmado: sum(lastHitsPerMinute) === numLastHits, e
 *    networthPerMinute[ultimo] === networth.
 *  - Indexe SEMPRE via utils/insights/timeSeries.ts, nunca direto.
 */
export interface PlayerTimeSeries {
  lastHitsPerMinute: number[] | null;
  deniesPerMinute: number[] | null;
  /** CUMULATIVO. */
  networthPerMinute: number[] | null;
  experiencePerMinute: number[] | null;
  goldPerMinute: number[] | null;
  heroDamagePerMinute: number[] | null;
  towerDamagePerMinute: number[] | null;
  healPerMinute: number[] | null;
  heroDamageReceivedPerMinute: number[] | null;
  campStack: number[] | null;
  level: number[] | null;
}

export interface DamageSplit {
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
}

export interface DamageReceivedTotal extends DamageSplit {
  heal: number;
  stunCount: number;
  /** Unidade AMBIGUA. Use so como razao contra heroAverage, nunca como segundos. */
  stunDuration: number;
  disableCount: number
  /** Unidade AMBIGUA. Idem. */
  disableDuration: number;
  slowCount: number;
  /** Unidade AMBIGUA. Idem. */
  slowDuration: number;
}

export interface DamageByTarget {
  /** heroId da fonte/alvo. */
  heroId: number;
  amount: number;
}

export interface DamageByAbility {
  abilityId: number;
  count: number;
  amount: number;
}

export interface DamageByItem {
  itemId: number;
  count: number;
  amount: number;
}

export interface DamageReport {
  receivedTotal: DamageReceivedTotal | null;
  receivedTargets: DamageByTarget[];
  receivedSourceAbility: DamageByAbility[];
  receivedSourceItem: DamageByItem[];
}

/**
 * Uma entrada da curva `heroAverage`: media do heroi naquela posicao NO minuto `timeMin`.
 * CUMULATIVA. Indexe pelo campo `timeMin`, nunca pela posicao no array.
 */
export interface HeroAverageEntry {
  timeMin: number;
  position: Role | string;
  matchCount: number;
  winCount: number;
  cs: number;
  dn: number;
  networth: number;
  xp: number;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number;
  towerDamage: number;
  campsStacked: number;
  level: number;
  /** Fracao (0..1) das kills do time em que o heroi participa, na media. */
  killContributionAverage: number;
  kDAAverage: number;
  stunCount: number;
  stunDuration: number;
  disableCount: number;
  disableDuration: number;
}

export interface AbilityBuildEntry {
  abilityId: number;
  timeSec: number;
  level: number;
  isTalent: boolean;
}

/**
 * O que de fato voltou da API nesta partida. Calculado UMA VEZ na camada de fetch.
 * Nunca adivinhado downstream, e `null` nunca é coagido para 0.
 */
export interface MatchDataAvailability {
  parsed: boolean;
  perMinuteStats: boolean;
  networthSeries: boolean;
  deathEvents: boolean;
  damageReport: boolean;
  wards: boolean;
  heroAverage: boolean;
  abilities: boolean;
  laneOutcomes: boolean;
}

export interface MatchPlayer {
  steamAccountId: string;
  name: string;
  avatar: string;
  seasonRank: number;
  isRadiant: boolean;
  playerSlot: number;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  numLastHits: number;
  numDenies: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  networth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  imp: number; // STRATZ IMP or our custom calculated IMP
  role: Role;
  lane: Lane;
  award?: string;
  items: number[];
  backpack: number[];
  neutralItem?: number;
  /** Enum `position` cru da STRATZ, distinto do `role` derivado. */
  position?: Role;
  /** Facet do heroi. */
  variant?: number | null;
  level?: number | null;
  invisibleSeconds?: number | null;
  behavior?: number | null;
  intentionalFeeding?: boolean | null;
  laningStats?: LaningStats;
  /**
   * Fatia derivada de `MatchDetails.vision`, por slot.
   * SEMANTICA RIGIDA: `undefined` = sem dado de visao nesta partida;
   * `[]` = existe dado e este jogador colocou zero ward. Consumidores TEM de
   * distinguir os dois — confundi-los foi o bug original.
   */
  wardEvents?: WardPlacement[];
  visionStats?: PlayerVisionStats;
  series?: PlayerTimeSeries | null;
  deathEvents?: MatchDeathEvent[] | null;
  damageReport?: DamageReport | null;
  heroAverageCurve?: HeroAverageEntry[] | null;
  abilityBuild?: AbilityBuildEntry[] | null;
  itemTimings?: ItemTimingEvent[];
  abilityUpgrades?: AbilityUpgrade[];
  combatStats?: DetailedCombatStats;
  farmStats?: DetailedFarmStats;
  objectiveStats?: DetailedObjectiveStats;
  csOverTime?: number[];
  networthOverTime?: number[];
  heroDamageDealt?: number;
  heroDamageReceived?: number;
}

export interface AdvantagePoint {
  minute: number;
  goldAdvantage: number; // > 0 Radiant, < 0 Dire
  experienceAdvantage: number;
  radiantScore?: number;
  direScore?: number;
}

export interface MatchDetails {
  id: string;
  didRadiantWin: boolean;
  durationSeconds: number;
  startDateTime: number; // Unix timestamp
  gameMode: string;
  lobbyType: string;
  radiantScore: number;
  direScore: number;
  radiantNetworth: number;
  direNetworth: number;
  players: MatchPlayer[];
  advantageTimeline: AdvantagePoint[];
  /** null => replay nao parseado pelo STRATZ, logo sem playbackData/stats profundos. */
  parsedDateTime: number | null;
  bracket: number | null;
  actualRank: number | null;
  analysisOutcome: 'NONE' | 'STOMPED' | 'COMEBACK' | 'CLOSE_GAME' | null;
  firstBloodTime: number | null;
  laneOutcomes: {
    top: LaneOutcome | null;
    mid: LaneOutcome | null;
    bottom: LaneOutcome | null;
  };
  vision: VisionData;
  availability: MatchDataAvailability;
  /** true => os dados vieram de mockData, nao da API. Nunca apresentar como real. */
  isMockData?: boolean;
}

export interface PeerTeammate {
  accountId: number;
  name: string;
  avatar: string;
  withGames: number;
  withWin: number;
  winRateWith: number;
  againstGames: number;
  againstWin: number;
  lastPlayed?: number;
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  wins: number;
  losses: number;
}

export interface PlayerProfileSummary {
  steamAccountId: string;
  steamId64: string;
  name: string;
  avatar: string;
  profileUri?: string;
  seasonRank: number;
  leaderboardRank?: number;
  totalMatches: number;
  winCount: number;
  winRate: number;
  recentMatches: PlayerMatchSummary[];
  mostPlayedHeroes: Array<{
    heroId: number;
    matchCount: number;
    winCount: number;
    winRate: number;
    avgKda: number;
    avgImp: number;
  }>;
  peers?: PeerTeammate[];
  activityDays?: ActivityDay[];
}

export interface ProfileHistoryItem {
  steamAccountId: string;
  steamId64?: string;
  name: string;
  avatar: string;
  seasonRank?: number;
  leaderboardRank?: number;
  lastSearched: number;
  isFavorite: boolean;
}

export interface PlayerMatchSummary {
  matchId: string;
  heroId: number;
  isRadiant: boolean;
  isVictory: boolean;
  durationSeconds: number;
  startDateTime: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  numLastHits: number;
  numDenies: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  imp: number;
  role: Role;
  lane: Lane;
  award?: string;
  dynamicType?: MatchDynamicType;
  items: number[];
  neutralItem?: number;
}

