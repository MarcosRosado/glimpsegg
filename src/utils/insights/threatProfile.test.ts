import { describe, it, expect } from 'vitest';
import { buildThreatProfile, MatchupRow } from './threatProfile';
import { mapStratzMatch } from '../../services/stratzGql';
import fixture from '../../services/__fixtures__/match-parsed.json';

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
