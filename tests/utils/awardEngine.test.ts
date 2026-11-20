import { describe, it, expect } from 'vitest';
import { computeMatchAwards, MatchAward } from '../../src/utils/awardEngine';
import { GLINT_THRESHOLDS } from '../../src/utils/glint';
import { MatchDetails, MatchPlayer } from '../../src/types/dota';
import { referenceMatch, unevenLaneMatch } from '../support/fixtureMatches';

/**
 * Partida de referencia: a resposta real da OpenDota pelo mapper real (tests/support/).
 * Ate 2026-11-19 era a fixture da STRATZ, com a nota na escala do IMP; o motor so conhece o
 * Glint desde que o `mapStratzMatch` saiu.
 */
const match = referenceMatch();

/** Partida sintetica de 10 jogadores, para controlar uma metrica por vez. */
function fakeMatch(overrides: Partial<MatchPlayer>[], didRadiantWin = true): MatchDetails {
  const players = overrides.map((o, i) => ({
    steamAccountId: String(i),
    name: `P${i}`,
    avatar: '',
    seasonRank: 60,
    isRadiant: i < 5,
    playerSlot: i < 5 ? i : 123 + i,
    heroId: i + 1,
    kills: 0,
    deaths: 0,
    assists: 0,
    numLastHits: 0,
    numDenies: 0,
    goldPerMinute: 0,
    experiencePerMinute: 0,
    networth: 0,
    heroDamage: 0,
    towerDamage: 0,
    heroHealing: 0,
    imp: 0,
    glint: null,
    role: 'POSITION_1' as const,
    lane: 'SAFE' as const,
    items: [],
    backpack: [],
    ...o,
  })) as MatchPlayer[];
  return {
    players,
    didRadiantWin,
    radiantScore: 0,
    direScore: 0,
    radiantNetworth: 0,
    direNetworth: 0,
  } as MatchDetails;
}

const byId = (list: MatchAward[], id: string) => list.find((a) => a.id === id);

describe('o motor nao produz texto nem CSS', () => {
  it('nenhum premio carrega titulo, subtitulo ou classe Tailwind', () => {
    const { awards, superlatives, positions } = computeMatchAwards(match);
    for (const a of [...awards, ...superlatives]) {
      // Os campos antigos traziam pt-BR cravado, entao a UI en-US mostrava portugues.
      expect((a as any).title).toBeUndefined();
      expect((a as any).subtitle).toBeUndefined();
      expect((a as any).badgeColor).toBeUndefined();
      expect((a as any).highlightStats).toBeUndefined();
      expect(typeof a.value).toBe('number');
    }
    expect(positions.length).toBeGreaterThan(0);
  });
});

describe('superlativo exige margem sobre o segundo colocado', () => {
  it('dez jogadores empatados nao geram superlativo nenhum', () => {
    // O bug antigo: `sortedByImp[0]` sempre coroava alguem, mesmo num empate de dez.
    const empate = fakeMatch(Array.from({ length: 10 }, () => ({ heroDamage: 50000, networth: 40000 })));
    const { superlatives } = computeMatchAwards(empate);
    expect(superlatives).toEqual([]);
  });

  it('lider por pouco tambem nao gera: 5% de vantagem em dano nao e destaque', () => {
    const quase = fakeMatch([{ heroDamage: 52500 }, ...Array.from({ length: 9 }, () => ({ heroDamage: 50000 }))]);
    expect(byId(computeMatchAwards(quase).superlatives, 'MOST_HERO_DAMAGE')).toBeUndefined();
  });

  it('lider folgado gera, e a margem medida vem junto', () => {
    const folga = fakeMatch([{ heroDamage: 100000 }, ...Array.from({ length: 9 }, () => ({ heroDamage: 50000 }))]);
    const a = byId(computeMatchAwards(folga).superlatives, 'MOST_HERO_DAMAGE');
    expect(a).toBeDefined();
    expect(a!.value).toBe(100000);
    expect(a!.marginPct).toBeCloseTo(100, 5);
    expect(a!.playerSlot).toBe(0);
  });

  it('piso absoluto: liderar com valor irrelevante nao premia', () => {
    // 300 de cura contra 0 é margem infinita e destaque nenhum.
    const migalha = fakeMatch([{ heroHealing: 300 }, ...Array.from({ length: 9 }, () => ({ heroHealing: 0 }))]);
    expect(byId(computeMatchAwards(migalha).superlatives, 'MOST_HEALING')).toBeUndefined();

    const real = fakeMatch([{ heroHealing: 9000 }, ...Array.from({ length: 9 }, () => ({ heroHealing: 0 }))]);
    expect(byId(computeMatchAwards(real).superlatives, 'MOST_HEALING')).toBeDefined();
  });

  it('vem ordenado pela margem: o mais dominante primeiro', () => {
    const m = fakeMatch([
      { heroDamage: 100000, assists: 30 },
      ...Array.from({ length: 9 }, () => ({ heroDamage: 50000, assists: 20 })),
    ]);
    const s = computeMatchAwards(m).superlatives;
    expect(s.length).toBeGreaterThan(1);
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1].marginPct!).toBeGreaterThanOrEqual(s[i].marginPct!);
    }
  });
});

