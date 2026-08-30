# src/utils/insights/rules/

Uma regra é um objeto `InsightRule`: `id`, `category`, `requires` (flags de
`MatchDataAvailability`), `positions` opcional e `evaluate(ctx) => RuleHit | null`. Nenhum arquivo
daqui produz texto — só `RuleId` e params crus. Todos são reunidos por `ALL_RULES` em
[../CLAUDE.md](../CLAUDE.md).

## Arquivos

| Arquivo | `RuleId` que define | `requires` | Recorte |
| --- | --- | --- | --- |
| `build.ts` | `buildItemLate`, `buildItemMissing`, `buildItemOffMeta`, `buildItemGood`, `matchupCounterItem` | — | Traduz os veredictos do `buildAdvisor` (`heroStats.itemFullPurchase`) |
| `build.ts` (`compositeRules`) | `compositeBurstNoDispel` | `deathEvents`, `damageReport` | A manchete; suprime `SUPPRESSED_BY_COMPOSITE` |
| `matchup.ts` | `matchupHardCounter`, `matchupThreatMagical`, `matchupThreatPhysical`, `matchupThreatLockdown` | — / `damageReport` / `damageReport`+`heroAverage` | Olha os **cinco inimigos**, via `threatProfile` |
| `deaths.ts` | `deathsBurst`, `deathsWardWalk`, `deathsDieBack`, `deathsTpInterrupted`, `deathsHealUnused`, `deathsTimeDead`, `deathsNemesis` | `deathEvents` | Forense de morte, tudo de `stats.deathEvents` |
| `laning.ts` | `laningCsHigh`, `laningCsLow`, `laningDeniesHigh`, `laningLaneStomped`, `laningLaneLost` | `perMinuteStats` / `laneOutcomes` | Os `Low` são só pos 1/2/3. `cs10` sai da soma dos 10 primeiros minutos |
| `farming.ts` | `farmingNetworthHigh`, `farmingNetworthLow`, `farmingStacksHigh`, `farmingCurveBehind` | `networthSeries`, `perMinuteStats`, `heroAverage` | Patrimônio/min contra patrimônio/min. `farmingStacksHigh` é só pos 4/5 |
| `fighting.ts` | `fightKpHigh`, `fightKpLow`, `fightDamageShareHigh`, `fightDamageLow` | — / `heroAverage` | Participação em abates e fatia de dano; as de dano só para cores |
| `vision.ts` | `visionCoverageHigh`, `visionCoverageLow`, `visionUptimeLow`, `visionWardsLostEarly`, `visionDewardsHigh` | `wards` | As quatro primeiras só pos 4/5. Limiares **por 10 minutos**, nunca absolutos |
| `discipline.ts` | `disciplineLowDeaths`, `disciplineHighDeaths` | — | Mortes contra o benchmark de posição |
| `objectives.ts` | `objectiveTowerHigh`, `objectiveTowerLow` | — | Dano em torres; o `Low` só para cores |

## Regras locais

- **Flag ausente = regra pulada, nunca estimada.** `requires` é conferido antes do `evaluate`; sem
  a flag, o insight simplesmente não existe. `requires: []` significa "só depende do placar", que
  toda partida tem.
- Regra que **lança exceção** é logada e pulada — não derruba a aba de coaching.
- **Limiar relativo, não absoluto.** `vision.ts` documenta o bug que originou a convenção: com
  limiar absoluto, "< 8 wards" disparava em toda partida acima de 25 minutos. O mesmo raciocínio
  vale para `deaths.ts` (`timeDead` como fração da duração) e `farming.ts` (razão contra o
  benchmark, não delta bruto).
- **Comparar unidades iguais.** As regras de economia mediam `goldPerMinute` (ouro ganho) contra
  `networth/min` (ouro acumulado): na fixture real, 4 dos 10 jogadores estouravam o gatilho só pelo
  erro. Hoje as duas pontas são patrimônio por minuto, no mesmo minuto.
- `wardEvents === undefined` (sem dado) e `[]` (colocou zero ward) são coisas diferentes. Confundir
  os dois foi o bug das quatro wards falsas.

## Limiares e sua procedência

- `deaths.ts` / `deathsWardWalk` — `BASELINE_SHARE = 0.54`, **medido**: numa partida real parseada,
  56 de 103 mortes tinham `isWardWalkThrough`, distribuídas por todos os 10 jogadores (22% a 100%).
  Morrer dentro de visão inimiga é a norma no Dota, então o gatilho exige folga clara sobre a linha
  de base.
- `matchup.ts` — `MATCHUP_MIN_SAMPLE` (de `threatProfile.ts`) e o limite superior de win rate
  garantem que o confronto seja desfavorável **com folga**.
- `vision.ts` — **o limiar frouxo da pasta.** Usa um benchmark fixo de wards por 10 minutos
  descrito no código apenas como "esperado de um suporte": é o único sem amostra citada no
  comentário. Antes de confiar num insight de visão, saiba que essa é a régua.

## Ao sair um patch

Nenhum arquivo daqui referencia herói ou item por id — a dependência de patch é indireta, via
`constants/counterItems.ts` (que `build.ts` consome pelo `buildAdvisor`) e via inflação de
economia, que desloca os limiares de `farming.ts` e `objectives.ts`. Refazer a medição antes de
mexer em qualquer número; ajustar no olho é o erro que este motor existe para não cometer.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../CLAUDE.md](../../CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../../docs/PATCH-CHECKLIST.md)
