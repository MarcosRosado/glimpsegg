export type Role = 'POSITION_1' | 'POSITION_2' | 'POSITION_3' | 'POSITION_4' | 'POSITION_5' | 'UNKNOWN';
export type Lane = 'SAFE' | 'MID' | 'OFF' | 'JUNGLE' | 'ROAMING' | 'UNKNOWN';
/**
 * Forma da PARTIDA, medida por IMP/KDA/duracao. Nao diz nada sobre a fase de rota:
 * os membros `*_LANE` foram removidos porque rotulavam "Venceu/Perdeu a Rota" a partir
 * do jogo inteiro. Veredito de rota vem de `PlayerLaneResult`, e so de la.
 */
export type MatchDynamicType = 'COMEBACK' | 'STOMP' | 'HIGH_IMPACT' | 'LOW_IMPACT' | 'EVEN_MATCH';

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

/**
 * Combate: SO campos com origem real na resposta da STRATZ.
 *
 * O que saiu daqui por nao ter fonte nenhuma na API (era heuristica apresentada como
 * numero medido): `damageMitigated` (= 42% do recebido), `stunDurationSec` /
 * `disableDurationSec` (= base por role + assists*1.8), `soloKills` (= kills*0.35),
 * `double/triple/ultraKills`, `rampages`, `killstreakMax` e `firstBloodClaimed`
 * (= kills>=8 && isRadiant). Nenhum desses campos é pedido na
 * `GET_MATCH_DETAILS_QUERY`, entao nao havia como derivar valor honesto.
 *
 * A divisao fisico/magico/puro é do dano RECEBIDO — é o unico split que a STRATZ
 * devolve (`heroDamageReport.receivedTotal`). Antes ela era exibida sob o rotulo de
 * dano causado.
 */
export interface DetailedCombatStats {
  /** Composicao do dano recebido. null => partida sem `heroDamageReport`. */
  damageReceivedSplit: DamageSplit | null;
  /** Total de dano recebido, do relatorio ou da serie por minuto. null => sem dado. */
  damageReceived: number | null;
  /** Cura provida — `heroHealing`, campo direto da STRATZ. */
  healingProvided: number;
}

/**
 * Farm: SO a curva de CS e os stacks, ambos derivados de series reais.
 *
 * A reparticao de ouro por fonte (`laneCreepGold`, `neutralGold`, `heroKillGold`,
 * `towerGold`, `passiveGold`) saiu inteira: era `networth * 0.48`, `networth * 0.28`,
 * `kills*280 + assists*135`, `networth * 0.08` e o resto. A STRATZ nao expoe ouro por
 * fonte. `stacksCleared` e as tres contagens de runa tambem sairam — vinham de
 * `duracao / constante`.
 */
export interface DetailedFarmStats {
  /** null em cada marco que a serie `lastHitsPerMinute` nao cobre. */
  cs5Min: number | null;
  cs10Min: number | null;
  cs15Min: number | null;
  cs20Min: number | null;
  /** Soma da serie `campStack`. null => partida sem a serie. */
  campsStacked: number | null;
}

/**
 * `MatchAnalysisOutcomeType` da STRATZ, verificado por introspecao do schema. O enum
 * tem tambem `NONE`, que o mapper normaliza para `null` — ausencia de veredito nao é
 * um veredito.
 */
export type MatchAnalysisOutcome = 'STOMPED' | 'COMEBACK' | 'CLOSE_GAME';

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
  /**
   * Abates e mortes nos primeiros 10 minutos, dos eventos reais de morte.
   * Sao "ate o minuto 10", NAO "dentro da rota" — nao ha como recortar por regiao.
   * `null` = a partida nao trouxe deathEvents. Antes eram literais `0`, que a UI
   * renderizava como medicao.
   */
  kills10: number | null;
  deaths10: number | null;
}

export interface RadarStats {
  /** `null` = sem series por minuto. O eixo sai do radar em vez de virar GPM do jogo inteiro. */
  laning: number | null; // 0 - 100
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
  advantageTimeline: boolean;
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
  /** Veredito da STRATZ sobre a forma da partida. `null` = a API mandou `NONE`. */
  analysisOutcome: MatchAnalysisOutcome | null;
  firstBloodTime: number | null;
  laneOutcomes: {
    top: LaneOutcome | null;
    mid: LaneOutcome | null;
    bottom: LaneOutcome | null;
  };
  vision: VisionData;
  availability: MatchDataAvailability;
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
  /**
   * Veredito real da rota, de `top/mid/bottomLaneOutcome`. `UNKNOWN` (ou ausente) =
   * partida nao parseada; a UI omite o badge em vez de estimar por IMP.
   */
  laneResult?: PlayerLaneResult;
  items: number[];
  neutralItem?: number;
  // Contexto da partida. Opcionais porque a STRATZ nem sempre devolve: ausente
  // significa "sem dado" e a UI omite, nunca inventa um default.
  // `gameMode`/`lobbyType` sao os valores CRUS da API (ex.: 'TURBO',
  // 'UNRANKED'), nao os rotulos ja traduzidos que `MatchDetails` guarda — a
  // formatacao acontece na renderizacao, para nao travar o idioma no mapper.
  gameMode?: string;
  lobbyType?: string;
  networth?: number;
  /** 1 = solo. `null` = a API nao devolveu o suficiente para contar o grupo. */
  partySize?: number | null;
  /**
   * Campos que alimentam as tags da lista. Todos OPCIONAIS pelo mesmo motivo dos
   * demais: ausente significa "a API nao devolveu" e a tag some, nunca vira 0.
   * `killParticipationPct` e `damageSharePct` sao razoes sobre o total do time e
   * exigem `allPlayers`; sem ele sao `null`.
   */
  level?: number;
  /** Ouro em maos no fim da partida — o que nao chegou a virar item. */
  unspentGold?: number;
  heroDamage?: number;
  towerDamage?: number;
  heroHealing?: number;
  killParticipationPct?: number | null;
  damageSharePct?: number | null;
  /** O time do jogador terminou a partida sem perder uma unica torre. */
  keptAllTowers?: boolean;
  /** Tier 1-8 do rank medio da partida. `null` = sem dado. */
  bracket?: number | null;
}

