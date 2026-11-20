# src/components/heroes/

A seção Heróis (`AppSection` `HEROES`), montada pelo `App.tsx`.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `HeroesSection.tsx` | Lista por período e patch (`fetchHeroPerformance`): partidas, winrate ("amostra pequena" abaixo de 5), KDA agregado, última vez e o selo `NEW` (`NEW_HERO_IDS`). Ordenável. O clique **escolhe** o herói; o painel ao lado leva a Partidas | `App.tsx` |
| `HeroDetailPanel.tsx` | O herói escolhido: os números da linha e as últimas 8 partidas com ele (uma chamada por herói escolhido, guardada enquanto a tela vive), mais "Ver as partidas de X" | `HeroesSection.tsx` |

## Regras locais

- **Período padrão de 30 dias** (dono, 2026-11-20). Foi "Tudo" por um dia, porque com 3 meses
  quem joga pouco abria a seção com uma linha só. Mas "Tudo" puxa o histórico inteiro: medido numa
  conta de 6.286 partidas, a seção levou 91 s para assentar. Quem joga pouco pode abrir vazio, e o
  aviso de vazio aponta para o filtro.
- **Sem Glint médio na lista.** A lista completa de partidas não traz os insumos da nota, e média
  de uma parte das partidas sob o rótulo do herói inteiro seria número sem procedência. No painel,
  GPM e Glint médios são **só das partidas listadas**, e o rótulo diz quantas.
- Herói escolhido que sai da lista (outro período, busca) cai no primeiro da ordem atual.

## Ao sair um patch

- O selo `NEW` sai de `NEW_HERO_IDS` (`constants/heroes.ts`): trocar o id a cada herói lançado e
  esvaziar quando deixar de ser novidade.

Ver também: [../CLAUDE.md](../CLAUDE.md)
