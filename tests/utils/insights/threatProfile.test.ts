import { describe, it, expect } from 'vitest';
import { buildThreatProfile, MatchupRow } from '../../../src/utils/insights/threatProfile';
import { mapStratzMatch } from '../../../src/services/stratzGql';
import fixture from '../../../src/services/__fixtures__/match-parsed.json';

const match = mapStratzMatch((fixture as any).data.match);

describe('buildThreatProfile — partida real', () => {
  it('calcula a divisao fisico/magico/puro somando 1', () => {
    const p = match.players[0];
    const t = buildThreatProfile(p, match, null)!;
    expect(t).toBeTruthy();
    expect(t.physicalPct + t.magicalPct + t.purePct).toBeCloseTo(1, 5);
    expect(t.totalReceived).toBeGreaterThan(0);
  });

  it('o maior agressor é um heroi INIMIGO, nao um neutro nem um aliado', () => {
    const p = match.players[0];
    const t = buildThreatProfile(p, match, null)!;
    expect(t.topAttacker).toBeTruthy();
    const enemyIds = new Set(
      match.players.filter((x) => x.isRadiant !== p.isRadiant).map((x) => x.heroId),
    );
    expect(enemyIds.has(t.topAttacker!.heroId)).toBe(true);
    expect(t.topAttacker!.pct).toBeGreaterThan(0);
    expect(t.topAttacker!.pct).toBeLessThanOrEqual(1);
  });

  it('identifica a habilidade que mais machucou', () => {
    const t = buildThreatProfile(match.players[0], match, null)!;
    expect(t.topAbility).toBeTruthy();
    expect(t.topAbility!.abilityId).toBeGreaterThan(0);
    expect(t.topAbility!.amount).toBeGreaterThan(0);
  });

  it('devolve null quando nao ha relatorio de dano', () => {
    const sem = { ...match.players[0], damageReport: null } as any;
    expect(buildThreatProfile(sem, match, null)).toBeNull();
  });
});

describe('arquetipos de ameaca', () => {
  function withDamage(physical: number, magical: number, pure = 0) {
    const p = match.players[0];
    return {
      ...p,
      damageReport: {
        ...p.damageReport!,
        receivedTotal: {
          ...p.damageReport!.receivedTotal!,
          physicalDamage: physical,
          magicalDamage: magical,
          pureDamage: pure,
        },
      },
    } as any;
  }

  it('MAGIC_BURST quando o dano magico passa de 55%', () => {
    const t = buildThreatProfile(withDamage(3000, 7000), match, null)!;
    expect(t.archetypes).toContain('MAGIC_BURST');
    expect(t.archetypes).not.toContain('PHYSICAL_RIGHT_CLICK');
  });

  it('PHYSICAL_RIGHT_CLICK quando o dano fisico passa de 60%', () => {
    const t = buildThreatProfile(withDamage(8000, 2000), match, null)!;
    expect(t.archetypes).toContain('PHYSICAL_RIGHT_CLICK');
    expect(t.archetypes).not.toContain('MAGIC_BURST');
  });

  it('PURE_DAMAGE quando o dano puro passa de 15%', () => {
    const t = buildThreatProfile(withDamage(4000, 4000, 2000), match, null)!;
    expect(t.archetypes).toContain('PURE_DAMAGE');
  });

  it('dano equilibrado nao ativa arquetipo de tipo de dano', () => {
    const t = buildThreatProfile(withDamage(5000, 5000), match, null)!;
    expect(t.archetypes).not.toContain('MAGIC_BURST');
    expect(t.archetypes).not.toContain('PHYSICAL_RIGHT_CLICK');
  });
});

describe('confrontos mais difíceis', () => {
  const enemies = () => {
    const p = match.players[0];
    return match.players.filter((x) => x.isRadiant !== p.isRadiant).map((x) => x.heroId);
  };

  it('filtra pelos 5 inimigos e ranqueia pelo win rate DO CONFRONTO', () => {
    const [a, b, c] = enemies();
    const rows: MatchupRow[] = [
      { heroId2: a, winsAverage: 0.42, winCount: 420, matchCount: 1000, synergy: -4 },
      { heroId2: b, winsAverage: 0.58, winCount: 580, matchCount: 1000, synergy: 4 },
      { heroId2: c, winsAverage: 0.5, winCount: 500, matchCount: 1000, synergy: 0 },
      // Heroi que nao esta na partida: tem de ser descartado.
      { heroId2: 9999, winsAverage: 0.2, winCount: 200, matchCount: 1000, synergy: -9 },
    ];
    const t = buildThreatProfile(match.players[0], match, rows)!;
    expect(t.hardestMatchups.map((m) => m.heroId)).toEqual([a, c, b]);
    expect(t.hardestMatchups.some((m) => m.heroId === 9999)).toBe(false);
  });

  it('descarta confronto com amostra pequena — nao vira conclusao', () => {
    const [a] = enemies();
    const rows: MatchupRow[] = [
      { heroId2: a, winsAverage: 0.1, winCount: 1, matchCount: 10, synergy: -9 },
    ];
    const t = buildThreatProfile(match.players[0], match, rows)!;
    expect(t.hardestMatchups).toHaveLength(0);
  });

  it('calcula o limite inferior de Wilson abaixo do win rate observado', () => {
    const [a] = enemies();
    const rows: MatchupRow[] = [
      { heroId2: a, winsAverage: 0.42, winCount: 420, matchCount: 1000, synergy: -4 },
    ];
    const t = buildThreatProfile(match.players[0], match, rows)!;
    expect(t.hardestMatchups[0].ourWinRateLower).toBeLessThan(0.42);
    expect(t.hardestMatchups[0].ourWinRateLower).toBeGreaterThan(0.35);
  });
});

