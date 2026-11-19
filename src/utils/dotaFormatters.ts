import { TranslationKey } from '../i18n/translations';

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Ouro abreviado: 21.7k / 1.2M. `locale` escolhe o separador decimal ("21,7k" em pt-BR); sem
 * ele, ponto, como sempre foi — quem chama da tela passa o idioma da interface.
 */
export function formatGold(amount: number, locale?: string): string {
  if (isNaN(amount)) return '0';
  const one = (v: number) =>
    locale ? v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : v.toFixed(1);
  if (Math.abs(amount) >= 1000000) {
    return `${one(amount / 1000000)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${one(amount / 1000)}k`;
  }
  return locale ? amount.toLocaleString(locale) : `${amount}`;
}

export function formatSignedGold(amount: number, locale?: string): string {
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${formatGold(amount, locale)}`;
}

export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

/**
 * Tempo decorrido como CHAVE + numero cru, nunca frase pronta.
 *
 * A versao anterior devolvia `Há 3d` / `Agora mesmo` cravados em pt-BR, e a tela em
 * en-US exibia portugues no meio da lista de partidas. E o mesmo erro que o
 * `awardEngine` ja tinha cometido: texto nao mora no motor. Quem formata é a UI, via
 * `t()`, que é quem conhece o idioma escolhido.
 */
export interface TimeAgo {
  key: TranslationKey;
  params?: Record<string, number>;
}

/** Atalho para a UI: resolve a chave com o `t` de quem chama. */
export function timeAgoText(
  timestampSec: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const { key, params } = formatTimeAgo(timestampSec);
  return t(key, params);
}

export function formatTimeAgo(timestampSec: number): TimeAgo {
  if (!timestampSec) return { key: 'timeAgoRecently' };
  const now = Date.now() / 1000;
  const diffSec = Math.max(0, now - timestampSec);

  if (diffSec < 60) return { key: 'timeAgoJustNow' };
  if (diffSec < 3600) return { key: 'timeAgoMinutes', params: { n: Math.floor(diffSec / 60) } };
  if (diffSec < 86400) return { key: 'timeAgoHours', params: { n: Math.floor(diffSec / 3600) } };
  if (diffSec < 2592000) return { key: 'timeAgoDays', params: { n: Math.floor(diffSec / 86400) } };
  const months = Math.floor(diffSec / 2592000);
  // Sem pluralizacao no `t()`: a chave do singular existe para nao exibir "1 months ago".
  return months === 1
    ? { key: 'timeAgoMonth', params: { n: months } }
    : { key: 'timeAgoMonths', params: { n: months } };
}

/** Texto traduzivel com parametros: o motor escolhe a chave, a UI chama `t()`. */
export interface LabelKey {
  key: TranslationKey;
  params?: Record<string, string | number>;
}

/**
 * Modo de jogo -> chave de traducao. Substituiu o `formatGameMode` (apagado na 2.0), que devolvia texto
 * pronto em pt-BR ("All Pick Ranqueado", "Mutação") que aparecia igual na versao en-US, e
 * chutava "All Pick Ranqueado" quando a entrada vinha vazia. Aqui entrada vazia é `null` e a
 * tela omite; modo desconhecido sai com o proprio id, sem palpite.
 *
 * Aceita o id numerico da OpenDota (`game_mode`) ou o enum em texto. All Pick (1) é ranqueado
 * so quando a fila (`lobby_type`) é 7; sem a fila, sai "All Pick", sem afirmar ranqueado nem
 * casual.
 */
export function matchModeKey(rawMode: string | number | null | undefined, rawLobby?: string | number | null): LabelKey | null {
  if (rawMode === null || rawMode === undefined || rawMode === '') return null;
  const mode = String(rawMode).toUpperCase().trim();
  const lobby = rawLobby === null || rawLobby === undefined ? '' : String(rawLobby).toUpperCase().trim();
  if (mode === '22' || mode === 'ALL_PICK_RANKED' || mode === 'RANKED ALL PICK') return { key: 'gameModeAllPickRanked' };
  if (mode === '1' || mode === 'ALL_PICK') {
    if (lobby === '7' || lobby === 'RANKED' || lobby === 'LOBBY_TYPE_RANKED') return { key: 'gameModeAllPickRanked' };
    return { key: 'gameModeAllPick' };
  }
  const byMode: Record<string, TranslationKey> = {
    '23': 'gameModeTurbo',
    TURBO: 'gameModeTurbo',
    '2': 'gameModeCaptainsMode',
    CAPTAINS_MODE: 'gameModeCaptainsMode',
    '3': 'gameModeRandomDraft',
    RANDOM_DRAFT: 'gameModeRandomDraft',
    '4': 'gameModeSingleDraft',
    SINGLE_DRAFT: 'gameModeSingleDraft',
    '5': 'gameModeAllRandom',
    ALL_RANDOM: 'gameModeAllRandom',
    '18': 'gameModeAbilityDraft',
    ABILITY_DRAFT: 'gameModeAbilityDraft',
    '21': 'gameMode1v1Mid',
    '1V1_MID': 'gameMode1v1Mid',
    '24': 'gameModeMutation',
    MUTATION: 'gameModeMutation',
  };
  const key = byMode[mode];
  return key ? { key } : { key: 'gameModeOther', params: { id: String(rawMode) } };
}

/** Fila (`lobby_type`) -> chave de traducao. Mesma regra de `matchModeKey`: vazio é `null`. */
export function lobbyTypeKey(rawLobby: string | number | null | undefined): LabelKey | null {
  if (rawLobby === null || rawLobby === undefined || rawLobby === '') return null;
  const lobby = String(rawLobby).toUpperCase().trim();
  const byLobby: Record<string, TranslationKey> = {
    '7': 'lobbyRanked',
    RANKED: 'lobbyRanked',
    LOBBY_TYPE_RANKED: 'lobbyRanked',
    '0': 'lobbyNormal',
    NORMAL: 'lobbyNormal',
    UNRANKED: 'lobbyNormal',
    LOBBY_TYPE_NORMAL: 'lobbyNormal',
    '9': 'lobbyBattleCup',
    BATTLE_CUP: 'lobbyBattleCup',
    LOBBY_TYPE_BATTLE_CUP: 'lobbyBattleCup',
    '2': 'lobbyTournament',
    TOURNAMENT: 'lobbyTournament',
    LOBBY_TYPE_TOURNAMENT: 'lobbyTournament',
    '1': 'lobbyPractice',
    PRACTICE: 'lobbyPractice',
    '4': 'lobbyCoopBots',
    COOP_BOT: 'lobbyCoopBots',
  };
  const key = byLobby[lobby];
  return key ? { key } : { key: 'lobbyOther', params: { id: String(rawLobby) } };
}

/**
 * Human-friendly role name formatter
 */
export function formatRoleName(role: string): string {
  switch (role) {
    case 'POSITION_1':
      return 'Pos 1 (Carry)';
    case 'POSITION_2':
      return 'Pos 2 (Mid)';
    case 'POSITION_3':
      return 'Pos 3 (Offlane)';
    case 'POSITION_4':
      return 'Pos 4 (Soft Support)';
    case 'POSITION_5':
      return 'Pos 5 (Hard Support)';
    default:
      return role?.replace('POSITION_', 'Pos ') || 'Flex';
  }
}

/**
 * Human-friendly lane name formatter
 */
export function formatLaneName(lane: string): string {
  switch (lane) {
    case 'SAFE':
    case 'SAFE_LANE':
      return 'Safe Lane';
    case 'MID':
    case 'MID_LANE':
      return 'Mid Lane';
    case 'OFF':
    case 'OFF_LANE':
      return 'Offlane';
    case 'JUNGLE':
      return 'Selva (Jungle)';
    case 'ROAMING':
      return 'Roaming';
    default:
      return lane || 'Lane';
  }
}

/**
 * Relogio da partida, preservando tempos negativos.
 *
 * `formatDuration` clampa em '0:00' para valores <= 0, o que esta correto para
 * duracao (nao existe partida de -1s). Mas eventos da STRATZ usam o relogio da
 * partida, que comeca negativo: wards colocadas antes do horn vem com
 * `time: -54`, e sairiam como '0:00' — apagando exatamente a informacao de que
 * foram pre-horn.
 */
export function formatMatchClock(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const mins = Math.floor(abs / 60);
  const secs = Math.floor(abs % 60);
  return `${sign}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Codigo estavel do tipo de partida, para a lista da home.
 *
 * Nao devolve texto pronto de proposito: quem renderiza traduz via `t()`. E,
 * ao contrario do antigo `formatLobbyType` (apagado na 2.0), que caia em 'Ranqueada',
 * aqui a falta de dado devolve `null` — a lista precisa poder omitir a etiqueta
 * em vez de rotular uma partida casual como ranqueada.
 */
export type MatchTypeCode = 'RANKED' | 'UNRANKED' | 'TURBO' | 'TOURNAMENT' | 'BATTLE_CUP' | 'BOTS' | 'EVENT';

export function resolveMatchType(
  rawMode?: string | number | null,
  rawLobby?: string | number | null,
): MatchTypeCode | null {
  const mode = rawMode === null || rawMode === undefined ? '' : String(rawMode).toUpperCase().trim();
  const lobby = rawLobby === null || rawLobby === undefined ? '' : String(rawLobby).toUpperCase().trim();

  if (!mode && !lobby) return null;

  // Turbo e um modo de jogo, nao um tipo de lobby, e ganha da fila: uma turbo
  // em lobby ranqueado continua sendo turbo aos olhos de quem le a lista.
  if (mode === 'TURBO' || mode === '23') return 'TURBO';
  if (mode === 'MUTATION' || mode === '24' || mode === 'EVENT') return 'EVENT';

  if (lobby === '2' || lobby.includes('TOURNAMENT')) return 'TOURNAMENT';
  if (lobby === '9' || lobby.includes('BATTLE_CUP') || lobby.includes('BATTLE CUP')) return 'BATTLE_CUP';
  if (lobby === '4' || lobby.includes('BOT') || lobby.includes('COOP')) return 'BOTS';
  // UNRANKED antes de RANKED: 'UNRANKED'.includes('RANKED') e verdadeiro.
  if (lobby === '0' || lobby.includes('UNRANKED') || lobby.includes('NORMAL')) return 'UNRANKED';
  if (lobby === '7' || lobby.includes('RANKED')) return 'RANKED';

  // Sem lobby util, so o modo pode denunciar a fila.
  if (mode.includes('UNRANKED')) return 'UNRANKED';
  if (mode.includes('RANKED')) return 'RANKED';

  return null;
}
