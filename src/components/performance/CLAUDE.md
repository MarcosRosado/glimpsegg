# src/components/performance/

A aba "Meu jogo" (`MY_GAME`) da partida analisada: o jogo de um jogador, escolhido no seletor
único do cabeçalho da partida.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `PlayerPerformanceTab.tsx` | A aba inteira: cabeçalho do jogador (KDA, Glint, participação, fatias), timer de itens e inventário final, radar de 5 eixos, fase de rotas (veredito com as duas diferenças, patrimônio e xp, e a eficiência de rota), combate, economia, ordem de skills e objetivos | `App.tsx` |
| `ItemUsageList.tsx` | Uso de item ativo (`utils/matchMetrics/itemUsage.ts`), dentro do cartão de itens | `PlayerPerformanceTab.tsx` |
| `DeathCostCard.tsx` | Tempo morto no pior momento (`utils/matchMetrics/deathCost.ts`): só as mortes em que o time perdeu objetivo, com a pior em destaque | `PlayerPerformanceTab.tsx` |

## Regras locais

- **Três números aqui comparam contra constante fixa e saem com `EstimateChip`**: o alvo do timer
  de itens (`ITEM_BENCHMARKS`), o radar (`ROLE_BASELINES`) e a eficiência de rota (ouro aos 10 min
  ÷ 4.948, referência fixa da OpenDota — não é "contra a média", e pode passar de 100%). A
  referência de last hits aos 10 min (`baseline.cs10Min`) leva asterisco e o mesmo aviso no
  `title`. Tirar o selo é regressão de doutrina.
- **Seção sem dado some.** "Dano recebido por tipo", "ordem de skills" e "dano recebido" diziam
  "indisponível"/"sem dado" na 1.0; desde a 2.0 não renderizam sem o dado. O cartão de tempo morto
  some quando nenhuma morte custou objetivo — não há "pior momento" para mostrar.
- **Uso de item tem dois rótulos obrigatórios**: "usos registrados" (trocar o atributo do Power
  Treads conta) e o ritmo como **piso** ("pelo menos N por 10 min"), porque sem hora de venda a
  posse é um teto. Item recomprado mostra só a contagem.
- **O veredito de rota mostra as duas diferenças** (patrimônio e xp, decisão D1 do dono) e o
  tooltip com a regra e a concordância — `utils/laneResult.ts` decide, a tela só escreve.
- Nenhum texto literal no JSX: tudo pelo `t()`, nas duas línguas (a 1.0 tinha "Inventário Final",
  "Mochila", "Neutro" e "Talento Nível" cravados em pt-BR).

## Ao sair um patch

- `deltaSec <= -45` / `>= 60` decide item adiantado/atrasado contra o alvo fixo.
- `ITEM_BENCHMARKS` (`utils/performanceEnricher.ts`) e `ROLE_BASELINES` (`constants/baselines.ts`)
  envelhecem sem erro — por isso o selo de estimativa.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../utils/CLAUDE.md](../../utils/CLAUDE.md)
