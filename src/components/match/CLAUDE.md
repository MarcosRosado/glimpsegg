# src/components/match/

A aba `OVERVIEW` da análise de partida. Todos montados pelo `App.tsx` quando há `selectedMatch`.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `MatchHeader.tsx` | Cabeçalho: placar, duração e o veredito de forma da partida vindo da STRATZ |
| `TeamOverviewCard.tsx` | Pódio de destaques (MVP, melhor core, melhor suporte, superlativos) e comparativo entre times |
| `AdvantageTimeline.tsx` | Curva de vantagem de ouro e XP (`recharts`) |
| `ScoreboardTable.tsx` | Tabela dos 10 jogadores com itens e tempo de compra |

## Regras locais

- **O texto dos prêmios mora aqui, o cálculo não.** `AWARD_LABEL`, `AWARD_STYLE`, `AWARD_VALUE` e
  `AWARD_HINT` estão no `TeamOverviewCard.tsx`; as margens, os pisos e a escolha do MVP estão em
  [`utils/awardEngine.ts`](../../utils/CLAUDE.md). O engine já teve os títulos cravados em pt-BR
  dentro dele, e a versão en-US exibia português.
- **Número sem métrica não informa.** Todo valor de prêmio sai por template de i18n (`AWARD_VALUE`),
  e todo selo tem tooltip com o critério (`AWARD_HINT`).
- **Lista de destaques vazia é resultado válido.** Superlativo exige margem sobre o segundo
  colocado; "o primeiro de uma lista empatada" não é destaque.
- `ScoreboardTable.tsx` filtra consumível por `GENERIC_CONSUMABLES` (conjunto de nomes `item_*`)
  mais qualquer `item_recipe_*`, e trata `cost >= 1800` como "item core".

## Ao sair um patch

- `GENERIC_CONSUMABLES` é lista de nomes literais: consumível novo (ou renomeado) passa a aparecer
  como item de build no scoreboard.
- `cost >= 1800` é preço, não conceito — rebalanço de custo de item muda o que conta como core.
- As margens dos superlativos foram calibradas sobre 60 partidas reais; mudança grande de economia
  ou de duração média de jogo pede remedição em `utils/awardEngine.ts`.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
