import { describe, expect, it } from 'vitest';
import fixture from '../../../src/services/__fixtures__/opendota-herostats.json';
import type { MetaWinrate, MetaSource } from '../../../src/types/heroGrid';
import type { RankBracketBasic } from '../../../src/utils/rankBracket';
import {
  SEGMENTED_BRACKETS,
  classifyOutcome,
  openDotaSourceInput,
  configuredProfileTier,
  resolveMetaBracket,
  resolveMetaWinrates,
  sourceAvailable,
  type MetaSampleRow,
  type MetaSourceInput,
  type MetaSourceStatus,
} from '../../../src/utils/heroGrid/sourcePrecedence';

/**
 * Testes da resolucao das fontes de meta (T050, T051, T057, T061 de
 * specs/001-meta-hero-grid).
 *
 * A meta tem UMA fonte desde 2026-11-19: a STRATZ saiu do app, e o slot dela foi removido
 * da resolucao em vez de ficar falhando (com dois slots e um sempre fora, toda
 * sincronizacao sairia `PARTIAL`). O que este arquivo trava agora é a consequencia disso:
 * OpenDota de pé ⇒ `SUCCESS` pleno, sem "fonte faltando"; OpenDota fora ⇒ `FAILURE`, nada
 * é publicado.
 *
 * O modulo é PURO: recebe as linhas ja buscadas e devolve a resolucao. Por isso as
 * entradas aqui sao montadas a mao — nada de rede, nada de mock de transporte. A unica
 * excecao é o bloco de realismo no fim, que LÊ a resposta real da OpenDota de
 * `__fixtures__/opendota-herostats.json` e soma os buckets aqui mesmo, sem passar pelo
 * mapper de `services/heroGrid/openDotaWinrates.ts` — o objetivo é exercitar a resolucao
 * com amostra real, nao acoplar este teste ao mapper de outro modulo.
 */

const PATCH = '7.39c';

/** Linha minima e valida. Cada teste distorce só o campo que quer provar. */
function row(heroId: number, matchCount = 1000, wins = 520): MetaSampleRow {
  return { heroId, matchCount, wins };
}

function ok(rows: MetaSampleRow[]): MetaSourceInput {
  return { status: 'OK', rows };
}

const EMPTY: MetaSourceInput = { status: 'EMPTY', rows: [] };
const FAILED: MetaSourceInput = { status: 'ERROR', rows: [], reason: 'timeout' };

/** Atalho: resolucao com bracket especifico do jogador, para nao repetir o setup. */
function resolve(openDota: MetaSourceInput) {
  return resolveMetaWinrates({
    openDota,
    patch: PATCH,
    profileTier: 7, // Divine -> bracket segmentado pela fonte
  });
}

function sourceOf(result: { byHeroId: Map<number, MetaWinrate> }, heroId: number): MetaSource | undefined {
  return result.byHeroId.get(heroId)?.source;
}

/* ------------------------------------------------------------------ *
 * T050 — a fonte que sustenta a linha sai rotulada
 * ------------------------------------------------------------------ */

