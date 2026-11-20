# src/components/account/

A seção Conta (`AppSection` `ACCOUNT`), montada pelo `App.tsx`.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `AccountSection.tsx` | Monta a seção: o `ProfileHeader` (recebido pronto do `App`, que conhece o hero grid), a evolução (`PerformanceTrendChart compact`) e o `AccountStats` com o `QueueRankCard` no topo da coluna direita. Usa `home/useTrendMatches` para as janelas de 50 e 100 | `App.tsx` |
| `AccountStats.tsx` | Totais da carreira (média, soma e a **amostra de cada linha**), recordes que abrem a partida e contagens por lado, lane registrada, modo (por `matchModeKey` sem a fila: nunca "casual" no chute) e patch (`services/openDotaAccount.ts`). Duas colunas: totais à esquerda; o `aside` e os recordes à direita (alturas parecidas). As contagens ficam embaixo, na largura inteira, com as quatro listas lado a lado. **Sem totais** (falha ou conta sem dado), `aside` e recordes lado a lado, com o erro dos totais no topo quando a chamada falhou: a coluna esquerda vazia era meia tela sem uso | `AccountSection.tsx` |

## Regras locais

- **A evolução mora aqui desde 2026-11-19.** No Início ela ocupava a largura inteira para uma
  linha só, e o dono achou grande demais; lá ficou a linha curta de Glint do cartão de forma.
- **Falha não é conta vazia, e cartão não some** (2026-11-20, antes da 2.0). Cada bloco do
  `AccountStats` (totais, recordes, contagens) tem o próprio estado: skeleton no formato dele
  enquanto a chamada não volta, e o cartão com título, mensagem e "tentar de novo" **só daquele
  bloco** se ela falhar. Antes o skeleton era único (sumia quando o primeiro bloco chegava) e o
  bloco que falhava sumia, com um aviso geral no topo. Bloco que carregou **vazio** continua fora
  — não é erro.
- O erro dos totais vai no topo, na largura inteira (layout "sem totais"); numa coluna sozinho,
  deixava meia tela vazia embaixo.
- A evolução e "Fila e rank" vivem da lista de partidas do perfil: com `recentMatchesFailed`, os
  dois mostram o erro, e o "tentar de novo" recarrega o perfil.
- O `aside` (fila e rank, que vem da lista do perfil e não dessas chamadas) aparece já durante a
  carga.

## Ao sair um patch

Nada aqui muda por patch. A contagem por patch lê o catálogo da OpenDota (`fetchPatchCatalog`).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../dashboard/CLAUDE.md](../dashboard/CLAUDE.md)