describe('wards: undefined e [] sao coisas diferentes', () => {
  it('partida sem dado de visao nao gera premio de ward', () => {
    // `undefined` = a partida nao tem dado. Trata-lo como 0 foi o bug das wards falsas.
    const semVisao = fakeMatch(Array.from({ length: 10 }, () => ({ wardEvents: undefined })));
    expect(byId(computeMatchAwards(semVisao).superlatives, 'MOST_WARDS')).toBeUndefined();
  });

  it('com dado real, quem colocou mais leva', () => {
    const comVisao = fakeMatch([
      { wardEvents: Array.from({ length: 20 }, () => ({})) as any },
      ...Array.from({ length: 9 }, () => ({ wardEvents: [] as any })),
    ]);
    const a = byId(computeMatchAwards(comVisao).superlatives, 'MOST_WARDS');
    expect(a).toBeDefined();
    expect(a!.value).toBe(20);
  });
});

describe('MVP sai de fato medido, nao da nota', () => {
  // 45 é a mediana medida do Glint (`utils/glint.ts`): o "jogador comum" destes elencos.
  const base = Array.from({ length: 10 }, () => ({ glint: 45 }));

  it('REGRESSAO 8973449942: o MVP nao pode estar no time que perdeu', () => {
    // O caso real: carry do time vencedor com 21 abates, maior patrimonio e maior dano
    // levou IMP -10 da STRATZ, enquanto um suporte 2/6/20 do time DERROTADO levou +24.
    // Pelo criterio antigo (maior nota), o MVP era o suporte do time perdedor — e isso
    // acontecia em 19% das partidas da amostra de calibracao. Vale igual para o Glint, que
    // foi ajustado para imitar o IMP.
    const m = fakeMatch(
      [
        // Radiant (perdeu): suporte com nota alta e nada medido.
        { glint: 75 },
        ...base.slice(1, 5),
        // Dire (venceu): o carry que decidiu o jogo, com nota baixa.
        { glint: 40, kills: 21, networth: 40000, heroDamage: 90000, towerDamage: 20000 },
        ...base.slice(6),
      ],
      false,
    );
    const mvp = byId(computeMatchAwards(m).awards, 'MVP');
    expect(mvp).toBeDefined();
    expect(mvp!.playerSlot).toBe(128); // o carry do Dire (indice 5 do elenco sintetico)
    // `basis` diz EM QUE ele liderou. Sem isso o cartao mostraria "Glint 40" (o numero
    // que justamente nao foi o criterio) ou "1 superlativo" — que tambem nao informa
    // nada. Com basis, a linha vira "Carrasco • Bolso cheio": as categorias lideradas.
    expect(mvp!.basis).toBeDefined();
    expect(mvp!.basis).toContain('MOST_KILLS');
    expect(mvp!.basis!.length).toBeGreaterThan(0);
  });

  it('sem liderar nada, o premio nao tem basis e o cartao mostra a nota', () => {
    const m = fakeMatch([{ glint: 70 }, { glint: 60 }, ...base.slice(2)]);
    const mvp = byId(computeMatchAwards(m).awards, 'MVP');
    expect(mvp!.basis).toBeUndefined();
    expect(mvp!.unit).toBe('GLINT');
  });

  it('mais superlativos ganha de nota maior dentro do time vencedor', () => {
    const m = fakeMatch([
      { glint: 80 },
      { glint: 46, kills: 25, networth: 45000, heroDamage: 95000 },
      ...base.slice(2),
    ]);
    const mvp = byId(computeMatchAwards(m).awards, 'MVP');
    expect(mvp!.playerSlot).toBe(1);
  });

  it('sem ninguem medido, o criterio passa a ser a nota', () => {
    const folgado = fakeMatch([{ glint: 70 }, { glint: 60 }, ...base.slice(2)]);
    const mvp = byId(computeMatchAwards(folgado).awards, 'MVP');
    expect(mvp).toBeDefined();
    expect(mvp!.unit).toBe('GLINT');
    expect(mvp!.value).toBe(70);
    expect(mvp!.basis).toBeUndefined();
  });

  it('MVP, melhor core e melhor suporte sao slots FIXOS do card', () => {
    // Sao os tres unicos premios sem exigencia de margem: toda partida tem cores e
    // suportes, e "o core de maior nota desta partida" e fato mesmo num placar apertado.
    // A nota fica ao lado, entao quem le percebe sozinho quando a diferenca foi minima.
    const apertado = fakeMatch(
      Array.from({ length: 10 }, (_, i) => ({
        glint: i === 0 ? 52 : 51,
        role: (i < 3 || (i >= 5 && i < 8) ? 'POSITION_1' : 'POSITION_5') as any,
      })),
    );
    const { awards } = computeMatchAwards(apertado);
    for (const id of ['MVP', 'TOP_CORE', 'TOP_SUPPORT']) {
      expect(byId(awards, id), `faltou ${id}`).toBeDefined();
    }
    // E continuam sendo tres jogadores distintos.
    const slots = awards.map((a) => a.playerSlot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('nota baixa em todo mundo ainda produz os tres premios', () => {
    const m = fakeMatch(
      Array.from({ length: 10 }, (_, i) => ({
        glint: 10 + i,
        role: (i % 2 === 0 ? 'POSITION_2' : 'POSITION_4') as any,
      })),
    );
    const { awards } = computeMatchAwards(m);
    expect(byId(awards, 'MVP')).toBeDefined();
    expect(byId(awards, 'TOP_CORE')).toBeDefined();
    expect(byId(awards, 'TOP_SUPPORT')).toBeDefined();
  });

  it('quem liderou uma metrica nao leva Dia Dificil, por pior que seja a nota', () => {
    const m = fakeMatch([
      ...base.slice(0, 9).map(() => ({ glint: 50 })),
      { glint: 5, kills: 25, networth: 45000, heroDamage: 95000, towerDamage: 20000 },
    ]);
    expect(byId(computeMatchAwards(m).awards, 'ROUGH_GAME')).toBeUndefined();
  });

  it('Dia Dificil NAO virou slot fixo: continua exigindo margem', () => {
    // Abaixo do teto (41), mas so 2 pontos atras do penultimo: a folga é 4.
    const m = fakeMatch([...base.slice(0, 9).map(() => ({ glint: 32 })), { glint: 30 }]);
    expect(byId(computeMatchAwards(m).awards, 'ROUGH_GAME')).toBeUndefined();
  });

  it('destoar do penultimo é', () => {
    const m = fakeMatch([...base.slice(0, 9).map(() => ({ glint: 50 })), { glint: 20 }]);
    const rg = byId(computeMatchAwards(m).awards, 'ROUGH_GAME');
    expect(rg).toBeDefined();
    expect(rg!.value).toBe(20);
  });

  it('o mesmo jogador nao aparece duas vezes no bloco de papeis', () => {
    for (const m of [match, unevenLaneMatch()]) {
      const slots = computeMatchAwards(m).awards.map((a) => a.playerSlot);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });
});

describe('Dia Dificil numa partida real', () => {
  it('dispara na fixture escolhida para isso, pelo criterio declarado', () => {
    const m = unevenLaneMatch();
    const { awards, superlatives } = computeMatchAwards(m);
    const rg = byId(awards, 'ROUGH_GAME');
    expect(rg).toBeDefined();
    const notas = m.players.map((p) => p.glint).filter((g): g is number => typeof g === 'number').sort((a, b) => a - b);
    expect(rg!.value).toBe(notas[0]);
    expect(rg!.value).toBeLessThanOrEqual(GLINT_THRESHOLDS.poor);
    expect(notas[1] - notas[0]).toBeGreaterThanOrEqual(4);
    expect(superlatives.some((a) => a.playerSlot === rg!.playerSlot)).toBe(false);
  });
});

describe('melhor de cada posicao', () => {
  it('sai uma entrada por posicao presente, sem repetir posicao', () => {
    const { positions } = computeMatchAwards(match);
    const ps = positions.map((p) => p.position);
    expect(new Set(ps).size).toBe(ps.length);
    expect(ps).toEqual([...ps].sort());
  });

  it('estatistica ausente vira null em vez de zero', () => {
    // Pos 5 mostra wards; sem dado de visao a celula tem de sumir, nao zerar.
    const semVisao = fakeMatch(
      Array.from({ length: 10 }, (_, i) => ({
        role: 'POSITION_5' as const,
        glint: i,
        wardEvents: undefined,
      })),
    );
    const p5 = computeMatchAwards(semVisao).positions.find((p) => p.position === 'POSITION_5');
    expect(p5).toBeDefined();
    expect(p5!.stat).toBeNull();
  });
});

describe('agregados continuam intactos', () => {
  it('wardsMeasured segue a availability, e nao inventa 4 vs 3', () => {
    const { aggregates } = computeMatchAwards(match);
    expect(aggregates.wardsMeasured).toBe(match.availability.wards);
    expect(aggregates.radiantKills).toBeGreaterThan(0);
  });

  it('partida sem jogadores devolve as tres listas vazias', () => {
    const vazia = computeMatchAwards({ players: [] } as any);
    expect(vazia.awards).toEqual([]);
    expect(vazia.superlatives).toEqual([]);
    expect(vazia.positions).toEqual([]);
  });
});

describe('sem campo de nota nao existe escala implicita', () => {
  it('jogadores sem `glint` (nem null) nao caem numa escala com nota zero', () => {
    // Antes da etapa 2, jogador sem o campo `glint` fazia o motor escolher a escala do IMP
    // com `imp: 0` em todos — e o primeiro da lista virava melhor core. Hoje é "sem nota".
    const semCampo = fakeMatch(
      Array.from({ length: 10 }, (_, i) => ({ glint: undefined, role: (i % 2 ? 'POSITION_4' : 'POSITION_1') as any })),
    );
    const res = computeMatchAwards(semCampo);
    expect(res.scoreKind).toBeNull();
    expect(res.awards.some((a) => a.id === 'TOP_CORE' || a.id === 'TOP_SUPPORT' || a.id === 'ROUGH_GAME')).toBe(false);
    expect(res.positions).toEqual([]);
  });
});

/**
 * O caminho que o app usa desde 2026-11-19: partida da OpenDota, nota = Glint experimental,
 * sobre a fixture real `match-parsed-opendota.json`.
 */
describe('computeMatchAwards — partida da OpenDota (Glint)', () => {
  const od = match;

  it('a escala é GLINT, e todo premio de papel sai nela ou sem numero', () => {
    const res = computeMatchAwards(od);
    expect(res.scoreKind).toBe('GLINT');
    for (const a of res.awards) expect(['GLINT', 'NONE']).toContain(a.unit);
    for (const ph of res.positions) {
      const naPosicao = od.players.filter((p) => p.position === ph.position);
      expect(ph.score).toBe(Math.max(...naPosicao.map((p) => p.glint as number)));
    }
  });

  it('melhor core e melhor suporte sao o maior Glint do grupo, fora o MVP', () => {
    const { awards } = computeMatchAwards(od);
    const mvp = awards.find((a) => a.id === 'MVP');
    for (const [id, positions] of [
      ['TOP_CORE', ['POSITION_1', 'POSITION_2', 'POSITION_3']],
      ['TOP_SUPPORT', ['POSITION_4', 'POSITION_5']],
    ] as const) {
      const award = awards.find((a) => a.id === id)!;
      const group = od.players.filter((p) => (positions as readonly string[]).includes(p.position!) && p.playerSlot !== mvp?.playerSlot);
      expect(award.value).toBe(Math.max(...group.map((p) => p.glint as number)));
    }
  });

  it('sem nota nenhuma, premio que depende de nota é omitido — ninguem é coroado por ordem de lista', () => {
    const semNota: typeof od = {
      ...od,
      players: od.players.map((p) => ({ ...p, glint: null })),
      availability: { ...od.availability, glint: false },
    };
    const res = computeMatchAwards(semNota);
    expect(res.scoreKind).toBeNull();
    expect(res.awards.some((a) => a.id === 'TOP_CORE' || a.id === 'TOP_SUPPORT' || a.id === 'ROUGH_GAME')).toBe(false);
    expect(res.positions).toEqual([]);
    // O MVP nunca dependeu da nota como criterio principal: se existe, veio de superlativo.
    const mvp = res.awards.find((a) => a.id === 'MVP');
    if (mvp) {
      expect(mvp.unit).toBe('NONE');
      expect(mvp.basis!.length).toBeGreaterThan(0);
    }
    // Os superlativos nao mudam com a nota.
    expect(res.superlatives.map((a) => a.id)).toEqual(computeMatchAwards(od).superlatives.map((a) => a.id));
  });
});
