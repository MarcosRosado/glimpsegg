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
| `match-parsed-opendota.json` | Resposta 200 de `GET /api/matches/{id}` da OpenDota para uma partida **parseada**, anonimizada (ids, nomes e horário trocados; chat, cosméticos e URL do replay removidos — o `_note` do arquivo lista tudo). **A partida de referência do projeto** desde que a fixture da STRATZ (`match-parsed.json`) saiu, em 2026-11-19. Tem um Meepo, que é o caso de `deaths_log` com várias linhas por morte, e as três rotas pareadas (top e mid empatadas, bot do Dire logo abaixo do limiar de atropelo) | `tests/services/openDotaMatch.test.ts`, `tests/support/fixtureMatches.ts` (e por ele os testes de destaques e de coaching) |
| `match-uneven-lane-opendota.json` | Segunda resposta real da OpenDota (7.41, 34 min), colhida pelo coletor do gabarito e anonimizada pela mesma receita; o `_note` lista também os campos que o coletor já descarta (nenhum deles lido pelo mapper). **Escolhida pelo que dispara, nunca editada para disparar:** duas rotas desiguais (top 2v1 e mid 1v2 — o caminho "Vantagem aos 10 min"), `farmingStacksHigh`, `fightKpHigh`, `visionCoverageLow` e o prêmio `ROUGH_GAME`, que a de referência não cobre | `tests/support/fixtureMatches.ts` |
| `match-imp-generator.json` | Resposta 200 de `stratz.page.imp.matchGenerator` da STRATZ: os **insumos do IMP por minuto** (dez jogadores × 40 minutos de `events`, mais `winChance`, `winRateByPlayerMinuteValues` e `impValues`). É a **mesma partida** de `match-parsed-opendota.json` — cs e denies batem minuto a minuto, com diferença de no máximo 1 por amostragem. A resposta não traz conta, nome, horário nem id; o id real só existia no argumento da consulta e não está no arquivo. Fecha o gatilho da Fase 0 de `docs/PLANO-OPENDOTA.md` | Nenhum ainda — nenhum código do app consome o gerador até a Fase 4 (Glint) |
| `opendota-player.json` | Respostas 200 da OpenDota para uma conta pública, anonimizadas: `player` (`/players/{id}`), `wl`, `matches` (40 recentes com os campos de `project` que o app pede, parseadas e não parseadas), `heroMatches` (600 linhas da lista completa, só herói, KDA, lado e resultado), `heroes` (a rota `/heroes`, que veio com `games: 0` nos 127 heróis — guardada como prova do defeito) e `benchmarks` (tabelas de percentil de quatro heróis). O `_note` lista o que foi trocado | `tests/services/openDotaProfile.test.ts`, `tests/utils/glint.test.ts` |
| `opendota-account.json` | Respostas 200 reais de uma conta pública (2026-11-19): `totals` (`/totals`, 29 campos com `n` e `sum`), `counts` (`/counts`) e duas linhas de recorde (`matches?sort=kills` e `sort=gold_per_min`, `limit=1`). `totals` e `counts` não trazem identificador; o `match_id` dos recordes foi trocado por id fictício. Nenhum número editado | `tests/services/openDotaAccount.test.ts` |
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
