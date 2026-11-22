/**
 * Saude da OpenDota vista pelo app: quais rotas responderam com erro de servidor (5xx) na
 * ultima chamada. Existe para a tela dizer "a OpenDota esta instavel, tente mais tarde" em vez
 * de so mostrar cartoes vazios ou um carregamento que nao termina.
 *
 * Caso real (2026-11-22): `players/{id}/wl`, `/matches`, `/peers` e `/heroes` voltavam 500
 * depois de 12 a 43 s, para qualquer conta, enquanto `players/{id}` e `matches/{id}` seguiam
 * respondendo. Por isso a instabilidade é por **rota**, nao um interruptor global: uma rota que
 * responde nao apaga a falha de outra, e a mesma rota respondendo de novo limpa a dela.
 *
 * So 5xx conta. 404, 429 (limite de uso) e falha de rede sem status nao sao instabilidade da
 * OpenDota (id inexistente, cota do jogador, jogador offline) e nao mexem no estado.
 *
 * As funcoes de estado sao puras e testadas; o store do fim do arquivo é so o fio que o
 * `openDotaGet` alimenta e o `App` assina (`useSyncExternalStore`).
 */

/** Carregamento acima disto mostra o aviso de demora. As rotas que falharam levavam 12 s ou mais. */
export const SLOW_OPENDOTA_NOTICE_MS = 10_000;

export type OpenDotaOutcome = 'OK' | 'SERVER_ERROR' | 'IGNORED';

export interface OpenDotaHealth {
  /** Rotas (`endpointFamily`) cuja ultima resposta foi 5xx, em ordem de falha. */
  failing: readonly string[];
  /** Quando chegou o ultimo 5xx (ms). Fechar o aviso guarda este valor; 5xx novo o reabre. */
  lastServerErrorAt: number | null;
}

export const HEALTHY: OpenDotaHealth = { failing: [], lastServerErrorAt: null };

/** `ok` = a resposta foi usavel. Sem status (rede, timeout, JSON quebrado) nao é instabilidade. */
export function classifyOpenDotaResponse(ok: boolean, status: number | undefined): OpenDotaOutcome {
  if (ok) return 'OK';
  if (typeof status === 'number' && status >= 500 && status <= 599) return 'SERVER_ERROR';
  return 'IGNORED';
}

/**
 * Rota sem query e sem ids: `players/123/matches?limit=40` → `players/:id/matches`. As duas
 * buscas de partidas do perfil (40 recentes e a lista inteira) caem na mesma rota de proposito:
 * é o mesmo servico do lado da OpenDota.
 */
export function endpointFamily(endpoint: string): string {
  const path = endpoint.replace(/^\/+/, '').split(/[?#]/)[0];
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => (/^\d+$/.test(seg) ? ':id' : seg))
    .join('/');
}

export function nextOpenDotaHealth(
  state: OpenDotaHealth,
  endpoint: string,
  outcome: OpenDotaOutcome,
  now: number,
): OpenDotaHealth {
  if (outcome === 'IGNORED') return state;
  const family = endpointFamily(endpoint);
  const without = state.failing.filter((f) => f !== family);
  if (outcome === 'OK') {
    return without.length === state.failing.length ? state : { ...state, failing: without };
  }
  return { failing: [...without, family], lastServerErrorAt: now };
}

export type OpenDotaNotice = 'UNSTABLE' | 'SLOW' | null;

/**
 * Qual aviso mostrar. Instabilidade medida (5xx) vence a demora, porque é afirmacao com base;
 * a demora sozinha so diz que esta lento. `dismissedAt` é o `lastServerErrorAt` que o jogador
 * fechou: o aviso volta se um 5xx mais novo chegar.
 */
export function openDotaNotice(
  health: OpenDotaHealth,
  opts: { slow: boolean; dismissedAt: number | null },
): OpenDotaNotice {
  const unstable =
    health.failing.length > 0 &&
    health.lastServerErrorAt !== null &&
    (opts.dismissedAt === null || health.lastServerErrorAt > opts.dismissedAt);
  if (unstable) return 'UNSTABLE';
  return opts.slow ? 'SLOW' : null;
}

// --- store do processo do renderer ---

let current: OpenDotaHealth = HEALTHY;
const listeners = new Set<() => void>();

export function getOpenDotaHealth(): OpenDotaHealth {
  return current;
}

export function subscribeOpenDotaHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * "Tentar de novo" começa do zero. Sem isto, uma rota que falhou e que a nova tentativa nao
 * chama de novo (os herois do layout espelho, a secao Conta, o perfil com uma partida aberta)
 * deixaria o aviso de instavel na tela depois de a OpenDota voltar. O que ainda falhar volta a
 * acusar na resposta seguinte, com hora nova.
 */
export function resetOpenDotaHealth(): void {
  if (current === HEALTHY) return;
  current = HEALTHY;
  listeners.forEach((l) => l());
}

export function reportOpenDotaResponse(endpoint: string, ok: boolean, status: number | undefined): void {
  const next = nextOpenDotaHealth(current, endpoint, classifyOpenDotaResponse(ok, status), Date.now());
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
