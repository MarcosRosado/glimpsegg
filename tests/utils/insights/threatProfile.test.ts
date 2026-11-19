import { describe, it, expect } from 'vitest';
import { buildThreatProfile, MatchupRow } from '../../../src/utils/insights/threatProfile';
import { referenceMatch, withSyntheticDamageReport, withSyntheticHeroAverage } from '../../support/fixtureMatches';

/**
 * Base REAL: a partida da OpenDota pelo mapper. Ela tem de quem veio o dano
 * (`receivedTargets`), mas nao o tipo (fisico/magico/puro) nem o controle sofrido — e sem
 * `receivedTotal` o perfil de ameaca nao existe. Tudo o que depende disso entra pela
 * sobreposicao SINTETICA de tests/support/ (as regras que leem o perfil estao dormentes no
 * app desde que a STRATZ saiu, 2026-11-19).
 */
const real = referenceMatch();
const match = withSyntheticDamageReport(
  real,
  () => ({ physicalDamage: 6000, magicalDamage: 3000, pureDamage: 1000 }),
  () => [
    { abilityId: 5003, count: 4, amount: 1800 },
    { abilityId: 5004, count: 9, amount: 2600 },
    { abilityId: 5005, count: 1, amount: 300 },
  ],
);

describe('buildThreatProfile — partida real', () => {
  it('na OpenDota pura, sem divisao de dano, nao ha perfil: null, nunca um perfil vazio', () => {
    for (const p of real.players) expect(buildThreatProfile(p, real, null)).toBeNull();
  });

  it('calcula a divisao fisico/magico/puro somando 1', () => {
    const t = buildThreatProfile(match.players[0], match, null)!;
    expect(t).toBeTruthy();
    expect(t.physicalPct + t.magicalPct + t.purePct).toBeCloseTo(1, 5);
    expect(t.physicalPct).toBeCloseTo(0.6, 5);
    expect(t.totalReceived).toBeGreaterThan(0);
  });

  it('o maior agressor é um heroi INIMIGO, nao um neutro nem um aliado (dado real)', () => {
    for (const p of match.players) {
      const t = buildThreatProfile(p, match, null)!;
      expect(t.topAttacker).toBeTruthy();
      const enemyIds = new Set(match.players.filter((x) => x.isRadiant !== p.isRadiant).map((x) => x.heroId));
      expect(enemyIds.has(t.topAttacker!.heroId)).toBe(true);
      expect(t.topAttacker!.pct).toBeGreaterThan(0);
      expect(t.topAttacker!.pct).toBeLessThanOrEqual(1);
      // É o maior dos inimigos no relatorio que o mapper montou da resposta da OpenDota.
      const maior = Math.max(...p.damageReport!.receivedTargets.filter((x) => enemyIds.has(x.heroId)).map((x) => x.amount));
      expect(t.topAttacker!.amount).toBe(maior);
    }
  });

  it('identifica a habilidade que mais machucou', () => {
    const t = buildThreatProfile(match.players[0], match, null)!;
    expect(t.topAbility).toMatchObject({ abilityId: 5004, count: 9, amount: 2600 });
    expect(t.topAbility!.pct).toBeCloseTo(2600 / 4700, 5);
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
    from = match,
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
      ...from,
      durationSeconds,
      players: from.players.map((p, i) => ({
        ...p,
        damageReport: {
          ...p.damageReport!,
          receivedTotal: { ...p.damageReport!.receivedTotal!, ...zero, ...perPlayer(i) },
        },
      })),
    } as typeof match;
  }

  it('a media do heroi NAO entra no denominador: controle igual na partida da razao 1', () => {
    // Regressao: o denominador era `heroAverage.stunDuration`, que mede o controle que o
    // heroi CAUSA. Na fixture antiga da STRATZ, Terrorblade dava 141x e Undying 68,6x. Aqui a
    // curva sintetica traz controle causado 0 — dividir por ela daria infinito.
    const m = withControl(() => ({ stunCount: 12, stunDuration: 1500 }), 30 * 60, withSyntheticHeroAverage(match));
    for (const p of m.players) {
      const t = buildThreatProfile(p, m, null)!;
      expect(t.controlRatio).toBeCloseTo(1, 5);
      expect(t.archetypes).not.toContain('HARD_LOCKDOWN');
    }
  });

  it('as razoes da partida tem media 1 — a referencia sao os dez jogadores', () => {
    const m = withControl((i) => ({ stunCount: 5 + i, stunDuration: 300 + 120 * i }));
    const ratios = m.players.map((p) => buildThreatProfile(p, m, null)!.controlRatio!);
    expect(ratios.reduce((s, r) => s + r, 0) / ratios.length).toBeCloseTo(1, 5);
  });

  it('slow acima da media com contagem alta vira SLOW_KITE', () => {
    // O caso que a fixture antiga trazia (um Undying), montado com os mesmos criterios.
    const m = withControl((i) => (i === 0 ? { slowCount: 60, slowDuration: 9000 } : { slowCount: 10, slowDuration: 1500 }), 30 * 60);
    const t = buildThreatProfile(m.players[0], m, null)!;
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
