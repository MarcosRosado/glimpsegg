import { describe, it, expect, vi } from 'vitest';
import { withAccountProfile } from '../../src/services/steamResolver';
import player from '../../src/services/__fixtures__/opendota-player.json';

/** O resultado que `resolveSteamId` devolve para um ID numérico: só os IDs, sem consulta. */
const byId = { success: true, steamAccountId: '100000001', steamId64: '76561198060265729' };

/** OpenDota que não deve ser chamada. */
const neverOpenDota = () => vi.fn().mockRejectedValue(new Error('não devia consultar a OpenDota'));

describe('withAccountProfile', () => {
  it('Steam primeiro: nome e foto do perfil daquele SteamID64, sem gastar cota da OpenDota', async () => {
    const steam = vi.fn().mockResolvedValue({ success: true, found: true, personaname: 'Jogador', avatar: 'https://avatars.fastly.steamstatic.com/x_full.jpg' });
    const openDota = neverOpenDota();
    const res = await withAccountProfile(byId, { steam, openDota });
    expect(steam).toHaveBeenCalledWith('76561198060265729');
    expect(openDota).not.toHaveBeenCalled();
    expect(res).toMatchObject({ personaname: 'Jogador', avatar: 'https://avatars.fastly.steamstatic.com/x_full.jpg', profileStatus: 'FOUND' });
  });

  it('"não existe" da Steam é final: NOT_FOUND sem perguntar à OpenDota', async () => {
    const openDota = neverOpenDota();
    const res = await withAccountProfile(byId, { steam: async () => ({ success: true, found: false }), openDota });
    expect(res.profileStatus).toBe('NOT_FOUND');
    expect(openDota).not.toHaveBeenCalled();
  });

  it('Steam sem resposta cai na OpenDota (perfil real anonimizado)', async () => {
    for (const steam of [async () => ({ success: false, error: 'HTTP 429' }), async () => Promise.reject(new Error('x')), undefined]) {
      const res = await withAccountProfile(byId, { steam, openDota: async () => player.player });
      expect(res).toMatchObject({ personaname: 'Jogador Anonimo', profileStatus: 'FOUND' });
      // Foto vazia na resposta não vira foto: o cartão mostra a inicial.
      expect(res.avatar).toBeUndefined();
    }
  });

  it('as duas fontes falhando mantém o ID e diz UNAVAILABLE, sem inventar nome', async () => {
    const res = await withAccountProfile(byId, { steam: async () => null, openDota: async () => null });
    expect(res).toMatchObject({ success: true, steamAccountId: '100000001', profileStatus: 'UNAVAILABLE' });
    expect(res.personaname).toBeUndefined();
  });

  it('OpenDota sem perfil é NOT_FOUND', async () => {
    const res = await withAccountProfile(byId, { openDota: async () => ({ rank_tier: null }) });
    expect(res.profileStatus).toBe('NOT_FOUND');
  });

  it('não consulta nada quando o nome já veio da busca, nem quando a resolução falhou', async () => {
    const steam = vi.fn();
    const openDota = vi.fn();
    expect((await withAccountProfile({ ...byId, personaname: 'X' }, { steam, openDota })).profileStatus).toBe('FOUND');
    expect(await withAccountProfile({ success: false, error: 'x' }, { steam, openDota })).toEqual({ success: false, error: 'x' });
    expect(steam).not.toHaveBeenCalled();
    expect(openDota).not.toHaveBeenCalled();
  });
});
