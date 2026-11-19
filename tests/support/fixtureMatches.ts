import { mapOpenDotaMatch } from '../../src/services/openDotaMatch';
import referenceFixture from '../../src/services/__fixtures__/match-parsed-opendota.json';
import unevenFixture from '../../src/services/__fixtures__/match-uneven-lane-opendota.json';
import type {
  DamageByAbility,
  DamageReceivedTotal,
  HeroAverageEntry,
  MatchDetails,
  MatchPlayer,
} from '../../src/types/dota';

/**
 * As partidas de referencia dos testes de motor (coaching, destaques, ameaca).
 *
 * POR QUE ESTE ARQUIVO EXISTE. Ate 2026-11-19 esses testes rodavam sobre `match-parsed.json`
 * (resposta da STRATZ) passada pelo `mapStratzMatch`. A STRATZ saiu do app e os dois foram
 * apagados (etapa 2 da D4, docs/PLANO-OPENDOTA.md). Daqui em diante:
 *
 *  - A BASE é sempre REAL: o `mapOpenDotaMatch` de verdade sobre uma resposta real e
 *    anonimizada da OpenDota. `referenceMatch()` é a partida de referencia (a do Meepo);
 *    `unevenLaneMatch()` foi escolhida pelo que dispara com dado real — rota desigual,
 *    `farmingStacksHigh`, `fightKpHigh`, `visionCoverageLow` e `ROUGH_GAME` —, nunca editada.
 *
 *  - O que a OpenDota NAO TEM (curva `heroAverage`, divisao fisico/magico/puro, controle
 *    sofrido) entra por cima, no dominio, pelas funcoes `withSynthetic*` — SINTETICO e com
 *    esse nome. Elas existem para cobrir regras que hoje estao DORMENTES no app (nenhum
 *    caminho de runtime liga `heroAverage` nem `damageReport`) e que a Fase 2 do plano vai
 *    religar com benchmark proprio. Nenhum numero aqui foi copiado da STRATZ: a "media do
 *    heroi" sintetica é a PROPRIA serie do jogador dividida por uma razao escolhida pelo
 *    teste, entao razao 1 quer dizer "jogou exatamente na media".
 *
 * Nao é arquivo de teste (nao termina em `.test.ts`), entao o vitest nao o executa; e fica
 * fora do espelho de `src/` porque nao testa modulo nenhum — é dado compartilhado, como as
 * fixtures (ver tests/CLAUDE.md).
 */

/** Copia funda: cada teste recebe a sua, e mutacao nao vaza entre arquivos. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const referenceRaw = (): any => clone(referenceFixture);
export const unevenLaneRaw = (): any => clone(unevenFixture);
export const referenceMatch = (): MatchDetails => mapOpenDotaMatch(referenceRaw());
export const unevenLaneMatch = (): MatchDetails => mapOpenDotaMatch(unevenLaneRaw());

/**
 * Serie de deltas -> cumulativa indexada pelo MINUTO: `[0, d0, d0+d1, ...]`. O delta `i` é o
 * que aconteceu entre os minutos i e i+1, entao o valor no minuto t é a soma dos t primeiros
 * (CS@10 = soma dos 10 primeiros deltas — a convencao de `utils/insights/timeSeries.ts`).
 */
function cumulative(deltas: number[] | null | undefined): number[] {
  const out: number[] = [0];
  let acc = 0;
  for (const v of deltas ?? []) out.push((acc += v || 0));
  return out;
}

export interface SyntheticHeroAverageOptions {
  /**
   * Desempenho do jogador contra a "media" sintetica, por jogador. 1 = igual; 1,3 = 30%
   * acima (a curva sai dividida por 1,3). Padrao 1.
   */
  ratio?: (p: MatchPlayer, i: number) => number;
  /** `matchCount` de toda entrada da curva. Padrao 5.000. */
  matchCount?: number;
  /**
   * `killContributionAverage` (0..1). Padrao 0 = campo ausente, que é o caso que o
   * `context.ts` rotula como ROLE_BASELINE.
   */
  killContribution?: number;
}

