import { describe, expect, it } from 'vitest';
import fixture from '../../services/__fixtures__/hero-winrates.json';
import type { MetaWinrate, MetaSource } from '../../types/heroGrid';
import type { RankBracketBasic } from '../rankBracket';
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
} from './sourcePrecedence';

/**
 * Testes da resolucao de precedencia entre as duas fontes de meta
 * (T050, T051, T057, T061 de specs/001-meta-hero-grid).
 *
 * O modulo é PURO: recebe as listas ja buscadas e devolve a resolucao. Por isso as
 * entradas aqui sao montadas a mao — nada de rede, nada de mock de transporte. A unica
 * excecao é o bloco de realismo no fim, que LÊ a resposta real da STRATZ de
 * `__fixtures__/hero-winrates.json` e converte as linhas cruas aqui mesmo, sem passar
 * pelo mapper de `services/heroGrid/stratzWinrates.ts` — o objetivo é exercitar a
 * precedencia com amostra real, nao acoplar este teste ao mapper de outro modulo.
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
const NO_TOKEN: MetaSourceInput = { status: 'NO_TOKEN', rows: [] };

/** Atalho: resolucao com bracket especifico do jogador, para nao repetir o setup. */
function resolve(openDota: MetaSourceInput, stratz: MetaSourceInput) {
  return resolveMetaWinrates({
    openDota,
    stratz,
    patch: PATCH,
    profileTier: 7, // Divine -> bracket segmentado pelas duas fontes
  });
}

function sourceOf(result: { byHeroId: Map<number, MetaWinrate> }, heroId: number): MetaSource | undefined {
  return result.byHeroId.get(heroId)?.source;
}

/* ------------------------------------------------------------------ *
 * T050 — precedencia OpenDota -> STRATZ, com a fonte vencedora rotulada
 * ------------------------------------------------------------------ */

describe('precedencia OpenDota -> STRATZ (T050)', () => {
  it('a OpenDota vence quando as duas fontes tem dado para o mesmo heroi', () => {
    const result = resolve(
      ok([{ heroId: 1, matchCount: 1000, wins: 550 }]),
      ok([{ heroId: 1, matchCount: 9_000_000, wins: 1_800_000 }]),
    );

    const linha = result.byHeroId.get(1);
    expect(linha).toBeDefined();
    // Valor e amostra sao os da OpenDota, apesar da amostra da STRATZ ser muito maior:
    // a precedencia é fixa (FR-015), nao escolhida pelo tamanho da amostra.
    expect(linha?.source).toBe('OPENDOTA_BRACKET');
    expect(linha?.matchCount).toBe(1000);
    expect(linha?.wins).toBe(550);
    expect(linha?.winRate).toBeCloseTo(0.55, 10);
    expect(result.winrates).toHaveLength(1);
  });

  it('a STRATZ preenche heroi que a OpenDota nao devolveu, rotulado como STRATZ_BRACKET', () => {
    const result = resolve(ok([row(1)]), ok([row(2, 5000, 2400)]));

    expect(sourceOf(result, 2)).toBe('STRATZ_BRACKET');
    expect(result.byHeroId.get(2)?.matchCount).toBe(5000);
    expect(result.byHeroId.get(2)?.winRate).toBeCloseTo(0.48, 10);
  });

  it('num resultado misto, cada linha carrega a fonte que efetivamente prevaleceu', () => {
    const result = resolve(
      ok([row(1), row(2)]),
      ok([row(2), row(3), row(4)]),
    );

    expect(result.winrates.map((w) => w.heroId).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(sourceOf(result, 1)).toBe('OPENDOTA_BRACKET');
    expect(sourceOf(result, 2)).toBe('OPENDOTA_BRACKET');
    expect(sourceOf(result, 3)).toBe('STRATZ_BRACKET');
    expect(sourceOf(result, 4)).toBe('STRATZ_BRACKET');

    // Prova que ha linha das DUAS fontes no mesmo resultado — sem isso o teste acima
    // passaria com um modulo que rotula tudo com a mesma fonte.
    const fontes = new Set(result.winrates.map((w) => w.source));
    expect(fontes).toEqual(new Set<MetaSource>(['OPENDOTA_BRACKET', 'STRATZ_BRACKET']));
  });

  it('a fonte rotulada é a do slot de entrada, nunca a que a linha declara sobre si', () => {
    // Linha da STRATZ que se autodeclara OpenDota. Confiar no campo da entrada deixaria
    // a procedencia mentir; a fonte é o slot por onde a linha chegou.
    const mentirosa = { ...row(9), source: 'OPENDOTA_BRACKET' as MetaSource };
    const result = resolve(EMPTY, ok([mentirosa]));

    expect(sourceOf(result, 9)).toBe('STRATZ_BRACKET');
  });

  it('fonte que nao respondeu nao contribui linha, mesmo que o envelope traga resto de payload', () => {
    const result = resolve({ status: 'ERROR', rows: [row(1)], reason: 'HTTP 500' }, ok([row(2)]));

    expect(result.byHeroId.has(1)).toBe(false);
    expect(sourceOf(result, 2)).toBe('STRATZ_BRACKET');
  });

  it('recalcula o winRate a partir de wins/matchCount em vez de aceitar o declarado', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 10, wins: 5, winRate: 0.99 }]), EMPTY);

    expect(result.byHeroId.get(1)?.winRate).toBeCloseTo(0.5, 10);
  });
});

