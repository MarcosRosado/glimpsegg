# src/components/home/

O Início da 2.0 (docs/PROPOSTA-V2.md §3.2, opção A dos wireframes, escolha do dono): a última
partida no topo, depois forma e tendência, por último os cards menores.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `HomeSection.tsx` | Monta o Início com os cards de `dashboard/` (forma, tendência, heróis, atividade, companheiros) e o `LastMatchCard` | `App.tsx` |
| `LastMatchCard.tsx` | A última partida, com o estado do replay quando a lista o sabe (`isParsed`) e o "Pedir análise", que abre a partida e dispara o pedido | `HomeSection.tsx` |
| `useTrendMatches.ts` | As partidas da tendência: começa com as 40 do perfil e busca as 100 mais recentes **só quando o jogador escolhe a janela de 50 ou 100** | `HomeSection.tsx` |

## Regras locais

- **Janela de tendência nunca maior que a lista.** `PerformanceTrendChart` e `TrendsCard` só
  oferecem a janela que a lista preenche, ou que dá para buscar (`canLoadMore`). Até as 100
  chegarem, o gráfico fica na janela de 25. Na 1.0, "100 jogos" desenhava as mesmas 40.
- **A página de 100 é sob demanda, não ao abrir o Início.** Ela dispara uma tabela de percentil
  por herói, e o clique em companheiro abre o Início de outra conta: carregar sem pedido gastaria
  cota da OpenDota a cada conta vista. Partida nova no perfil (o "atualizar") descarta o que veio,
  para a tendência nunca ficar atrás do cartão de última partida.
- **`isParsed` ausente não afirma nada.** O cartão só diz "replay não analisado" com
  `isParsed === false`.
- O "Pedir análise" daqui só **abre** a partida com `requestParse`; quem pede é o `App.tsx`, no
  mesmo fluxo do cartão do modo placar. Cada pedido conta como 10 chamadas: nunca dispara sem
  clique.

## Ao sair um patch

Nada aqui muda por patch. Os limiares e o patch dos cards reaproveitados estão em
[`dashboard/CLAUDE.md`](../dashboard/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md)