/**
 * SINTETICO. Liga `availability.heroAverage` e da a cada jogador uma curva cumulativa por
 * minuto derivada da propria serie: valor do minuto t / `ratio`. Abates, mortes e
 * assistencias crescem em linha reta ate o placar final (a OpenDota nao tem a serie), e
 * controle causado fica 0.
 */
export function withSyntheticHeroAverage(match: MatchDetails, opts: SyntheticHeroAverageOptions = {}): MatchDetails {
  const matchCount = opts.matchCount ?? 5000;
  const players = match.players.map((p, i) => {
    const s = p.series;
    const nw = s?.networthPerMinute ?? [];
    if (!nw.length) return { ...p, heroAverageCurve: null };
    const r = opts.ratio ? opts.ratio(p, i) : 1;
    const cs = cumulative(s?.lastHitsPerMinute);
    const dn = cumulative(s?.deniesPerMinute);
    const xp = cumulative(s?.experiencePerMinute);
    const hd = cumulative(s?.heroDamagePerMinute);
    const td = cumulative(s?.towerDamagePerMinute);
    const st = cumulative(s?.campStack);
    const last = nw.length - 1;
    const curve: HeroAverageEntry[] = nw.map((networth, t) => {
      const f = last > 0 ? t / last : 1;
      return {
        timeMin: t,
        position: p.position ?? p.role,
        matchCount,
        winCount: Math.round(matchCount / 2),
        cs: (cs[t] ?? 0) / r,
        dn: (dn[t] ?? 0) / r,
        networth: networth / r,
        xp: (xp[t] ?? 0) / r,
        kills: (p.kills * f) / r,
        deaths: p.deaths * f * r,
        assists: (p.assists * f) / r,
        heroDamage: (hd[t] ?? 0) / r,
        towerDamage: (td[t] ?? 0) / r,
        campsStacked: (st[t] ?? 0) / r,
        level: s?.level?.[t] ?? 0,
        killContributionAverage: opts.killContribution ?? 0,
        kDAAverage: 0,
        stunCount: 0,
        stunDuration: 0,
        disableCount: 0,
        disableDuration: 0,
      };
    });
    return { ...p, heroAverageCurve: curve };
  });
  return { ...match, players, availability: { ...match.availability, heroAverage: true } };
}

const ZERO_TOTAL: DamageReceivedTotal = {
  physicalDamage: 0,
  magicalDamage: 0,
  pureDamage: 0,
  heal: 0,
  stunCount: 0,
  stunDuration: 0,
  disableCount: 0,
  disableDuration: 0,
  slowCount: 0,
  slowDuration: 0,
};

/**
 * SINTETICO. Liga `availability.damageReport` e preenche `receivedTotal` (e, se pedido,
 * `receivedSourceAbility`) de cada jogador. `receivedTargets` e `receivedSourceItem` sao os
 * REAIS do mapper — a OpenDota tem de quem veio o dano, so nao tem o tipo.
 * `total` devolvendo `null` deixa aquele jogador sem relatorio.
 */
export function withSyntheticDamageReport(
  match: MatchDetails,
  total: (p: MatchPlayer, i: number) => Partial<DamageReceivedTotal> | null,
  abilities?: (p: MatchPlayer, i: number) => DamageByAbility[],
): MatchDetails {
  const players = match.players.map((p, i) => {
    const t = total(p, i);
    if (t === null) return { ...p, damageReport: null };
    const base = p.damageReport ?? { receivedTotal: null, receivedTargets: [], receivedSourceAbility: [], receivedSourceItem: [] };
    return {
      ...p,
      damageReport: {
        ...base,
        receivedTotal: { ...ZERO_TOTAL, ...t },
        receivedSourceAbility: abilities ? abilities(p, i) : base.receivedSourceAbility,
      },
    };
  });
  return { ...match, players, availability: { ...match.availability, damageReport: true } };
}
