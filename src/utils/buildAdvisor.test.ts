import { describe, it, expect } from 'vitest';
import { computeBuildAdvice, ItemFullPurchaseRow } from './buildAdvisor';
import { ThreatProfile } from './insights/threatProfile';

/**
 * Linhas modeladas na resposta REAL de `itemFullPurchase` (heroId 8, POSITION_1,
 * DIVINE_IMMORTAL). Lembrete de unidade: `timeMin` aqui é MINUTO;
 * `purchases[].time` é SEGUNDO.
 */
function rows(): ItemFullPurchaseRow[] {
  const out: ItemFullPurchaseRow[] = [];
  // Item 147 (Manta): forte, janela boa em 17-19.
  for (const [min, n, w] of [[16, 900, 620], [17, 1057, 853], [18, 2553, 1870], [19, 4126, 2855], [26, 900, 400], [27, 800, 340]]) {
    out.push({ itemId: 147, timeMin: min, matchCount: n, winCount: w });
  }
  // Item 116 (BKB): item de resposta, boa janela em 17-19.
  for (const [min, n, w] of [[17, 800, 560], [18, 1200, 830], [19, 900, 610]]) {
    out.push({ itemId: 116, timeMin: min, matchCount: n, winCount: w });
  }
  // Item 69: ruim de verdade, amostra grande.
  for (const [min, n, w] of [[16, 818, 265], [17, 370, 107]]) {
    out.push({ itemId: 69, timeMin: min, matchCount: n, winCount: w });
  }
  // Item 999: amostra minuscula com 100% de vitoria — a armadilha estatistica.
  out.push({ itemId: 999, timeMin: 18, matchCount: 3, winCount: 3 });
  return out;
}

const secs = (min: number) => min * 60;

describe('unidades: minuto do agregado x segundo da compra', () => {
  it('interpreta purchases[].time como SEGUNDOS', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(26), isCoreItem: true }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    const late = advice.verdicts.find((v) => v.kind === 'LATE' && v.itemId === 147);
    expect(late).toBeTruthy();
    // 26 minutos, nao 26 segundos e nem 1560 minutos.
    expect(late!.playerTimeMin).toBe(26);
  });
});

describe('veredicto LATE', () => {
  it('marca item comprado bem depois da melhor janela', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(26) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    const late = advice.verdicts.find((v) => v.kind === 'LATE')!;
    expect(late.itemId).toBe(147);
    expect(late.bestBandWinRate!).toBeGreaterThan(late.playerBandWinRate!);
    expect(late.magnitude).toBeGreaterThan(0);
  });

  it('nao marca LATE quando comprou dentro da janela', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(18) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    expect(advice.verdicts.some((v) => v.kind === 'LATE')).toBe(false);
  });
});

describe('veredicto GOOD', () => {
  it('reconhece item forte comprado no tempo — a coluna de forcas deixa de ser filler', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(17) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    expect(advice.verdicts.some((v) => v.kind === 'GOOD' && v.itemId === 147)).toBe(true);
  });
});

describe('veredicto MISSING', () => {
  it('aponta item de alto desempenho ausente da build', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 69, time: secs(16) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    const missing = advice.verdicts.filter((v) => v.kind === 'MISSING');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((v) => v.itemId !== 69)).toBe(true);
  });

  it('NUNCA aponta item que a partida acabou antes de existir', () => {
    const advice = computeBuildAdvice({
      purchases: [],
      fullPurchase: rows(),
      threat: null,
      durationMin: 12, // a mediana de compra do 147 é ~19min
      bracketIsPlayerSpecific: true,
    });
    const missing = advice?.verdicts.filter((v) => v.kind === 'MISSING') ?? [];
    expect(missing.some((v) => v.itemId === 147)).toBe(false);
  });
});

describe('veredicto OFF_META', () => {
  it('usa o limite SUPERIOR: so acusa se nem o melhor caso salva o item', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 69, time: secs(16) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    expect(advice.verdicts.some((v) => v.kind === 'OFF_META' && v.itemId === 69)).toBe(true);
  });
});

