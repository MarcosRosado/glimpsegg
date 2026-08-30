# src/utils/insights/

Motor de coaching: **determinístico, sem LLM**. Regras declarativas emitem `RuleId` + números
crus; o texto mora no i18n e a formatação por locale acontece na UI (`CoachingInsightsTab`).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `index.ts` | `ALL_RULES` (concatena os arrays de `rules/`), `evaluateRules`, `generateMatchInsights`. Guarda `SUPPRESSED_BY_COMPOSITE` |
| `types.ts` | `RuleId` (união **fechada**), `InsightRule`, `RuleHit`, `Benchmarked`/`BenchmarkSet`, `InsightContext` |
| `ruleText.ts` | `RULE_TEXT: Record<RuleId, RuleTextKeys>`, `CATEGORY_LABEL`, `SOURCE_LABEL` — regra → chaves i18n |
| `context.ts` | `buildInsightContext`: posição efetiva, benchmarks já resolvidos **com procedência**, medidas normalizadas, mortes, `threat` e `build` |
| `rank.ts` | Score, ordenação por severidade e corte: `IMPROVEMENT_SCORE_FLOOR`, `MAX_PER_CATEGORY`, `MAX_IMPROVEMENTS`, `MAX_STRENGTHS`, `toInsight`, `rankAndSelect` |
| `timeSeries.ts` | O **único** módulo que indexa as séries por minuto: `sumDeltas`, `sumAll`, `cumulativeAt`, `cumulativeLast`, `heroAverageAt`, `HERO_AVERAGE_MIN_SAMPLE`, `hasSeriesData` |
| `threatProfile.ts` | `ThreatArchetype` (7), `buildThreatProfile`, `MATCHUP_MIN_SAMPLE` — perfil de ameaça derivado da partida medida |
| `wilson.ts` | `wilsonLowerBound`/`wilsonUpperBound`, `Z_95`. Impede amostra pequena de virar recomendação confiante |
| `formatParams.ts` | `formatParams`: params crus → string no locale certo. Convenção de sufixo `*Sec` (relógio m:ss), `*Min` (minuto inteiro), `pct`/`winRate`/`share` |
| `rules/` | As regras em si ([CLAUDE.md](rules/CLAUDE.md)) |

## Regras locais

- **DELTA vs. CUMULATIVO.** `lastHitsPerMinute`, `deniesPerMinute`, `campStack`,
  `heroDamagePerMinute` são **deltas** (CS@10 = soma dos 10 primeiros); `networthPerMinute` é
  **cumulativo** (networth@10 = `arr[10]`, não a soma); `heroAverage[]` é cumulativo e tem
  `timeMin` próprio — indexe pelo campo, nunca pela posição. Trocar um pelo outro dá erro de ordem
  de grandeza, e é o motivo de toda leitura passar por `timeSeries.ts`.
- **Corte por relevância, não por cota.** `IMPROVEMENT_SCORE_FLOOR` descarta melhoria fraca;
  `MAX_*` só limita o topo. Não existe piso de quantidade — **lista vazia é resultado válido**. A
  versão anterior inventava três blocos de conselho genérico para preencher.
- `compositeBurstNoDispel` é a manchete: quando dispara, `evaluateRules` pula as regras de
  `SUPPRESSED_BY_COMPOSITE` (`deathsBurst`, `matchupThreatMagical`, `matchupThreatLockdown`,
  `matchupCounterItem`). Essa lista é mantida **à mão** — regra nova que conte parte da mesma
  história precisa entrar aqui.
- Regra que exige flag ausente de `MatchDataAvailability` é **pulada, nunca estimada**. Regra que
  lança exceção é logada (`console.warn`) e pulada; não derruba a aba.
- Todo `RuleHit` carrega `source` e, quando existe, `sampleSize`. `ROLE_BASELINE` chega à tela
  rotulado como estimativa — ver [../../../CLAUDE.md](../../../CLAUDE.md).

## Adicionar uma regra toca quatro pontos

Faltar qualquer um quebra o `tsc -b` ou os testes — de propósito:

1. `RuleId` novo na união fechada de `types.ts`.
2. Entrada em `RULE_TEXT` (`ruleText.ts`) com `title`/`body` e, se houver número, `stat`/`bench`.
3. O objeto `InsightRule` no array de `rules/*.ts` que o `ALL_RULES` de `index.ts` **já importa**
   (array novo exige um import a mais lá).
4. As chaves nos **dois** dicionários de `../../i18n/translations.ts`, com os mesmos marcadores.

`tests/utils/insights/placeholders.test.ts` não corresponde a nenhum módulo desta pasta (a suíte
espelha a árvore de `src/`, mas este arquivo é teste de tema): ele roda o motor sobre a fixture real,
renderiza cada insight nas duas locales e falha se sobrar `{marcador}` sem substituição, se um
marcador não vier do motor nem da camada de render (`{bracket}`), se as locales usarem marcadores
diferentes na mesma chave, ou se uma regra ficar órfã de texto.

## Ao sair um patch

Quase nada aqui é dependente de patch — os benchmarks vêm da API (`heroAverage`, `heroStats`), não
de tabela local. As exceções: `HERO_AVERAGE_MIN_SAMPLE` e `MATCHUP_MIN_SAMPLE` são pisos de amostra
fixos, e os limiares dentro de `rules/` foram calibrados sobre partidas reais — se a economia ou a
duração média do jogo mudar, refazer a medição. Ver [rules/CLAUDE.md](rules/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../i18n/translations.ts](../../i18n/translations.ts) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