describe('controle e slow sofridos — contra a media da partida', () => {
  /** Clona a partida trocando so o controle/slow recebido de cada jogador. */
  function withControl(
    perPlayer: (index: number) => Partial<{
      stunCount: number;
      stunDuration: number;
      disableCount: number;
      disableDuration: number;
      slowCount: number;
      slowDuration: number;
    }>,
    durationSeconds = match.durationSeconds,
  ) {
    const zero = {
      stunCount: 0,
      stunDuration: 0,
      disableCount: 0,
      disableDuration: 0,
      slowCount: 0,
      slowDuration: 0,
    };
    return {
      ...match,
      durationSeconds,
      players: match.players.map((p, i) => ({
        ...p,
        damageReport: {
          ...p.damageReport!,
          receivedTotal: { ...p.damageReport!.receivedTotal!, ...zero, ...perPlayer(i) },
        },
      })),
    } as typeof match;
  }

  it('na partida real, heroi sem stun proprio nao vira "141x a media"', () => {
    // Regressao: o denominador era `heroAverage.stunDuration`, que mede o controle que o
    // heroi CAUSA. Terrorblade (109) dava 141x e Undying (85) 68,6x nesta mesma fixture.
    for (const p of match.players) {
      const t = buildThreatProfile(p, match, null)!;
      expect(t.controlRatio).not.toBeNull();
      expect(t.controlRatio!).toBeLessThan(1.75);
      expect(t.archetypes).not.toContain('HARD_LOCKDOWN');
    }
    const terrorblade = match.players.find((p) => p.heroId === 109)!;
    expect(buildThreatProfile(terrorblade, match, null)!.controlRatio!).toBeCloseTo(0.8, 1);
  });

  it('as razoes da partida tem media 1 — a referencia sao os dez jogadores', () => {
    const ratios = match.players.map((p) => buildThreatProfile(p, match, null)!.controlRatio!);
    expect(ratios.reduce((s, r) => s + r, 0) / ratios.length).toBeCloseTo(1, 5);
  });

  it('na partida real, o slow acima da media com contagem alta vira SLOW_KITE', () => {
    const undying = match.players.find((p) => p.heroId === 85)!;
    const t = buildThreatProfile(undying, match, null)!;
    expect(t.slowRatio!).toBeGreaterThan(1.75);
    expect(t.archetypes).toContain('SLOW_KITE');
  });

  it('dois stuns numa partida curta nao sao lockdown, por maior que seja a razao', () => {
    // Caso real (9096529218, 15 min): sete jogadores sem controle nenhum e dois com 2
    // stuns cada. A razao da 4,5x, mas dois stuns nao sustentam a afirmacao.
    const m = withControl((i) => (i < 2 ? { stunCount: 2, stunDuration: 400 } : {}), 15 * 60);
    const t = buildThreatProfile(m.players[0], m, null)!;
    expect(t.controlRatio!).toBeCloseTo(5, 5);
    expect(t.archetypes).not.toContain('HARD_LOCKDOWN');
  });

  it('acusa lockdown quando a razao e a contagem sustentam', () => {
    const m = withControl(
      (i) => (i === 0 ? { stunCount: 40, stunDuration: 6000 } : { stunCount: 15, stunDuration: 2000 }),
      30 * 60,
    );
    const alvo = buildThreatProfile(m.players[0], m, null)!;
    expect(alvo.controlRatio!).toBeCloseTo(2.5, 5);
    expect(alvo.archetypes).toContain('HARD_LOCKDOWN');
    expect(buildThreatProfile(m.players[1], m, null)!.archetypes).not.toContain('HARD_LOCKDOWN');
  });

  it('sem controle na partida inteira nao ha razao — null, nunca zero nem infinito', () => {
    const m = withControl(() => ({}));
    const t = buildThreatProfile(m.players[0], m, null)!;
    expect(t.controlRatio).toBeNull();
    expect(t.slowRatio).toBeNull();
    expect(t.archetypes).not.toContain('HARD_LOCKDOWN');
    expect(t.archetypes).not.toContain('SLOW_KITE');
  });

  it('jogador sem relatorio de dano na partida: a media seria de outra populacao, entao null', () => {
    const m = {
      ...match,
      players: match.players.map((p, i) => (i === 9 ? { ...p, damageReport: null } : p)),
    } as typeof match;
    expect(buildThreatProfile(m.players[0], m, null)!.controlRatio).toBeNull();
  });
});