describe('PROTECAO ESTATISTICA', () => {
  it('3 jogos com 100% nunca supera 2553 jogos com 73%', () => {
    const advice = computeBuildAdvice({
      purchases: [],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    // O item de amostra minuscula nao entra em MISSING (filtro de amostra minima).
    expect(advice.verdicts.some((v) => v.itemId === 999)).toBe(false);
  });
});

describe('universo de itens de build', () => {
  it('ignora consumivel e componente ausentes do agregado, sem grafo de itens', () => {
    const advice = computeBuildAdvice({
      // 43 = Sentry Ward, 44 = Tango etc. Nada disso esta no itemFullPurchase.
      purchases: [
        { itemId: 43, time: secs(2) },
        { itemId: 44, time: secs(3) },
        { itemId: 147, time: secs(26) },
      ],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    const touched = new Set(advice.verdicts.map((v) => v.itemId));
    expect(touched.has(43)).toBe(false);
    expect(touched.has(44)).toBe(false);
  });
});

describe('COUNTER_PICK — a lista curada propoe, o win rate aprova', () => {
  const threat = (over: Partial<ThreatProfile> = {}): ThreatProfile => ({
    physicalPct: 0.2,
    magicalPct: 0.65,
    purePct: 0.05,
    totalReceived: 26000,
    controlRatio: 1.1,
    slowRatio: null,
    topAttacker: { heroId: 26, amount: 8000, pct: 0.41 },
    topAbility: { abilityId: 5439, count: 4, amount: 3200, pct: 0.3 },
    topItemSource: null,
    archetypes: ['MAGIC_BURST'],
    hardestMatchups: [],
    ...over,
  });

  it('recomenda BKB contra burst magico quando o item vence no heroi', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(17) }],
      fullPurchase: rows(),
      threat: threat(),
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    })!;
    const counter = advice.verdicts.find((v) => v.kind === 'COUNTER_PICK')!;
    expect(counter.itemId).toBe(116); // Black King Bar
    expect(counter.threatArchetype).toBe('MAGIC_BURST');
    expect(counter.attributedHeroId).toBe(26);
    expect(counter.attributedAbilityId).toBe(5439);
  });

  it('NAO recomenda quando o item de counter nao vence naquele heroi', () => {
    // Remove o 116 do agregado: a lista curada propoe, mas o dado nao aprova.
    const without = rows().filter((r) => r.itemId !== 116);
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(17) }],
      fullPurchase: without,
      threat: threat(),
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    });
    expect(advice?.verdicts.some((v) => v.kind === 'COUNTER_PICK')).not.toBe(true);
  });

  it('nao repete conselho quando o jogador ja comprou o counter na janela', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 116, time: secs(18) }],
      fullPurchase: rows(),
      threat: threat(),
      durationMin: 40,
      bracketIsPlayerSpecific: true,
    });
    expect(advice?.verdicts.some((v) => v.kind === 'COUNTER_PICK' && v.itemId === 116)).not.toBe(true);
  });
});

describe('degradacao', () => {
  it('sem agregado, nao ha orientacao (em vez de build inventada)', () => {
    expect(
      computeBuildAdvice({ purchases: [], fullPurchase: [], threat: null, durationMin: 40, bracketIsPlayerSpecific: true }),
    ).toBeNull();
    expect(
      computeBuildAdvice({ purchases: [], fullPurchase: null, threat: null, durationMin: 40, bracketIsPlayerSpecific: true }),
    ).toBeNull();
  });

  it('propaga a flag de honestidade do bracket', () => {
    const advice = computeBuildAdvice({
      purchases: [{ itemId: 147, time: secs(26) }],
      fullPurchase: rows(),
      threat: null,
      durationMin: 40,
      bracketIsPlayerSpecific: false,
    })!;
    expect(advice.bracketIsPlayerSpecific).toBe(false);
  });
});