describe('linhas da OpenDota, com a fonte rotulada (T050)', () => {
  it('publica valor e amostra da OpenDota, rotulados como OPENDOTA_BRACKET', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 1000, wins: 550 }]));

    const linha = result.byHeroId.get(1);
    expect(linha).toBeDefined();
    expect(linha?.source).toBe('OPENDOTA_BRACKET');
    expect(linha?.matchCount).toBe(1000);
    expect(linha?.wins).toBe(550);
    expect(linha?.winRate).toBeCloseTo(0.55, 10);
    expect(result.winrates).toHaveLength(1);
  });

  it('nenhuma linha sai rotulada como STRATZ: a fonte nao existe mais na resolucao', () => {
    const result = resolve(ok([row(1), row(2), row(3)]));

    expect(new Set(result.winrates.map((w) => w.source))).toEqual(
      new Set<MetaSource>(['OPENDOTA_BRACKET']),
    );
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
  });

  it('um slot `stratz` sobrando na entrada é ignorado, nao vira linha nem fonte', () => {
    // Chamador desatualizado que ainda mande o envelope da STRATZ: a resolucao nao pode
    // publicar aquelas linhas, nem contar a fonte como usada ou faltando.
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      profileTier: 7,
      ...({ stratz: ok([row(2)]) } as object),
    });

    expect(result.byHeroId.has(2)).toBe(false);
    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesMissing).toEqual([]);
  });

  it('a fonte rotulada é a do slot de entrada, nunca a que a linha declara sobre si', () => {
    // Linha que chega pelo slot da OpenDota se autodeclarando STRATZ (resto de cache de
    // versao anterior). Confiar no campo da entrada deixaria a procedencia mentir; a fonte
    // é o slot por onde a linha chegou.
    const mentirosa = { ...row(9), source: 'STRATZ_BRACKET' as MetaSource };
    const result = resolve(ok([mentirosa]));

    expect(sourceOf(result, 9)).toBe('OPENDOTA_BRACKET');
  });

  it('heroId repetido na mesma fonte: a primeira linha fica', () => {
    const result = resolve(ok([row(1, 1000, 550), row(1, 9_000_000, 1_800_000)]));

    expect(result.winrates).toHaveLength(1);
    expect(result.byHeroId.get(1)?.matchCount).toBe(1000);
  });

  it('fonte que nao respondeu nao contribui linha, mesmo que o envelope traga resto de payload', () => {
    const result = resolve({ status: 'ERROR', rows: [row(1)], reason: 'HTTP 500' });

    expect(result.byHeroId.has(1)).toBe(false);
    expect(result.winrates).toHaveLength(0);
  });

  it('recalcula o winRate a partir de wins/matchCount em vez de aceitar o declarado', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 10, wins: 5, winRate: 0.99 }]));

    expect(result.byHeroId.get(1)?.winRate).toBeCloseTo(0.5, 10);
  });
});

/* ------------------------------------------------------------------ *
 * T051 — I-11, I-12, I-14
 * ------------------------------------------------------------------ */

