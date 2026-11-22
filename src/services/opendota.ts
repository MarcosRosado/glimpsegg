import { reportOpenDotaResponse } from './openDotaHealth';

/**
 * GET generico na OpenDota pelos dois caminhos de rede: IPC no Electron
 * (`api:opendota-fetch`), `fetch` direto no browser. `null` em qualquer falha — quem chama
 * decide se isso derruba a tela ou so esconde uma secao. Nunca devolve dado fabricado.
 *
 * Toda leitura da OpenDota passa por aqui, e por isso o status de cada resposta alimenta
 * `openDotaHealth` (o aviso de instabilidade). Leitura que chame `openDotaFetch` ou `fetch`
 * direto fica fora desse aviso.
 */
export async function openDotaGet<T>(endpoint: string): Promise<T | null> {
  try {
    if (window.api && typeof window.api.openDotaFetch === 'function') {
      const res = await window.api.openDotaFetch<T>(endpoint);
      reportOpenDotaResponse(endpoint, res.success, res.status);
      return res.success && res.data !== undefined ? (res.data as T) : null;
    }
    const res = await fetch(`https://api.opendota.com/api/${endpoint}`);
    reportOpenDotaResponse(endpoint, res.ok, res.status);
    return res.ok ? ((await res.json()) as T) : null;
  } catch (err) {
    console.warn(`OpenDota ${endpoint.split('?')[0]} fetch error:`, err);
    return null;
  }
}

/** `[]` em qualquer falha (o consumidor trata lista vazia como "fonte nao respondeu"). */
export async function fetchOpenDotaHeroStats(): Promise<any[]> {
  const rows = await openDotaGet<any[]>('heroStats');
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOpenDotaPlayer(accountId: string): Promise<any> {
  return (await openDotaGet<any>(`players/${accountId}`)) || null;
}
