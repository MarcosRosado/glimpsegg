# src/components/home/

O Início. Na 2.0 ele saiu da opção A dos wireframes (última partida no topo, tendência na largura
inteira, cards menores embaixo) e, no mesmo dia (2026-11-19), foi refeito a pedido do dono na
disposição da 1.0: **coluna principal larga com as partidas, coluna lateral de cartões pequenos**.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `HomeSection.tsx` | Monta as duas colunas. Principal: `LastMatchCard` e `RecentMatchesCard`. Lateral, por relevância: `RecentFormCard` (com a linha de Glint), `HeroShareCard`, `TeammatesCard`, `ActivityHeatmap` | `App.tsx` |
| `LastMatchCard.tsx` | A última partida numa faixa: herói, resultado, KDA, GPM, duração, Glint, "Abrir partida" e, com `isParsed === false`, o "Pedir análise" com o aviso numa linha abaixo | `HomeSection.tsx` |
| `RecentMatchesCard.tsx` | As 15 partidas seguintes, uma linha cada (herói, resultado, KDA, GPM, Glint, itens, quando) e "Ver todas" para Partidas. Tags e filtros ficam em Partidas | `HomeSection.tsx` |
| `HeroShareCard.tsx` | O anel lateral: heróis das últimas 25 (ou 100) partidas, fatia = partidas, **cor = winrate** numa escala divergente (vermelho, cinza no meio, verde; satura em 25 pontos), cinza abaixo de `HERO_SHARE_MIN_SAMPLE`. Retrato na fatia que comporta, centro com o total ou o herói em foco, legenda em lista com o número exato. Agregação em `utils/heroShare.ts` | `HomeSection.tsx` |
| `HomeSkeleton.tsx` | As duas colunas enquanto o perfil chega (antes aparecia o convite "configure sua conta") | `App.tsx` |
| `useTrendMatches.ts` | As partidas da janela de 100: começa com as 40 do perfil e busca as 100 mais recentes **só quando o jogador escolhe a janela maior** | `HomeSection.tsx`, `account/AccountSection.tsx` |

## Regras locais

- **O anel não divide por posição.** O da 1.0 dividia, e a lista da OpenDota não traz posição
  (`role` é `UNKNOWN`); agrupar por rota sob rótulo de posição seria inventar. A fatia é o herói,
  que vem em toda partida. A cor não identifica o herói (quem identifica é o retrato e a
  legenda), então trocar a janela não "repinta" ninguém pela posição no ranking.
- **Janela nunca maior que a lista.** Os cartões só oferecem a janela que a lista preenche, ou que
  dá para buscar (`canLoadMore`). Até as 100 chegarem, ficam na de 25.
- **A página de 100 é sob demanda, não ao abrir o Início.** Ela dispara uma tabela de percentil
  por herói, e o clique em companheiro abre o Início de outra conta: carregar sem pedido gastaria
  cota da OpenDota a cada conta vista. Partida nova no perfil (o "atualizar") descarta o que veio.
- **`isParsed` ausente não afirma nada.** O cartão só diz "replay não analisado" com
  `isParsed === false`.
- O "Pedir análise" daqui só **abre** a partida com `requestParse`; quem pede é o `App.tsx`, no
  mesmo fluxo do cartão do modo placar. Cada pedido conta como 10 chamadas: nunca dispara sem
  clique.
- Saíram do Início em 2026-11-19: o gráfico de evolução de largura inteira (foi para a Conta), os
  "Heróis principais" da carreira (a seção Heróis cobre, com período) e o cartão "Tendências" com
  barras de Glint por partida (repetia o gráfico).

## Ao sair um patch

Nada aqui muda por patch. Os limiares e o patch dos cards reaproveitados estão em
[`dashboard/CLAUDE.md`](../dashboard/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md)
