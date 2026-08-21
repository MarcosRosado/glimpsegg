import { MatchDetails, MatchPlayer, Role } from '../types/dota';

/** Enum `RankBracketBasicEnum` da STRATZ. */
export type RankBracketBasic =
  | 'UNCALIBRATED'
  | 'HERALD_GUARDIAN'
  | 'CRUSADER_ARCHON'
  | 'LEGEND_ANCIENT'
  | 'DIVINE_IMMORTAL'
  | 'ALL';

export interface ResolvedBracket {
  bracket: RankBracketBasic;
  /**
   * false => caimos em 'ALL'. A UI NAO pode dizer "no seu ranque" nesse caso;
   * tem de dizer "media geral". É uma regra de honestidade, nao cosmetica.
   */
  isPlayerSpecific: boolean;
}

/**
 * Medalha (tier * 10 + estrelas) -> bracket basico.
 * Conferido na amostra real: `bracket: 6` e `actualRank: 62` concordam, logo
 * `bracket === floor(actualRank / 10)`.
 */
export function tierToBracket(tier: number): RankBracketBasic {
  if (!Number.isFinite(tier) || tier <= 0) return 'UNCALIBRATED';
  if (tier <= 2) return 'HERALD_GUARDIAN';
  if (tier <= 4) return 'CRUSADER_ARCHON';
  if (tier <= 6) return 'LEGEND_ANCIENT';
  return 'DIVINE_IMMORTAL';
}

/**
 * Resolve o bracket para consultar agregados de heroi.
 * Ordem: match.bracket -> actualRank -> seasonRank do jogador -> ALL.
 */
export function resolveBracket(match: MatchDetails, player: MatchPlayer): ResolvedBracket {
  if (typeof match.bracket === 'number' && match.bracket > 0) {
    return { bracket: tierToBracket(match.bracket), isPlayerSpecific: true };
  }
  if (typeof match.actualRank === 'number' && match.actualRank > 0) {
    return { bracket: tierToBracket(Math.floor(match.actualRank / 10)), isPlayerSpecific: true };
  }
  if (typeof player.seasonRank === 'number' && player.seasonRank > 0) {
    return {
      bracket: tierToBracket(Math.floor(player.seasonRank / 10)),
      isPlayerSpecific: true,
    };
  }
  return { bracket: 'ALL', isPlayerSpecific: false };
}

/** Posicao efetiva: o enum cru da STRATZ quando existe, senao o role derivado. */
export function effectivePosition(player: MatchPlayer): Role {
  return player.position || player.role || 'UNKNOWN';
}
