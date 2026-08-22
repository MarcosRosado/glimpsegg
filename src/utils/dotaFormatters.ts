export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatGold(amount: number): string {
  if (isNaN(amount)) return '0';
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`;
  }
  return `${amount}`;
}

export function formatSignedGold(amount: number): string {
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${formatGold(amount)}`;
}

export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function formatTimeAgo(timestampSec: number): string {
  if (!timestampSec) return 'Recentemente';
  const now = Date.now() / 1000;
  const diffSec = Math.max(0, now - timestampSec);

  if (diffSec < 60) return 'Agora mesmo';
  if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `Há ${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 2592000) return `Há ${Math.floor(diffSec / 86400)}d`;
  return `Há ${Math.floor(diffSec / 2592000)} meses`;
}

export function getImpColor(imp: number): string {
  if (imp >= 25) return 'text-emerald-400 font-bold';
  if (imp > 0) return 'text-emerald-400';
  if (imp === 0) return 'text-zinc-400';
  if (imp >= -25) return 'text-amber-400';
  return 'text-rose-400 font-bold';
}

export function getImpBadgeStyle(imp: number): { bg: string; text: string; border: string } {
  if (imp >= 25) return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  if (imp > 0) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (imp === 0) return { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' };
  if (imp >= -25) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
  return { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' };
}

/**
 * Human-friendly game mode formatter
 */
export function formatGameMode(rawMode: string | number | undefined, rawLobby?: string | number | undefined): string {
  if (!rawMode && !rawLobby) return 'Ranked All Pick';

  const modeStr = String(rawMode || '').toUpperCase().trim();
  const lobbyStr = String(rawLobby || '').toUpperCase().trim();

  // If already formatted friendly string
  if (modeStr === 'RANKED ALL PICK' || modeStr === 'ALL PICK RANKED' || modeStr === '22' || modeStr === 'ALL_PICK_RANKED') {
    return 'All Pick Ranqueado';
  }
  if (modeStr === 'ALL_PICK' || modeStr === '1' || modeStr === 'NORMAL ALL PICK') {
    return lobbyStr === '7' || lobbyStr.includes('RANKED') ? 'All Pick Ranqueado' : 'All Pick Casual';
  }
  if (modeStr === 'TURBO' || modeStr === '23') {
    return 'Turbo';
  }
  if (modeStr === 'CAPTAINS_MODE' || modeStr === '2') {
    return 'Captains Mode';
  }
  if (modeStr === 'RANDOM_DRAFT' || modeStr === '3') {
    return 'Random Draft';
  }
  if (modeStr === 'SINGLE_DRAFT' || modeStr === '4') {
    return 'Single Draft';
  }
  if (modeStr === 'ALL_RANDOM' || modeStr === '5') {
    return 'All Random';
  }
  if (modeStr === 'ABILITY_DRAFT' || modeStr === '18') {
    return 'Ability Draft';
  }
  if (modeStr === '1V1_MID' || modeStr === '21') {
    return '1v1 Mid';
  }
  if (modeStr === 'MUTATION' || modeStr === '24') {
    return 'Mutação';
  }

  // Clean raw enum format like "ALL_PICK_RANKED" -> "All Pick Ranked"
  const cleaned = modeStr
    .replace(/^RANKED MODE #/i, '')
    .replace(/^LOBBY #/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return cleaned || 'All Pick Ranqueado';
}

/**
 * Human-friendly lobby type formatter
 */
export function formatLobbyType(rawLobby: string | number | undefined): string {
  if (!rawLobby) return 'Ranqueada';
  const lobbyStr = String(rawLobby).toUpperCase().trim();

  if (lobbyStr === '7' || lobbyStr === 'RANKED' || lobbyStr === 'LOBBY_TYPE_RANKED') {
    return 'Ranqueada';
  }
  if (lobbyStr === '0' || lobbyStr === 'UNRANKED' || lobbyStr === 'NORMAL' || lobbyStr === 'LOBBY_TYPE_NORMAL') {
    return 'Casual (Normal)';
  }
  if (lobbyStr === '9' || lobbyStr === 'BATTLE_CUP' || lobbyStr === 'LOBBY_TYPE_BATTLE_CUP') {
    return 'Battle Cup';
  }
  if (lobbyStr === '2' || lobbyStr === 'TOURNAMENT' || lobbyStr === 'LOBBY_TYPE_TOURNAMENT') {
    return 'Torneio';
  }
  if (lobbyStr === '1' || lobbyStr === 'PRACTICE') {
    return 'Prática';
  }
  if (lobbyStr === '4' || lobbyStr === 'COOP_BOT') {
    return 'Co-op Bots';
  }

  return lobbyStr.replace(/^LOBBY #/i, '').replace(/_/g, ' ');
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
 * ao contrario de `formatLobbyType`, que cai em 'Ranqueada' quando nao sabe,
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