describe('invariantes de procedencia (T051)', () => {
  it('I-11: todo MetaWinrate do resultado tem matchCount definido e maior que zero', () => {
    const result = resolve(
      ok([
        row(1),
        { heroId: 2, matchCount: 0, wins: 0 },
        { heroId: 3, matchCount: null, wins: 4 },
        row(4),
        { heroId: 5, matchCount: undefined, wins: 1 },
      ]),
    );

    expect(result.winrates.map((w) => w.heroId)).toEqual([1, 4]);
    for (const w of result.winrates) {
      expect(typeof w.matchCount).toBe('number');
      expect(w.matchCount).toBeGreaterThan(0);
    }
  });

  it('I-11: linha com matchCount 0 é descartada, nao publicada como winrate sem amostra', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 0, wins: 0 }]));

    expect(result.byHeroId.has(2)).toBe(false);
    expect(result.winrates).toHaveLength(0);
    expect(result.discarded).toBeGreaterThan(0);
  });

  it('I-11: linha sem `wins` é descartada em vez de completada com zero', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 500 }]));

    expect(result.byHeroId.has(2)).toBe(false);
  });

  it('I-11: linha com wins maior que matchCount é descartada, nao truncada', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 100, wins: 140 }]));

    expect(result.byHeroId.has(2)).toBe(false);
  });

  it('I-12: nenhum MetaWinrate é construido sem `source` e sem `patch`', () => {
    const result = resolve(ok([row(1), row(2)]));

    expect(result.winrates).toHaveLength(2);
    for (const w of result.winrates) {
      expect(w.source).toBe('OPENDOTA_BRACKET');
      expect(typeof w.patch).toBe('string');
      expect(w.patch.length).toBeGreaterThan(0);
    }
  });

  it('I-12: preserva o patch da propria linha em vez de reetiquetar com o patch da resolucao', () => {
    const result = resolveMetaWinrates({
      openDota: ok([{ ...row(1), patch: '7.38b' }, row(2)]),
      patch: PATCH,
      profileTier: 7,
    });

    expect(result.byHeroId.get(1)?.patch).toBe('7.38b');
    expect(result.byHeroId.get(2)?.patch).toBe(PATCH);
  });

  it('I-12: sem patch na linha e sem patch na resolucao, a linha é descartada', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: '',
      profileTier: 7,
    });

    expect(result.winrates).toHaveLength(0);
    expect(result.discarded).toBeGreaterThan(0);
  });

  it('I-14: heroi que a fonte nao devolveu ganha ausencia — nao aparece no resultado', () => {
    const result = resolve(ok([row(1), row(2)]));

    expect(result.byHeroId.has(3)).toBe(false);
    expect(result.winrates.some((w) => w.heroId === 3)).toBe(false);
  });

  it('I-14: heroi sem amostra NAO aparece com winRate 0 e matchCount 0', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 0, wins: 0 }]));

    expect(result.winrates).toHaveLength(0);
    expect(result.winrates.some((w) => w.matchCount === 0)).toBe(false);
    expect(result.winrates.some((w) => w.winRate === 0)).toBe(false);
  });

  it('I-14: heroId invalido nao viaja como linha zerada', () => {
    const result = resolve(ok([{ heroId: 0, matchCount: 10, wins: 5 }, { heroId: -3, matchCount: 10, wins: 5 }]));

    expect(result.winrates).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * T051 / T057 — I-24: degradacao com uma fonte só
 * ------------------------------------------------------------------ */

describe('classificacao do desfecho (T051 — I-24)', () => {
  it('I-24: a OpenDota respondeu ⇒ SUCCESS pleno e escreve, sem fonte faltando', () => {
    const result = resolve(ok([row(1)]));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesMissing).toEqual([]);
    expect(result.unavailable).toEqual([]);
  });

  it('a regressao que a remocao do slot evita: OpenDota de pé NUNCA sai PARTIAL', () => {
    // Com o slot da STRATZ presente e sempre fora, este caso saia `PARTIAL` com
    // `sourcesMissing: ['STRATZ_BRACKET']` em toda sincronizacao.
    for (const entrada of [ok([row(1)]), EMPTY, ok([{ heroId: 1, matchCount: 0, wins: 0 }])]) {
      const result = resolve(entrada);
      expect(result.outcome).toBe('SUCCESS');
      expect(result.sourcesMissing).not.toContain('STRATZ_BRACKET');
      expect(result.sourcesFailed).not.toContain('STRATZ_BRACKET');
    }
  });

  it('I-24: a OpenDota fora ⇒ FAILURE que NAO escreve, com rotulo de qual faltou', () => {
    const result = resolve(FAILED);

    expect(result.outcome).toBe('FAILURE');
    expect(result.shouldWrite).toBe(false);
    expect(result.sourcesUsed).toEqual([]);
    expect(result.sourcesFailed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesMissing).toEqual(['OPENDOTA_BRACKET']);
    expect(result.unavailable).toEqual([
      { source: 'OPENDOTA_BRACKET', reason: 'ERROR', message: 'timeout' },
    ]);
    expect(result.winrates).toHaveLength(0);
    expect(result.byHeroId.size).toBe(0);
  });

  it('envelope ausente conta como fonte fora, nao como fonte vazia', () => {
    const result = resolveMetaWinrates({
      openDota: undefined as unknown as MetaSourceInput,
      patch: PATCH,
      profileTier: 7,
    });

    expect(result.outcome).toBe('FAILURE');
    expect(result.shouldWrite).toBe(false);
  });

  it('"respondeu sem dados" nao é "nao respondeu": EMPTY nao falha nem é usada', () => {
    const result = resolve(EMPTY);

    expect(result.outcome).toBe('SUCCESS');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesMissing).toEqual([]);
    expect(result.sourcesUsed).toEqual([]);
    expect(result.winrates).toHaveLength(0);
  });

  it('OK sem nenhuma linha aproveitavel degrada para EMPTY, nao para ERROR', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 0, wins: 0 }]));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesUsed).toEqual([]);
    expect(result.sourcesFailed).toEqual([]);
  });

  it('sourceAvailable: respondeu (OK/EMPTY) é disponivel; erro nao é', () => {
    expect(sourceAvailable('OK')).toBe(true);
    expect(sourceAvailable('EMPTY')).toBe(true);
    expect(sourceAvailable('ERROR')).toBe(false);
  });

  it('classifyOutcome concorda com a tabela de degradacao do contrato', () => {
    const casos: [MetaSourceStatus, string, boolean][] = [
      ['OK', 'SUCCESS', true],
      ['EMPTY', 'SUCCESS', true],
      ['ERROR', 'FAILURE', false],
    ];

    for (const [openDota, outcome, shouldWrite] of casos) {
      const c = classifyOutcome({ openDota });
      expect({ openDota, outcome: c.outcome, shouldWrite: c.shouldWrite }).toEqual({
        openDota,
        outcome,
        shouldWrite,
      });
    }
  });

  it('openDotaSourceInput traduz a convencao `MetaWinrate[] | null` da OpenDota', () => {
    // `null` => nao respondeu; `[]` => respondeu sem dado no bracket.
    expect(openDotaSourceInput(null).status).toBe('ERROR');
    expect(openDotaSourceInput([]).status).toBe('EMPTY');
    expect(openDotaSourceInput([row(1) as unknown as MetaWinrate]).status).toBe('OK');
  });

  it('ponta a ponta do adaptador: `null` da OpenDota ⇒ FAILURE, linhas ⇒ SUCCESS', () => {
    const fora = resolveMetaWinrates({ openDota: openDotaSourceInput(null), patch: PATCH });
    expect(fora.outcome).toBe('FAILURE');
    expect(fora.shouldWrite).toBe(false);

    const dentro = resolveMetaWinrates({
      openDota: openDotaSourceInput([row(1)]),
      patch: PATCH,
    });
    expect(dentro.outcome).toBe('SUCCESS');
    expect(dentro.shouldWrite).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * T061 — FR-020 e I-13
 * ------------------------------------------------------------------ */

describe('ranque de referencia e honestidade do rotulo (T061 — FR-020, I-13)', () => {
  it('bracket especifico do jogador ⇒ bracketIsPlayerSpecific true', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      profileTier: 5, // Legend
    });

    expect(result.bracket).toEqual({ bracket: 'LEGEND_ANCIENT', isPlayerSpecific: true });
    expect(result.byHeroId.get(1)?.bracket).toBe('LEGEND_ANCIENT');
    expect(result.byHeroId.get(1)?.bracketIsPlayerSpecific).toBe(true);
  });

  it('preferencia explicita do jogador vence o ranque do perfil', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      preferredBracket: 'HERALD_GUARDIAN',
      profileTier: 7,
    });

    expect(result.bracket.bracket).toBe('HERALD_GUARDIAN');
    expect(result.bracket.isPlayerSpecific).toBe(true);
  });

  it('FR-020: ranque de referencia que a fonte nao segmenta ⇒ ALL com bracketIsPlayerSpecific false', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      preferredBracket: 'UNCALIBRATED', // fora de SEGMENTED_BRACKETS
      profileTier: 7,
    });

    expect(SEGMENTED_BRACKETS).not.toContain('UNCALIBRATED');
    expect(result.bracket.bracket).toBe('ALL');
    expect(result.bracket.isPlayerSpecific).toBe(false);
    for (const w of result.winrates) {
      expect(w.bracket).toBe('ALL');
      expect(w.bracketIsPlayerSpecific).toBe(false);
    }
  });

  it('FR-020: fonte com segmentacao restrita derruba o bracket pedido para ALL, rotulado', () => {
    // Uma fonte que só publica a media geral: pedir Divine nao pode virar "no seu ranque".
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      profileTier: 8,
      supportedBrackets: ['ALL'],
    });

    expect(result.bracket).toEqual({ bracket: 'ALL', isPlayerSpecific: false });
    expect(result.byHeroId.get(1)?.bracketIsPlayerSpecific).toBe(false);
  });

  it('perfil sem ranque ⇒ ALL com flag false (media geral, nunca "no seu ranque")', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
    });

    expect(result.bracket).toEqual({ bracket: 'ALL', isPlayerSpecific: false });
  });

  it('preferencia explicita por ALL ⇒ flag false, mesmo com ranque de perfil conhecido', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      patch: PATCH,
      preferredBracket: 'ALL',
      profileTier: 7,
    });

    expect(result.bracket).toEqual({ bracket: 'ALL', isPlayerSpecific: false });
  });

  it('reestampa o bracket resolvido na linha, mesmo quando a entrada dizia outro', () => {
    const mentirosa = {
      ...row(1),
      bracket: 'DIVINE_IMMORTAL' as RankBracketBasic,
      bracketIsPlayerSpecific: true,
    };
    const result = resolveMetaWinrates({
      openDota: ok([mentirosa]),
      patch: PATCH,
      preferredBracket: 'ALL',
    });

    expect(result.byHeroId.get(1)?.bracket).toBe('ALL');
    expect(result.byHeroId.get(1)?.bracketIsPlayerSpecific).toBe(false);
  });

  it('I-13: bracket resolvido ALL ⇒ flag false, em TODO caminho de entrada', () => {
    const preferidos: (RankBracketBasic | null | undefined)[] = [
      undefined,
      null,
      'ALL',
      'UNCALIBRATED',
      'HERALD_GUARDIAN',
      'CRUSADER_ARCHON',
      'LEGEND_ANCIENT',
      'DIVINE_IMMORTAL',
    ];
    const tiers = [undefined, null, -1, 0, 1, 3, 5, 7, 8, Number.NaN];
    const suportes: (readonly RankBracketBasic[] | undefined)[] = [
      undefined,
      SEGMENTED_BRACKETS,
      ['ALL'],
      ['ALL', 'DIVINE_IMMORTAL'],
    ];

    let viuAll = false;
    let viuEspecifico = false;

    for (const preferredBracket of preferidos) {
      for (const profileTier of tiers) {
        for (const supportedBrackets of suportes) {
          const resolvido = resolveMetaBracket({ preferredBracket, profileTier, supportedBrackets });

          if (resolvido.bracket === 'ALL') {
            expect(resolvido.isPlayerSpecific).toBe(false);
            viuAll = true;
          } else {
            viuEspecifico = true;
          }

          const result = resolveMetaWinrates({
            openDota: ok([row(1)]),
            patch: PATCH,
            preferredBracket,
            profileTier,
            supportedBrackets,
          });

          expect(result.bracket).toEqual(resolvido);
          for (const w of result.winrates) {
            expect(w.bracket).toBe(resolvido.bracket);
            if (w.bracket === 'ALL') expect(w.bracketIsPlayerSpecific).toBe(false);
            else expect(w.bracketIsPlayerSpecific).toBe(resolvido.isPlayerSpecific);
          }
        }
      }
    }

    // Guarda contra um modulo que devolvesse 'ALL' sempre e passasse a asercao acima de graca.
    expect(viuAll).toBe(true);
    expect(viuEspecifico).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Tier da conta configurada (o bug do perfil visualizado)
 * ------------------------------------------------------------------ */

describe('tier da conta configurada', () => {
  const MEU = '76561198000000001';
  const OUTRO = '76561198000000002';

  it('devolve o tier quando o perfil carregado É a conta configurada', () => {
    // 54 = Ancestral 4 -> tier 5.
    expect(
      configuredProfileTier({ profileSteamId: MEU, configuredSteamId: MEU, seasonRank: 54 }),
    ).toBe(5);
  });

  it('devolve null quando o perfil carregado é de OUTRA conta', () => {
    // O bug: o espelho da conta configurada era ordenado pela medalha do jogador visitado.
    expect(
      configuredProfileTier({ profileSteamId: OUTRO, configuredSteamId: MEU, seasonRank: 80 }),
    ).toBeNull();
  });

  it('nao trata dois ids ausentes como iguais', () => {
    for (const par of [
      { profileSteamId: '', configuredSteamId: '' },
      { profileSteamId: null, configuredSteamId: null },
      { profileSteamId: MEU, configuredSteamId: '' },
      { profileSteamId: '', configuredSteamId: MEU },
      { profileSteamId: undefined, configuredSteamId: undefined },
    ]) {
      expect(configuredProfileTier({ ...par, seasonRank: 54 })).toBeNull();
    }
  });

  it('ignora espaco em volta do id', () => {
    expect(
      configuredProfileTier({
        profileSteamId: `  ${MEU} `,
        configuredSteamId: MEU,
        seasonRank: 54,
      }),
    ).toBe(5);
  });

  it('seasonRank ausente ou nao positivo nao vira tier', () => {
    for (const seasonRank of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(
        configuredProfileTier({ profileSteamId: MEU, configuredSteamId: MEU, seasonRank }),
      ).toBeNull();
    }
  });

  it('o null resultante degrada para media geral, nunca para "no seu ranque"', () => {
    // A ponta do contrato: o que a funcao devolve alimenta `resolveMetaBracket`, e o
    // caminho de outra conta TEM de terminar em `isPlayerSpecific: false`.
    const tier = configuredProfileTier({
      profileSteamId: OUTRO,
      configuredSteamId: MEU,
      seasonRank: 80,
    });
    expect(resolveMetaBracket({ preferredBracket: null, profileTier: tier })).toEqual({
      bracket: 'ALL',
      isPlayerSpecific: false,
    });
  });

  it('a preferencia explicita do jogador continua vencendo o tier ausente', () => {
    // Quem escolheu o ranque a mao nao perde a escolha por estar vendo outro perfil.
    const tier = configuredProfileTier({
      profileSteamId: OUTRO,
      configuredSteamId: MEU,
      seasonRank: 80,
    });
    expect(
      resolveMetaBracket({ preferredBracket: 'LEGEND_ANCIENT', profileTier: tier }),
    ).toEqual({ bracket: 'LEGEND_ANCIENT', isPlayerSpecific: true });
  });
});

/* ------------------------------------------------------------------ *
 * Realismo: amostra real da OpenDota, convertida aqui mesmo
 * ------------------------------------------------------------------ */

describe('resolucao com a amostra real da OpenDota', () => {
  const crus = (fixture as any).heroStats as any[];

  /** Linhas cruas de `/api/heroStats` -> a entrada deste modulo. Sem usar o mapper. */
  const soma = (buckets: number[]): MetaSampleRow[] =>
    crus.map((r) => ({
      heroId: r.id,
      matchCount: buckets.reduce((n, b) => n + r[`${b}_pick`], 0),
      wins: buckets.reduce((n, b) => n + r[`${b}_win`], 0),
    }));

  const lendaAncestral = soma([5, 6]);

  it('a fixture real tem 10 herois com amostra utilizavel em Lenda/Ancestral', () => {
    expect(lendaAncestral).toHaveLength(10);
    for (const r of lendaAncestral) expect(r.matchCount as number).toBeGreaterThan(0);
  });

  it('toda linha real sai publicada com a amostra crua e a fonte OpenDota', () => {
    const result = resolveMetaWinrates({
      openDota: ok(lendaAncestral),
      patch: PATCH,
      profileTier: 5,
    });

    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesMissing).toEqual([]);
    expect(result.discarded).toBe(0);
    expect(result.winrates).toHaveLength(10);

    for (const w of result.winrates) {
      const cru = lendaAncestral.find((r) => r.heroId === w.heroId);
      expect(w.source).toBe('OPENDOTA_BRACKET');
      expect(w.matchCount).toBe(cru?.matchCount);
      expect(w.wins).toBe(cru?.wins);
      expect(w.winRate).toBeCloseTo((cru?.wins as number) / (cru?.matchCount as number), 12);
      expect(w.bracket).toBe('LEGEND_ANCIENT');
      expect(w.bracketIsPlayerSpecific).toBe(true);
    }
  });

  it('bucket real zerado é fonte que respondeu sem dados, nao fonte que falhou', () => {
    // Medido na captura: o bucket 8 (Imortal) veio 0 para TODOS os herois. Sozinho, ele
    // nao sustenta linha nenhuma — e isso é `EMPTY`, com `SUCCESS`, nao `FAILURE`.
    const imortal = soma([8]);
    for (const r of imortal) expect(r.matchCount).toBe(0);

    const result = resolveMetaWinrates({
      openDota: ok(imortal),
      patch: PATCH,
      profileTier: 8,
    });

    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesUsed).toEqual([]);
    expect(result.winrates).toHaveLength(0);
    expect(result.discarded).toBe(10);
  });
});
