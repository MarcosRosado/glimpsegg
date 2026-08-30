# src/services/__fixtures__/

Respostas **reais** e anonimizadas das APIs, mais duas cópias do `hero_grid_config.json`. É o que
permite exercitar mapper de ponta a ponta sem rede e sem token. Nenhuma delas é dado inventado.

As fixtures ficam **aqui**, junto do código que elas exercitam; quem as consome é a suíte em
`tests/`, que importa cada uma por caminho relativo até `src/services/__fixtures__/`. Os caminhos
da coluna "Consumido por" saem da raiz do repositório — ver
[tests/CLAUDE.md](../../../tests/CLAUDE.md).

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `match-parsed.json` | Resposta 200 da STRATZ para uma partida **parseada**, anonimizada. É a partida de referência do projeto inteiro | `tests/services/stratzGql.test.ts`, `tests/utils/awardEngine.test.ts`, `tests/utils/insights/{index,context,threatProfile,placeholders}.test.ts` |
| `hero-winrates.json` | Resposta real de `heroStats.winWeek`, por bracket. Carrega `_note`, `_query` e `_bracketMap` **dentro do próprio arquivo** — a query e o enum usados estão documentados ali | `tests/services/heroGrid/stratzWinrates.test.ts`, `tests/utils/heroGrid/sourcePrecedence.test.ts` |
| `opendota-herostats.json` | Recorte real de `GET /api/heroStats` (10 heróis dos 127, todos os campos de cada um intactos). O `_note` registra que nesta captura o bucket 8 (Immortal) veio `0` para todos | `tests/services/heroGrid/openDotaWinrates.test.ts` |
| `hero-grid-real.json` | Grid real anonimizado: 1 layout, 8 grupos, catálogo quase inteiro, herói `20` repetido em dois grupos (repetição que **já existia** no arquivo original) | `tests/utils/heroGrid/{mirrorBuilder,mirrorLayout,valveJson}.test.ts` |
| `hero-grid-real.raw.txt` | O **texto** original do mesmo grid: tabs, floats de 6 decimais, `[` em linha própria, sem newline final. Alvo do round-trip byte a byte | `tests/utils/heroGrid/valveJson.test.ts` |
| `hero-grid-adverse.json` | A anti-fixture: 3 layouts, dois de nome igual, categorias homônimas, grupo vazio, poucos heróis, `version: 4`, campo desconhecido da Valve | `tests/utils/heroGrid/{mirrorBuilder,mirrorLayout,valveJson}.test.ts`, `tests/electron/heroGrid/gridFile.test.cjs` |
| `hero-grid-fixtures.md` | Documentação das duas fixtures de grid: o que cada uma cobre, invariante por invariante, e o que a real deixa de fora. **Não é fixture consumida por teste** | leitura humana |

## Regras locais

- **A fixture fixa FORMA, não valor.** Ela existe para provar que o mapper aguenta a resposta crua
  — snake_case, campo nulo, `win` em vez de `wins`, enum como string. Teste que depende do valor
  exato de um herói da fixture está testando a captura, não o código.
- **Não substituir por objeto sintético.** Ao mexer em parsing, use a fixture; foi ela que pegou os
  bugs que os objetos montados à mão não pegavam. Onde um caso não existe na captura (`pick === 0`
  na fixture da OpenDota), o teste monta a linha sintética **ao lado** e diz por quê.
- **A adversa é a que mais importa.** Com um layout só, a invariante "não altere nenhum outro
  layout" passa **vazia** — `hero-grid-real.json` sozinho não prova nada sobre isso.
- **Não há script de regeneração.** Toda fixture é captura manual anonimizada; regenerar é
  recapturar e reanonimizar à mão. Só se justifica quando o **schema** muda.
- Nada de PII e nada de token. IDs de partida e de conta já vêm trocados; os `category_name` do
  grid real foram substituídos preservando a irregularidade de capitalização do original, porque é
  essa irregularidade que sustenta a decisão de não inferir posição pelo nome do grupo.

## Ao sair um patch

Nada aqui muda por patch de Dota. As fixtures são capturas datadas: o valor envelhece de propósito
e isso não é defeito, porque nenhum teste afirma meta atual. O gatilho para recapturar é **mudança
de schema** da STRATZ ou da OpenDota (campo removido, enum renomeado, formato do arquivo da Valve),
nunca herói novo nem rebalanceamento.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../heroGrid/CLAUDE.md](../heroGrid/CLAUDE.md) ·
[hero-grid-fixtures.md](hero-grid-fixtures.md) · [tests/CLAUDE.md](../../../tests/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
