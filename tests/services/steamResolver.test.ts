import { describe, it, expect, vi } from 'vitest';
import { withOpenDotaProfile } from '../../src/services/steamResolver';
import player from '../../src/services/__fixtures__/opendota-player.json';

/** O resultado que `resolveSteamId` devolve para um ID numérico: só os IDs, sem consulta. */
const byId = { success: true, steamAccountId: '100000001', steamId64: '76561198060265729' };

describe('withOpenDotaProfile', () => {
  it('preenche nome e foto com o perfil público daquele id (resposta real anonimizada)', async () => {
    const fetchPlayer = vi.fn().mockResolvedValue({
      ...player.player,
      profile: { ...player.player.profile, avatarfull: 'https://example.invalid/a.jpg' },
    });
    const res = await withOpenDotaProfile(byId, fetchPlayer);
    expect(fetchPlayer).toHaveBeenCalledWith('100000001');
    expect(res).toMatchObject({ steamAccountId: '100000001', personaname: 'Jogador Anonimo', avatar: 'https://example.invalid/a.jpg', profileStatus: 'FOUND' });
  });

  it('foto vazia não vira foto: fica sem avatar e o cartão mostra a inicial', async () => {
    const res = await withOpenDotaProfile(byId, async () => player.player);
    expect(res.personaname).toBe('Jogador Anonimo');
    expect(res.avatar).toBeUndefined();
  });

  it('consulta que falha mantém o ID e diz UNAVAILABLE, sem inventar nome', async () => {
    for (const fetchPlayer of [async () => null, async () => Promise.reject(new Error('429'))]) {
      const res = await withOpenDotaProfile(byId, fetchPlayer);
      expect(res).toMatchObject({ success: true, steamAccountId: '100000001', profileStatus: 'UNAVAILABLE' });
      expect(res.personaname).toBeUndefined();
    }
  });

  it('resposta sem perfil é NOT_FOUND (ID possivelmente errado)', async () => {
    const res = await withOpenDotaProfile(byId, async () => ({ rank_tier: null }));
    expect(res.profileStatus).toBe('NOT_FOUND');
    expect(res.personaname).toBeUndefined();
  });

  it('não consulta quando o nome já veio da busca, nem quando a resolução falhou', async () => {
    const fetchPlayer = vi.fn();
    expect((await withOpenDotaProfile({ ...byId, personaname: 'X' }, fetchPlayer)).profileStatus).toBe('FOUND');
    expect(await withOpenDotaProfile({ success: false, error: 'x' }, fetchPlayer)).toEqual({ success: false, error: 'x' });
    expect(fetchPlayer).not.toHaveBeenCalled();
  });
});
