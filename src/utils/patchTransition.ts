import { PATCH_TRANSITION, PatchTransitionConfig } from '../constants/gameVersion';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "7.42b" -> "7.42". Devolve a entrada intacta se nao reconhecer o formato. */
function majorPatch(patch: string): string {
  const match = String(patch).trim().match(/^v?(\d+\.\d+)[a-z]?$/i);
  return match ? match[1] : String(patch).trim();
}

/**
 * Diz se os agregados de meta ainda estao na janela de transicao do patch resolvido.
 *
 * Devolve o patch em transicao, ou `null` quando nao ha aviso a dar: sem janela
 * configurada, patch resolvido diferente do configurado (o usuario pode estar offline
 * com cache antigo — ai os agregados em cache tambem sao do patch antigo e o rotulo esta
 * certo), relogio antes da publicacao, ou prazo vencido.
 *
 * Pura: `now` e `config` entram por parametro para o teste nao depender do relogio.
 */
export function getPatchTransition(
  currentPatch: string,
  now: Date = new Date(),
  config: PatchTransitionConfig | null = PATCH_TRANSITION,
): string | null {
  if (!config) return null;
  if (majorPatch(currentPatch) !== majorPatch(config.patch)) return null;

  const releasedAt = Date.parse(config.releasedAt);
  if (Number.isNaN(releasedAt)) return null;

  const elapsed = now.getTime() - releasedAt;
  if (elapsed < 0 || elapsed >= config.days * DAY_MS) return null;

  return majorPatch(config.patch);
}
