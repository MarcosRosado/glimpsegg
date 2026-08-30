# src/utils/heroGrid/

As funções **puras** que decidem *o que* escrever no `hero_grid_config.json` do jogador. O I/O
(backup, escrita atômica, guarda de imutabilidade) mora em `electron/heroGrid/` e recebe daqui o
**texto já serializado**. Nada aqui lê arquivo, faz rede ou chama `Date.now()` — é o que torna a
feature inteira testável sem levantar Electron.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `mirrorBuilder.ts` | `buildMirror`/`removeMirror`, `MIRROR_NAME_SUFFIX`, `defaultMirrorName`. Decide o conteúdo do layout espelho |
| `valveJson.ts` | `serializeHeroGridFile`/`parseHeroGridFile`, `formatValveNumber`, `HeroGridParseError`. Serializador próprio |
| `ranking.ts` | `rankHeroes`, `scoreHero`, `personalWeight`, `PERSONAL_WEIGHT_K`, `compareHeroScores`, `recomputeScoreFromBreakdown` |
| `sourcePrecedence.ts` | `resolveMetaWinrates`, `classifyOutcome`, `resolveMetaBracket`, `SEGMENTED_BRACKETS`. Precedência **OpenDota → STRATZ** |
| `syncScheduler.ts` | `shouldSyncNow`, `syncPhase`, `nextDueAt`, `backoffMs`, `daysSinceLastSuccess`, `recordSyncOutcome`; `SYNC_INTERVAL_MS`, `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS` |
| `preferences.ts` | Preferências e estado de sync no `AppConfig`: `HERO_GRID_DEFAULTS`, `SYNC_STATE_DEFAULTS`, `MAX_SYNC_HISTORY`, e o `HeroGridConfigIO` nos dois caminhos (`electronConfigIO`/`browserConfigIO`) |
| `mirrorLayout.ts` | Geometria da réplica visual: `buildMirrorCanvas`, `scaleCanvas`, `fitScale`, `resolveMirrorLayout`; `MIRROR_UNIT_SCALE`, `MIRROR_MIN_SCALE`/`MAX_SCALE`, `MIRROR_LEGIBLE_SCALE`, `SCORE_QUALITY_MIN_SAMPLE` |
| `settingsOptions.ts` | `buildLayoutOptions`, `findLayoutOption`, `preselectAccount`/`preselectSourceRef`, `resolveGridFilePath`, `GRID_FILE_BASENAME` |
| `tabFormat.ts` | `describeDaysSince`, `isMirrorStale`/`STALE_DAYS_THRESHOLD`, `isScoreDisplayable`, `isPersonalApplied`, `sortScoresForDisplay`, `formatRatioPercent` |
| `heroTooltip.ts` | `buildHeroTooltipRows` — o conteúdo do tooltip do tile como **dado tipado**, não frase |

## Regras locais

- **Identidade é POSIÇÃO, nunca nome.** Nenhuma função localiza layout ou categoria por
  `config_name`/`category_name`. O Dota permite homônimos e permite renomear a qualquer momento;
  buscar por nome perde o rastro do espelho num rename e cria um segundo na sincronização seguinte.
  `isNameAmbiguous` existe para a UI conseguir distinguir dois homônimos honestamente.
- **O espelho é elemento novo no fim do array `configs`.** `buildMirror` faz cópia rasa e as
  posições que não são o espelho seguem apontando para os **mesmos objetos** lidos — a
  imutabilidade dos layouts do jogador é verdadeira por construção, e o main reconfere por
  igualdade profunda antes de gravar.
- **A única coisa que o espelho muda é a ordem dentro de cada grupo.** Número de categorias, nomes,
  as quatro coordenadas e o **conjunto** de `hero_ids` vêm da origem intactos. Herói sem dado não é
  descartado nem ganha nota estimada: vai para o fim do próprio grupo preservando a ordem relativa.
- **Serializador próprio, não `JSON.stringify`.** A Valve usa tabs, `[` em linha própria e floats
  de 6 decimais mesmo quando o valor é inteiro. `JSON.stringify` passaria na igualdade profunda mas
  reescreveria a formatação inteira, e o diff faria parecer que a ferramenta mexeu no layout de
  origem. O alvo é diff mínimo: mudou um `hero_ids`, só aquelas linhas mudam.
- **O winrate é o geral do herói, não por posição** — não há como inferir a função de um grupo pelo
  nome (`"Supps principais"`), então a ordem de um grupo de suportes **não** é um ranking de
  suportes, e a tela tem de dizer isso.
- Uma fonte de meta fora ⇒ `PARTIAL`, **escreve**, rotulado; as duas fora ⇒ `FAILURE`, **não
  escreve**. `classifyOutcome` é quem decide.
- `heroTooltip.ts` **duplica de propósito** o `NO_DATA_REASON_KEY` que existe como `NO_DATA_LABEL`
  em `components/heroGrid/labels.ts` — `utils/` não importa de `components/`. As duas cópias não
  podem divergir em silêncio: `tests/utils/heroGrid/heroTooltip.test.ts` compara as tabelas chave
  a chave.
- `syncScheduler` recebe `now` por argumento em **toda** função. O `Date.now()` real mora num
  único ponto, o hook `useHeroGridSync`.

## Calibração: o que está ancorado em quê

- `PERSONAL_WEIGHT_K` tem tabela de referência no comentário (0 jogos → peso 0; 20 → 0,50; 100 →
  0,83). Mexer em `K` sem atualizar a tabela do contrato deixa `tests/utils/heroGrid/ranking.test.ts`
  vermelho **de propósito**.
- `MIRROR_UNIT_SCALE` e as escalas de legibilidade foram medidas contra o **tile atual e as
  fixtures**, não contra patch de Dota. Mudou o tile ou o tamanho da fonte da nota → remedir.

## Ao sair um patch

Nada aqui depende de patch do Dota: os winrates vêm da rede e o catálogo de heróis vem de
`constants/heroes.ts` (herói novo ausente de lá cai em `HERO_UNKNOWN`, que é `noDataReason`
legítimo, não erro). O que exige atenção é patch do **cliente do Dota** que mude o formato do
`hero_grid_config.json`: as duas fixtures de `services/__fixtures__/` (`hero-grid-real.json` e `hero-grid-adverse.json`) e o
round-trip byte a byte do `valveJson` são o que detecta isso.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../components/heroGrid/CLAUDE.md](../../components/heroGrid/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
