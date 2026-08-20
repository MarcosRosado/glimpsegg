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
