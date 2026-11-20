# src/components/account/

A seção Conta (`AppSection` `ACCOUNT`), montada pelo `App.tsx`.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `AccountSection.tsx` | Monta a seção: o `ProfileHeader` (recebido pronto do `App`, que conhece o hero grid), a evolução (`PerformanceTrendChart compact`) e o `AccountStats` com o `QueueRankCard` no topo da coluna direita. Usa `home/useTrendMatches` para as janelas de 50 e 100 | `App.tsx` |
| `AccountStats.tsx` | Totais da carreira (média, soma e a **amostra de cada linha**), recordes que abrem a partida e contagens por lado, lane registrada, modo (por `matchModeKey` sem a fila: nunca "casual" no chute) e patch (`services/openDotaAccount.ts`). Duas colunas: totais à esquerda; o `aside`, recordes e contagens à direita. **Sem totais** (falha ou conta sem dado), `aside` e recordes lado a lado e as contagens na largura inteira: a coluna esquerda vazia era meia tela sem uso | `AccountSection.tsx` |

## Regras locais

- **A evolução mora aqui desde 2026-11-19.** No Início ela ocupava a largura inteira para uma
  linha só, e o dono achou grande demais; lá ficou a linha curta de Glint do cartão de forma.
- **Falha não é conta vazia.** Cada bloco do `AccountStats` some se a chamada dele falhar, e um
  aviso com "tentar de novo" diz que faltou algo. Sem ele, as três chamadas falhando (o caso comum
  sob o limite de uso da OpenDota) deixavam a seção em branco.
- Primeira carga é skeleton no formato das duas colunas; o `aside` (fila e rank, que vem da lista
  do perfil e não dessas chamadas) aparece já durante a carga.

## Ao sair um patch

Nada aqui muda por patch. A contagem por patch lê o catálogo da OpenDota (`fetchPatchCatalog`).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../dashboard/CLAUDE.md](../dashboard/CLAUDE.md)
