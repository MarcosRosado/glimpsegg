import { MatchPlayer } from '../../types/dota';

/**
 * USO DE ITEM ATIVO (§4 de docs/PROPOSTA-V2.md) — quantas vezes o jogador usou cada item, e a
 * que ritmo enquanto o tinha.
 *
 * FONTES: `itemUses` (o `item_uses` da OpenDota) e as compras de `itemTimings` (`purchase_log`).
 *
 * O QUE A FONTE NAO DA, E COMO ISSO APARECE:
 *  - HORA DE VENDA nao existe. "Tempo de posse" é da PRIMEIRA compra ao fim da partida, um
 *    TETO; o ritmo calculado sobre ele é um PISO ("pelo menos N usos por 10 min"). O tipo
 *    diz isso em `ratePerTenMinIsFloor`, e a tela tem de dizer tambem.
 *  - Item comprado mais de uma vez (TP, consumivel, item recomprado) nao tem um tempo de
 *    posse so: o ritmo sai `null` e `repeatPurchase` diz por que. Nada de lista de
 *    "consumiveis" mantida a mao — o proprio registro de compras decide.
 *  - Item usado sem compra registrada (neutro, item de outro jogador, presente) nao tem
 *    posse conhecida: ritmo `null`, `firstPurchaseTime` `null`.
 *  - A OpenDota conta ALTERNANCIA como uso (Power Treads trocado de atributo, Armlet ligado):
 *    63 "usos" de Power Treads na fixture sao trocas, nao ativacoes. A metrica nao distingue;
 *    o rotulo tem de dizer "usos registrados", nao "ativacoes".
 *
 * Versao descritiva: nenhum limiar de "pouco uso". `null` sem `itemUses` (partida nao
 * parseada).
 */

export interface ItemUsage {
  itemId: number;
  uses: number;
  /** Primeira compra registrada; `null` se o item nao aparece nas compras. */
  firstPurchaseTime: number | null;
  /** Quantas vezes aparece nas compras. */
  purchases: number;
  /** Comprado mais de uma vez: o tempo de posse é ambiguo e o ritmo sai `null`. */
  repeatPurchase: boolean;
  /** Da primeira compra ao fim da partida — um TETO (nao ha hora de venda). */
  possessionSecondsCeiling: number | null;
  /** Usos por 10 minutos sobre o teto de posse — um PISO. `null` quando a posse é ambigua. */
  ratePerTenMin: number | null;
  ratePerTenMinIsFloor: true;
}

export function activeItemUsage(player: MatchPlayer, durationSeconds: number): ItemUsage[] | null {
  if (!player.itemUses) return null;
  const purchasesById = new Map<number, number[]>();
  for (const t of player.itemTimings ?? []) {
    const list = purchasesById.get(t.itemId);
    if (list) list.push(t.time);
    else purchasesById.set(t.itemId, [t.time]);
  }

  return player.itemUses.map(({ itemId, uses }) => {
    const times = (purchasesById.get(itemId) ?? []).slice().sort((a, b) => a - b);
    const purchases = times.length;
    const firstPurchaseTime = purchases > 0 ? times[0] : null;
    const repeatPurchase = purchases > 1;
    // Compra antes do relogio zerar (tempo negativo) conta a partir do 0: antes disso nao ha jogo.
    const possession =
      firstPurchaseTime !== null && !repeatPurchase ? durationSeconds - Math.max(0, firstPurchaseTime) : null;
    const ratePerTenMin = possession !== null && possession > 0 ? (uses / possession) * 600 : null;
    return {
      itemId,
      uses,
      firstPurchaseTime,
      purchases,
      repeatPurchase,
      possessionSecondsCeiling: possession !== null && possession > 0 ? possession : null,
      ratePerTenMin,
      ratePerTenMinIsFloor: true as const,
    };
  });
}
