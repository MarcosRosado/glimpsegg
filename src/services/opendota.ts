/**
 * GET generico na OpenDota pelos dois caminhos de rede: IPC no Electron
 * (`api:opendota-fetch`), `fetch` direto no browser. `null` em qualquer falha — quem chama
 * decide se isso derruba a tela ou so esconde uma secao. Nunca devolve dado fabricado.
 */
export async function openDotaGet<T>(endpoint: string): Promise<T | null> {
  try {
    if (window.api && typeof window.api.openDotaFetch === 'function') {
      const res = await window.api.openDotaFetch<T>(endpoint);
      return res.success && res.data !== undefined ? (res.data as T) : null;
    }
    const res = await fetch(`https://api.opendota.com/api/${endpoint}`);
    return res.ok ? ((await res.json()) as T) : null;
  } catch (err) {
    console.warn(`OpenDota ${endpoint.split('?')[0]} fetch error:`, err);
    return null;
  }
}

export async function fetchOpenDotaHeroStats(): Promise<any[]> {
  try {
    if (window.api && typeof window.api.openDotaFetch === 'function') {
      const res = await window.api.openDotaFetch<any[]>('heroStats');
      if (res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } else {
      const res = await fetch('https://api.opendota.com/api/heroStats');
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.warn('OpenDota heroStats fetch error:', err);
  }
  return [];
}

export async function fetchOpenDotaPlayer(accountId: string): Promise<any> {
  try {
    if (window.api && typeof window.api.openDotaFetch === 'function') {
      const res = await window.api.openDotaFetch(`players/${accountId}`);
      if (res.success && res.data) {
        return res.data;
      }
    } else {
      const res = await fetch(`https://api.opendota.com/api/players/${accountId}`);
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.warn('OpenDota player fetch error:', err);
  }
  return null;
}
