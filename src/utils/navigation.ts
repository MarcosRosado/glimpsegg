import type { MatchDetails } from '../types/dota';

/**
 * Decisões de navegação da 2.0 que precisam de teste e por isso não moram em componente.
 *
 * As duas são pequenas, mas cada uma tem um jeito de errar em silêncio: abrir a partida
 * em "Meu jogo" mostrando o jogo de OUTRA pessoa, e tratar um número digitado na busca
 * como conta quando era partida (ou o contrário). Ver docs/PROPOSTA-V2.md §3.1 e §3.4.
 */

/** As abas da partida analisada (§3.4). A não analisada não tem abas: é o "modo placar". */
export type MatchTab = 'SUMMARY' | 'MY_GAME' | 'FIGHTS' | 'VISION' | 'COACHING';

/**
 * Slot inicial e aba inicial ao abrir uma partida.
 *
 * Slot: o da conta VISUALIZADA, se ela jogou; senão o da conta configurada; senão o
 * primeiro. É o comportamento da 1.0 (abrir uma partida a partir do perfil de outra
 * pessoa foca nela), mais o caso da conta configurada aparecer como companheira.
 *
 * Aba: "Meu jogo" só quando a partida foi analisada E o slot escolhido é de fato o da
 * conta configurada (decisão do dono, 2026-11-19). A checagem é sobre o slot achado, não
 * sobre "a partida veio da minha lista": o fallback para `players[0]` abriria "Meu jogo"
 * com o jogo de um desconhecido. Nos outros casos, "Resumo".
 */
export function initialMatchView(
  match: Pick<MatchDetails, 'players' | 'availability'>,
  configuredSteamId: string,
  viewedSteamId: string,
): { slot: number; tab: MatchTab } {
  const players = match.players ?? [];
  const byAccount = (id: string) =>
    id ? players.find((p) => p.steamAccountId === id) : undefined;
  const chosen = byAccount(viewedSteamId) ?? byAccount(configuredSteamId);
  const slot = chosen ? chosen.playerSlot : (players[0]?.playerSlot ?? 0);
  const isMine =
    !!chosen && !!configuredSteamId && chosen.steamAccountId === configuredSteamId;
  const analyzed = !!match.availability?.parsed && !match.availability?.parsePending;
  return { slot, tab: analyzed && isMine ? 'MY_GAME' : 'SUMMARY' };
}

/**
 * O que um texto digitado na busca (Ctrl+K) quer abrir.
 *
 * - Link de partida (OpenDota, Dotabuff, STRATZ) → partida, sem dúvida.
 * - Número puro: o account id da Steam cabe em 32 bits (≤ 4.294.967.295), e todo id de
 *   partida desde 2018 passa disso (a de conferência da 2.0 é 9.096.704.970). Acima do
 *   teto de 32 bits e abaixo do SteamID64 → partida. Até o teto → conta, MAS com a
 *   partida oferecida como segunda opção (`AMBIGUOUS`): partida antiga também cabe ali,
 *   e adivinhar seria abrir a coisa errada sem avisar.
 * - SteamID64, link de perfil, vanity, nome → conta (o `resolveSteamId` resolve).
 */
export type SearchIntent =
  | { kind: 'MATCH'; matchId: string }
  | { kind: 'ACCOUNT' }
  | { kind: 'AMBIGUOUS'; matchId: string };

const MAX_ACCOUNT_ID = 4294967295n;
const STEAM64_OFFSET = 76561197960265728n;
const MATCH_URL = /(?:opendota\.com|dotabuff\.com|stratz\.com)\/(?:[a-z-]+\/)?matches\/(\d+)/i;

export function classifySearchInput(raw: string): SearchIntent {
  const input = (raw ?? '').trim();
  const fromUrl = input.match(MATCH_URL);
  if (fromUrl) return { kind: 'MATCH', matchId: String(BigInt(fromUrl[1])) };
  if (!/^\d+$/.test(input)) return { kind: 'ACCOUNT' };
  const n = BigInt(input);
  if (n === 0n || n >= STEAM64_OFFSET) return { kind: 'ACCOUNT' };
  if (n > MAX_ACCOUNT_ID) return { kind: 'MATCH', matchId: String(n) };
  return { kind: 'AMBIGUOUS', matchId: String(n) };
}
