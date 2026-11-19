import { describe, it, expect } from 'vitest';
import { activeItemUsage } from '../../../src/utils/matchMetrics/itemUsage';
import { referenceMatch, referenceRaw, unevenLaneMatch, unevenLaneRaw } from '../../support/fixtureMatches';
import { getItem } from '../../../src/constants/items';

describe('activeItemUsage — conta a mao no slot 0 da partida de referencia (2382 s)', () => {
  const match = referenceMatch();
  const p0 = match.players.find((p) => p.playerSlot === 0)!;
  const usage = activeItemUsage(p0, match.durationSeconds)!;
  const byName = (name: string) => usage.find((u) => getItem(u.itemId).name === `item_${name}`)!;

  it('Blink: 17 usos, comprado aos 1252 s => 1130 s de posse (teto), 9,03 por 10 min (piso)', () => {
    expect(byName('blink')).toMatchObject({ uses: 17, firstPurchaseTime: 1252, purchases: 1, repeatPurchase: false, possessionSecondsCeiling: 1130 });
    expect(byName('blink').ratePerTenMin!).toBeCloseTo((17 / 1130) * 600, 10);
  });

  it('compra antes do relogio zerar conta a partir do 0 (Quelling Blade aos -89 s => 2382 s)', () => {
    expect(byName('quelling_blade').possessionSecondsCeiling).toBe(2382);
  });

  it('TP comprado sete vezes: posse ambigua, ritmo null', () => {
    expect(byName('tpscroll')).toMatchObject({ uses: 12, purchases: 7, repeatPurchase: true, ratePerTenMin: null, possessionSecondsCeiling: null });
  });

  it('item usado sem compra registrada (neutro): sem posse, sem ritmo', () => {
    expect(byName('madstone_bundle')).toMatchObject({ uses: 25, purchases: 0, firstPurchaseTime: null, ratePerTenMin: null });
  });

  it('Power Treads: 63 usos registrados — sao trocas de atributo, e o ritmo é piso', () => {
    expect(byName('power_treads')).toMatchObject({ uses: 63, firstPurchaseTime: 278, ratePerTenMinIsFloor: true });
  });
});

describe.each([
  ['referencia', referenceMatch, referenceRaw],
  ['rota desigual', unevenLaneMatch, unevenLaneRaw],
] as const)('activeItemUsage sobre a partida real (%s)', (_n, build, buildRaw) => {
  const match = build();
  const raw = buildRaw();

  it('usos e numero de compras batem com o cru, item a item', () => {
    for (const p of match.players) {
      const r = raw.players.find((x: any) => x.player_slot === p.playerSlot);
      const usage = activeItemUsage(p, match.durationSeconds)!;
      for (const u of usage) {
        const key = getItem(u.itemId).name.replace(/^item_/, '');
        expect(u.uses, key).toBe(r.item_uses[key]);
        expect(u.purchases, key).toBe(r.purchase_log.filter((e: any) => e.key === key).length);
      }
    }
  });
});

describe('activeItemUsage — sem dado', () => {
  it('jogador sem itemUses (partida nao parseada): null', () => {
    const p = { ...referenceMatch().players[0], itemUses: null };
    expect(activeItemUsage(p, 2382)).toBeNull();
  });
});
