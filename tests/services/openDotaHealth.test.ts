import { describe, expect, it } from 'vitest';
import {
  HEALTHY,
  classifyOpenDotaResponse,
  endpointFamily,
  nextOpenDotaHealth,
  getOpenDotaHealth,
  openDotaNotice,
  reportOpenDotaResponse,
  resetOpenDotaHealth,
  subscribeOpenDotaHealth,
} from '../../src/services/openDotaHealth';

describe('classifyOpenDotaResponse', () => {
  it('so 5xx é instabilidade', () => {
    expect(classifyOpenDotaResponse(true, 200)).toBe('OK');
    expect(classifyOpenDotaResponse(false, 500)).toBe('SERVER_ERROR');
    expect(classifyOpenDotaResponse(false, 503)).toBe('SERVER_ERROR');
  });

  it('404, 429 e falha sem status nao mexem no aviso', () => {
    expect(classifyOpenDotaResponse(false, 404)).toBe('IGNORED');
    expect(classifyOpenDotaResponse(false, 429)).toBe('IGNORED');
    expect(classifyOpenDotaResponse(false, undefined)).toBe('IGNORED');
  });
});

describe('endpointFamily', () => {
  it('tira id e query', () => {
    expect(endpointFamily('players/123/matches?limit=40&project=hero_id')).toBe('players/:id/matches');
    expect(endpointFamily('/players/123/wl')).toBe('players/:id/wl');
    expect(endpointFamily('matches/9101312905')).toBe('matches/:id');
    expect(endpointFamily('benchmarks?hero_id=1')).toBe('benchmarks');
  });
});

describe('nextOpenDotaHealth', () => {
  it('5xx marca a rota e a hora', () => {
    const s = nextOpenDotaHealth(HEALTHY, 'players/1/wl', 'SERVER_ERROR', 1000);
    expect(s).toEqual({ failing: ['players/:id/wl'], lastServerErrorAt: 1000 });
  });

  // Caso real de 2026-11-22: players/{id} respondia enquanto /wl e /matches davam 500.
  it('outra rota respondendo nao apaga a falha', () => {
    const s1 = nextOpenDotaHealth(HEALTHY, 'players/1/wl', 'SERVER_ERROR', 1000);
    const s2 = nextOpenDotaHealth(s1, 'players/1', 'OK', 2000);
    expect(s2.failing).toEqual(['players/:id/wl']);
  });

  it('a mesma rota respondendo limpa a falha dela, de qualquer conta', () => {
    const s1 = nextOpenDotaHealth(HEALTHY, 'players/1/wl', 'SERVER_ERROR', 1000);
    const s2 = nextOpenDotaHealth(s1, 'players/1/peers', 'SERVER_ERROR', 1100);
    const s3 = nextOpenDotaHealth(s2, 'players/2/wl', 'OK', 2000);
    expect(s3.failing).toEqual(['players/:id/peers']);
    expect(s3.lastServerErrorAt).toBe(1100);
  });

  it('resposta ignorada ou OK sem falha devolve o mesmo objeto (o store nao avisa ninguem)', () => {
    expect(nextOpenDotaHealth(HEALTHY, 'players/1', 'OK', 1)).toBe(HEALTHY);
    const s1 = nextOpenDotaHealth(HEALTHY, 'players/1/wl', 'SERVER_ERROR', 1000);
    expect(nextOpenDotaHealth(s1, 'players/1/wl', 'IGNORED', 2000)).toBe(s1);
  });

  it('a rota que falha de novo nao duplica', () => {
    const s1 = nextOpenDotaHealth(HEALTHY, 'players/1/matches?limit=40', 'SERVER_ERROR', 1000);
    const s2 = nextOpenDotaHealth(s1, 'players/1/matches?project=hero_id', 'SERVER_ERROR', 1200);
    expect(s2).toEqual({ failing: ['players/:id/matches'], lastServerErrorAt: 1200 });
  });
});

describe('openDotaNotice', () => {
  const unstable = nextOpenDotaHealth(HEALTHY, 'players/1/wl', 'SERVER_ERROR', 1000);

  it('sem falha e sem demora, nada', () => {
    expect(openDotaNotice(HEALTHY, { slow: false, dismissedAt: null })).toBeNull();
  });

  it('demora sozinha avisa que esta lenta', () => {
    expect(openDotaNotice(HEALTHY, { slow: true, dismissedAt: null })).toBe('SLOW');
  });

  it('5xx medido vence a demora', () => {
    expect(openDotaNotice(unstable, { slow: true, dismissedAt: null })).toBe('UNSTABLE');
  });

  it('fechado vale ate o proximo 5xx', () => {
    expect(openDotaNotice(unstable, { slow: false, dismissedAt: 1000 })).toBeNull();
    const again = nextOpenDotaHealth(unstable, 'players/1/peers', 'SERVER_ERROR', 5000);
    expect(openDotaNotice(again, { slow: false, dismissedAt: 1000 })).toBe('UNSTABLE');
  });

  it('fechado, a demora ainda avisa', () => {
    expect(openDotaNotice(unstable, { slow: true, dismissedAt: 1000 })).toBe('SLOW');
  });
});

describe('store', () => {
  it('5xx avisa quem assina; tentar de novo limpa e avisa de novo', () => {
    resetOpenDotaHealth();
    let calls = 0;
    const off = subscribeOpenDotaHealth(() => calls++);
    reportOpenDotaResponse('players/1/heroes', false, 500);
    expect(getOpenDotaHealth().failing).toEqual(['players/:id/heroes']);
    expect(calls).toBe(1);
    // A rota que falhou pode nao ser chamada pela nova tentativa: o reset é que tira o aviso.
    resetOpenDotaHealth();
    expect(getOpenDotaHealth()).toBe(HEALTHY);
    expect(calls).toBe(2);
    resetOpenDotaHealth();
    expect(calls).toBe(2);
    off();
  });
});
