# src/components/match/

A partida aberta: cabeçalho, as duas formas (modo placar e analisada) e a aba Resumo. Todos
montados pelo `App.tsx` quando há `selectedMatch`.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `MatchHeader.tsx` | Cabeçalho: placar, duração e o veredito de forma da partida (`analysisOutcome`, que a OpenDota não tem — some quando nulo) |
| `ParseRequestCard.tsx` | O cartão do **modo placar**: o que a análise libera (só o que de fato aparece depois), o botão "Pedir análise do replay" e o estado da espera ao lado. Guarda `ParseState` e `PARSE_POLL_DELAYS_MS` (recuo e teto). Substituiu o `ParsePendingBanner`, que ficava por cima da tela analisada |
| `MatchTabs.tsx` | A fileira de abas da partida analisada. Recebe só as abas que existem: aba sem dado não aparece desabilitada |
| `MatchPlayerPicker.tsx` | O seletor de jogador único, fixo ao lado das abas (`<select>` nativo, agrupado por lado, "(você)" na conta configurada) |
| `TeamOverviewCard.tsx` | Pódio de destaques (MVP, melhor core, melhor suporte, superlativos), melhor por posição e comparativo entre times. `variant="scoreboard"` mostra só os destaques de papel |
| `AdvantageTimeline.tsx` | Curva de vantagem de ouro e XP (`recharts`) |
| `TurningPointNote.tsx` | Nota acima da curva: o maior déficit do vencedor (`utils/matchMetrics/turningPoint.ts`). Só diz "Virada" com `isComeback` (piso medido por taxa de disparo, no `title`); vencedor que nunca esteve atrás some |
| `FightsTab.tsx` | Aba "Lutas" (`summarizeFights`): por luta, mortes, buybacks, ouro e xp de cada lado, o que o jogador fez e os objetivos até a luta seguinte. Só existe com `availability.teamfights` |
| `objectiveLabels.ts` | `OBJECTIVE_LABEL`: rótulo i18n de cada tipo de objetivo, usado por Lutas e pelo cartão de tempo morto |
| `ScoreboardTable.tsx` | Tabela dos 10 jogadores com itens e tempo de compra |

## Regras locais

- **O texto dos prêmios mora aqui, o cálculo não.** `AWARD_LABEL`, `AWARD_STYLE`, `AWARD_VALUE` e
  `AWARD_HINT` estão no `TeamOverviewCard.tsx`; as margens, os pisos e a escolha do MVP estão em
  [`utils/awardEngine.ts`](../../utils/CLAUDE.md). O engine já teve os títulos cravados em pt-BR
  dentro dele, e a versão en-US exibia português.
- **Número sem métrica não informa.** Todo valor de prêmio sai por template de i18n (`AWARD_VALUE`),
  e todo selo tem tooltip com o critério (`AWARD_HINT`).
- **A nota dos prêmios de papel é o Glint experimental**, formatado por `SCORE_VALUE` conforme a
  unidade do prêmio (`GLINT`, ou `NONE` sem número; a escala `IMP` saiu em 2026-11-19). O `title` com a procedência
  (`useGlintHint`) acompanha a nota; a coluna do placar só existe quando a partida tem nota.
- **Lista de destaques vazia é resultado válido.** Superlativo exige margem sobre o segundo
  colocado; "o primeiro de uma lista empatada" não é destaque.
- **Lutas é descritiva.** Não existe "luta vencida" nem "convertida": nenhum limiar foi medido.
  A tela põe os números dos dois lados juntos. A OpenDota lista os 10 jogadores em toda luta, então
  a coluna do jogador diz "Morreu"/"Não morreu", nunca "participou".
- **Modo placar é recorte, não aviso.** Sem análise, `TeamOverviewCard` sai em `scoreboard` e o
  placar perde o botão "Ver análise completa" (`onNavigateToPerformance` ausente): a aba que ele
  abriria não existe. No placar, posição `UNKNOWN` e log de compras vazio somem — nem a moldura
  da célula fica.
- `ScoreboardTable.tsx` filtra consumível por `GENERIC_CONSUMABLES` (conjunto de nomes `item_*`)
  mais qualquer `item_recipe_*`, e trata `cost >= 1800` como "item core".

## Ao sair um patch

- `GENERIC_CONSUMABLES` é lista de nomes literais: consumível novo (ou renomeado) passa a aparecer
  como item de build no scoreboard.
- `cost >= 1800` é preço, não conceito — rebalanço de custo de item muda o que conta como core.
- As margens dos superlativos foram calibradas sobre 60 partidas reais; mudança grande de economia
  ou de duração média de jogo pede remedição em `utils/awardEngine.ts`.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