/* ------------------------------------------------------------------ *
 * T051 — I-11, I-12, I-14
 * ------------------------------------------------------------------ */

describe('invariantes de procedencia (T051)', () => {
  it('I-11: todo MetaWinrate do resultado tem matchCount definido e maior que zero', () => {
    const result = resolve(
      ok([row(1), { heroId: 2, matchCount: 0, wins: 0 }, { heroId: 3, matchCount: null, wins: 4 }]),
      ok([row(4), { heroId: 5, matchCount: undefined, wins: 1 }]),
    );

    expect(result.winrates.length).toBeGreaterThan(0);
    for (const w of result.winrates) {
      expect(typeof w.matchCount).toBe('number');
      expect(w.matchCount).toBeGreaterThan(0);
    }
  });

  it('I-11: linha com matchCount 0 é descartada, nao publicada como winrate sem amostra', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 0, wins: 0 }]), EMPTY);

    expect(result.byHeroId.has(2)).toBe(false);
    expect(result.winrates).toHaveLength(0);
    expect(result.discarded).toBeGreaterThan(0);
  });

  it('I-11: linha sem `wins` é descartada em vez de completada com zero', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 500 }]), EMPTY);

    expect(result.byHeroId.has(2)).toBe(false);
  });

  it('I-11: linha com wins maior que matchCount é descartada, nao truncada', () => {
    const result = resolve(ok([{ heroId: 2, matchCount: 100, wins: 140 }]), EMPTY);

    expect(result.byHeroId.has(2)).toBe(false);
  });

  it('I-12: nenhum MetaWinrate é construido sem `source` e sem `patch`', () => {
    const result = resolve(ok([row(1)]), ok([row(2)]));

    expect(result.winrates).toHaveLength(2);
    for (const w of result.winrates) {
      expect(w.source).toBeDefined();
      expect(['OPENDOTA_BRACKET', 'STRATZ_BRACKET']).toContain(w.source);
      expect(typeof w.patch).toBe('string');
      expect(w.patch.length).toBeGreaterThan(0);
    }
  });

  it('I-12: preserva o patch da propria linha em vez de reetiquetar com o patch da resolucao', () => {
    const result = resolveMetaWinrates({
      openDota: ok([{ ...row(1), patch: '7.38b' }]),
      stratz: ok([row(2)]),
      patch: PATCH,
      profileTier: 7,
    });

    expect(result.byHeroId.get(1)?.patch).toBe('7.38b');
    expect(result.byHeroId.get(2)?.patch).toBe(PATCH);
  });

  it('I-12: sem patch na linha e sem patch na resolucao, a linha é descartada', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      stratz: EMPTY,
      patch: '',
      profileTier: 7,
    });

    expect(result.winrates).toHaveLength(0);
    expect(result.discarded).toBeGreaterThan(0);
  });

  it('I-14: heroi ausente das duas fontes ganha ausencia — nao aparece no resultado', () => {
    const result = resolve(ok([row(1)]), ok([row(2)]));

    expect(result.byHeroId.has(3)).toBe(false);
    expect(result.winrates.some((w) => w.heroId === 3)).toBe(false);
  });

  it('I-14: heroi ausente das duas fontes NAO aparece com winRate 0 e matchCount 0', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 0, wins: 0 }]), ok([{ heroId: 1, matchCount: 0, wins: 0 }]));

    expect(result.winrates).toHaveLength(0);
    expect(result.winrates.some((w) => w.matchCount === 0)).toBe(false);
    expect(result.winrates.some((w) => w.winRate === 0)).toBe(false);
  });

  it('I-14: heroId invalido nao viaja como linha zerada', () => {
    const result = resolve(ok([{ heroId: 0, matchCount: 10, wins: 5 }, { heroId: -3, matchCount: 10, wins: 5 }]), EMPTY);

    expect(result.winrates).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * T051 / T057 — I-24 e I-21: degradacao
 * ------------------------------------------------------------------ */

describe('classificacao do desfecho (T051 — I-24, I-21)', () => {
  it('I-24: as duas fontes responderam ⇒ SUCCESS e escreve', () => {
    const result = resolve(ok([row(1)]), ok([row(2)]));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesUsed.sort()).toEqual(['OPENDOTA_BRACKET', 'STRATZ_BRACKET']);
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesMissing).toEqual([]);
  });

  it('I-24: STRATZ fora com OpenDota dentro ⇒ PARTIAL que escreve, com rotulo de qual faltou', () => {
    const result = resolve(ok([row(1)]), FAILED);

    expect(result.outcome).toBe('PARTIAL');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesFailed).toEqual(['STRATZ_BRACKET']);
    expect(result.sourcesMissing).toEqual(['STRATZ_BRACKET']);
    expect(result.unavailable).toEqual([
      { source: 'STRATZ_BRACKET', reason: 'ERROR', message: 'timeout' },
    ]);
    // O dado da fonte que respondeu continua inteiro.
    expect(sourceOf(result, 1)).toBe('OPENDOTA_BRACKET');
  });

  it('I-24: OpenDota fora com STRATZ dentro ⇒ PARTIAL que escreve, com rotulo de qual faltou', () => {
    const result = resolve(FAILED, ok([row(2)]));

    expect(result.outcome).toBe('PARTIAL');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesUsed).toEqual(['STRATZ_BRACKET']);
    expect(result.sourcesFailed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.sourcesMissing).toEqual(['OPENDOTA_BRACKET']);
    expect(sourceOf(result, 2)).toBe('STRATZ_BRACKET');
  });

  it('I-24: as duas fora ⇒ FAILURE que NAO escreve', () => {
    const result = resolve(FAILED, FAILED);

    expect(result.outcome).toBe('FAILURE');
    expect(result.shouldWrite).toBe(false);
    expect(result.sourcesUsed).toEqual([]);
    expect(result.sourcesFailed.sort()).toEqual(['OPENDOTA_BRACKET', 'STRATZ_BRACKET']);
    expect(result.winrates).toHaveLength(0);
  });

  it('I-24: OpenDota fora e STRATZ sem token ⇒ FAILURE que NAO escreve', () => {
    const result = resolve(FAILED, NO_TOKEN);

    expect(result.outcome).toBe('FAILURE');
    expect(result.shouldWrite).toBe(false);
  });

  it('I-21: ausencia do token da STRATZ ⇒ PARTIAL, nunca FAILURE', () => {
    const result = resolve(ok([row(1), row(2)]), NO_TOKEN);

    expect(result.outcome).toBe('PARTIAL');
    expect(result.outcome).not.toBe('FAILURE');
    expect(result.shouldWrite).toBe(true);
    // A feature conclui INTEIRA so com a OpenDota (FR-015a).
    expect(result.winrates).toHaveLength(2);
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
  });

  it('I-21: sem token nao entra em sourcesFailed — `unavailable` distingue de "falhou"', () => {
    const semToken = resolve(ok([row(1)]), NO_TOKEN);
    expect(semToken.sourcesFailed).toEqual([]);
    expect(semToken.sourcesMissing).toEqual(['STRATZ_BRACKET']);
    expect(semToken.unavailable).toEqual([{ source: 'STRATZ_BRACKET', reason: 'NO_TOKEN' }]);

    const falhou = resolve(ok([row(1)]), FAILED);
    expect(falhou.sourcesFailed).toEqual(['STRATZ_BRACKET']);
    expect(falhou.unavailable[0].reason).toBe('ERROR');

    // A distincao é o ponto: os dois sao PARTIAL, mas nao pela mesma razao.
    expect(semToken.unavailable[0].reason).not.toBe(falhou.unavailable[0].reason);
  });

  it('"respondeu sem dados" nao é "nao respondeu": EMPTY nao falha nem é usada', () => {
    const result = resolve(EMPTY, ok([row(2)]));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.shouldWrite).toBe(true);
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesMissing).toEqual([]);
    expect(result.sourcesUsed).toEqual(['STRATZ_BRACKET']);
  });

  it('OK sem nenhuma linha aproveitavel degrada para EMPTY, nao para ERROR', () => {
    const result = resolve(ok([{ heroId: 1, matchCount: 0, wins: 0 }]), ok([row(2)]));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesUsed).toEqual(['STRATZ_BRACKET']);
    expect(result.sourcesFailed).toEqual([]);
  });

  it('sourceAvailable: respondeu (OK/EMPTY) é disponivel; sem token e erro nao sao', () => {
    expect(sourceAvailable('OK')).toBe(true);
    expect(sourceAvailable('EMPTY')).toBe(true);
    expect(sourceAvailable('NO_TOKEN')).toBe(false);
    expect(sourceAvailable('ERROR')).toBe(false);
  });

  it('classifyOutcome concorda com a tabela de degradacao do contrato', () => {
    const casos: [MetaSourceStatus, MetaSourceStatus, string, boolean][] = [
      ['OK', 'OK', 'SUCCESS', true],
      ['OK', 'EMPTY', 'SUCCESS', true],
      ['EMPTY', 'EMPTY', 'SUCCESS', true],
      ['OK', 'NO_TOKEN', 'PARTIAL', true],
      ['OK', 'ERROR', 'PARTIAL', true],
      ['ERROR', 'OK', 'PARTIAL', true],
      ['ERROR', 'EMPTY', 'PARTIAL', true],
      ['NO_TOKEN', 'OK', 'PARTIAL', true],
      ['ERROR', 'ERROR', 'FAILURE', false],
      ['ERROR', 'NO_TOKEN', 'FAILURE', false],
      ['NO_TOKEN', 'NO_TOKEN', 'FAILURE', false],
    ];

    for (const [openDota, stratz, outcome, shouldWrite] of casos) {
      const c = classifyOutcome({ openDota, stratz });
      expect({ openDota, stratz, outcome: c.outcome, shouldWrite: c.shouldWrite }).toEqual({
        openDota,
        stratz,
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
});

/* ------------------------------------------------------------------ *
 * T061 — FR-020 e I-13
 * ------------------------------------------------------------------ */

describe('ranque de referencia e honestidade do rotulo (T061 — FR-020, I-13)', () => {
  it('bracket especifico do jogador ⇒ bracketIsPlayerSpecific true', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      stratz: EMPTY,
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
      stratz: EMPTY,
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
      stratz: ok([row(2)]),
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
      stratz: EMPTY,
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
      stratz: EMPTY,
      patch: PATCH,
    });

    expect(result.bracket).toEqual({ bracket: 'ALL', isPlayerSpecific: false });
  });

  it('preferencia explicita por ALL ⇒ flag false, mesmo com ranque de perfil conhecido', () => {
    const result = resolveMetaWinrates({
      openDota: ok([row(1)]),
      stratz: EMPTY,
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
      stratz: EMPTY,
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
            stratz: ok([row(2)]),
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
 * Realismo: amostra real da STRATZ, convertida aqui mesmo
 * ------------------------------------------------------------------ */

describe('precedencia com a amostra real da STRATZ', () => {
  /** Linhas cruas de `heroStats.winWeek` -> a entrada deste modulo. Sem usar o mapper. */
  const reais: MetaSampleRow[] = (fixture as any).divineImmortal.data.heroStats.winWeek.map(
    (r: any) => ({ heroId: r.heroId, wins: r.winCount, matchCount: r.matchCount }),
  );

  it('a fixture real tem 127 herois com amostra utilizavel', () => {
    expect(reais).toHaveLength(127);
    for (const r of reais) expect(r.matchCount as number).toBeGreaterThan(0);
  });

  it('a OpenDota vence nos herois que cobre e a STRATZ preenche o resto', () => {
    const cobertosPelaOpenDota = reais.slice(0, 60);
    const result = resolveMetaWinrates({
      openDota: ok(cobertosPelaOpenDota.map((r) => ({ ...r, matchCount: 1234, wins: 600 }))),
      stratz: ok(reais),
      patch: PATCH,
      profileTier: 7,
    });

    expect(result.winrates).toHaveLength(127);
    expect(result.outcome).toBe('SUCCESS');

    const daOpenDota = result.winrates.filter((w) => w.source === 'OPENDOTA_BRACKET');
    const daStratz = result.winrates.filter((w) => w.source === 'STRATZ_BRACKET');
    expect(daOpenDota).toHaveLength(60);
    expect(daStratz).toHaveLength(67);

    // A amostra que sai é a da fonte que prevaleceu, nao uma media das duas.
    for (const w of daOpenDota) expect(w.matchCount).toBe(1234);
    for (const w of daStratz) {
      const cru = reais.find((r) => r.heroId === w.heroId);
      expect(w.matchCount).toBe(cru?.matchCount);
      expect(w.wins).toBe(cru?.wins);
    }
  });

  it('bracket vazio da fixture é fonte que respondeu sem dados, nao fonte que falhou', () => {
    const vazias = (fixture as any).emptyBracket.data.heroStats.winWeek;
    const result = resolveMetaWinrates({
      openDota: ok(reais),
      stratz: { status: 'OK', rows: vazias },
      patch: PATCH,
      profileTier: 7,
    });

    expect(result.outcome).toBe('SUCCESS');
    expect(result.sourcesFailed).toEqual([]);
    expect(result.sourcesUsed).toEqual(['OPENDOTA_BRACKET']);
    expect(result.winrates).toHaveLength(127);
  });
});
