# src/components/dashboard/

A home do jogador: o que aparece quando não há partida selecionada. Todos são montados pelo
`App.tsx`, exceto onde indicado.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `ProfileHeader.tsx` | Avatar, medalha, KPIs de carreira e o botão do espelho de heróis. Usa `getRankTierInfo` | `App.tsx` |
| `MatchList.tsx` | Lista de partidas com filtros e badges de destaque (`getAccumulatedMatchTags`). **Concentra os limiares calibrados da dashboard** | `App.tsx` |
| `MatchContextCell.tsx` | Célula compacta com bracket médio, tamanho do grupo e tipo de fila | `MatchList.tsx` |
| `RecentFormCard.tsx` | Sequência dos últimos jogos (avatar do herói + resultado) e Glint médio das partidas com nota | `App.tsx` |
| `MostPlayedHeroes.tsx` | Top heróis com winrate e KDA (este some na linha com `avgKda` nulo). **Sem nota média por herói** — a lista não traz os insumos do Glint para todas as partidas | `App.tsx` |
| `PerformanceTrendChart.tsx` | Tendência de Glint/winrate/GPM com média móvel (`recharts`). A métrica de Glint (botão e gráfico) some quando nenhuma partida da janela tem nota | `App.tsx` |
| `ActivityHeatmap.tsx` | Heatmap de 30 dias, partidas/dia com winrate | `App.tsx` |
| `StratzTrendsCard.tsx` | Sunburst de heróis por posição, equalizer de Glint e histórico de rota (`echarts`). O sunburst e o histórico de rota **hoje não aparecem** (ver *Glint e o que a lista não traz*). O nome do arquivo é herança | `App.tsx` |
| `StratzTeammatesCard.tsx` | Top companheiros com winrate junto | `App.tsx` |
| `MatchDynamicsOverview.tsx` | Cards de stomp/comeback/even. **Órfão — ninguém importa** | — |
| `TeammatesMatrix.tsx` | Matriz de companheiros com busca. **Órfão — ninguém importa** | — |

## Glint e o que a lista não traz (desde 2026-11-19)

A dashboard recebe o perfil de `services/openDotaProfile.ts`; a STRATZ saiu. O IMP (`imp`) vem
sempre `null` e **nenhum arquivo daqui o lê** — a nota exibida é o **Glint** (`utils/glint.ts`),
experimental, de 0 a 100.

- **Glint nulo esconde, nunca vira 0.** Chip da lista, ponto do gráfico, barra do equalizer e
  tags de nota somem na partida sem nota. Comparar o campo cru é armadilha: `null <= 41` é
  verdadeiro em JS e marcaria "Baixo Impacto" em toda partida sem tabela de percentil — cada
  arquivo estreita para `number | null` uma vez e guarda toda comparação. `|| 0` também não: Glint
  0 é nota.
- **Média só das partidas com nota**, e a tela diz de quantas (`avgGlint` + `glintCount` de
  `computeRecentFormStats`). Sem nenhuma, a métrica some de `ProfileHeader`, `RecentFormCard`,
  `StatRail` e `PerformanceTrendChart`.
- **A procedência fica a um hover.** `GlintBadge` já carrega o tooltip; onde a nota é texto, o
  rótulo leva `t('glintBeta')` e `title={useGlintHint()}`. Nunca escrever "IMP" na tela.
- **O centro da escala é `GLINT_THRESHOLDS.neutral` (48), não 50 nem 0** — linha de referência
  do gráfico e eixo do equalizer, que normaliza cada lado pelo próprio alcance.
- **Limiar de nota vem de `GLINT_THRESHOLDS`, convertido por quantil** (mesma taxa de disparo do
  limiar de IMP que substituiu). Somar 50 ao número antigo está errado: a escala foi comprimida.
  As constantes `GLINT_*` do `MatchList.tsx` trazem a taxa medida em `utils/glint.ts`.
- **O que hoje não aparece, por falta de dado e não por bug:**
  - sunburst de posições, filtro de posição e o "Pos N" da linha — `role` vem `'UNKNOWN'`. A
    versão anterior jogava posição desconhecida em `POSITION_1`; agrupar por `lane` sob rótulo de
    posição seria o mesmo erro com outro nome;
  - badge e histórico de rota — `laneResult` vem `'UNKNOWN'` **mesmo em partida parseada**, então
    o texto "nenhuma partida parseada" seria falso e o KPI some;
  - tags `MVP`/`Top Sup`/`Melhor Core`/`Sem torres perdidas`/participação em abates/fatia de
    dano/ouro em mãos — `award`, `keptAllTowers`, `killParticipationPct`, `damageSharePct` e
    `unspentGold` não vêm. Os atalhos que davam `MVP` e `Top Sup` por nota foram **removidos**, não
    convertidos: prêmio é afirmação sobre os dez jogadores. Não recriar por heurística.

## Regras locais

- **O limiar de tag envelhece em silêncio.** As constantes do topo do `MatchList.tsx`
  (`FARM_GPM`, `KILL_PARTICIPATION_PCT`, `DAMAGE_SHARE_PCT`, `CS_PER_MIN`, `TOWER_DAMAGE`,
  `HERO_HEALING`, `DENIES`, `MAX_LEVEL`, `MARATHON_MIN`, `UNSPENT_GOLD`) carregam **a taxa de disparo medida ao
  lado**, alvo de 5% a 15%. A calibração é de 2026-08-30, 100 partidas reais de bracket 6 (as
  `GLINT_*` têm calibração própria, de 2026-11-19 — seção acima). O valor
  anterior de `FARM_GPM` era `goldPerMinute >= 750` e disparava em 59% das partidas — a mediana da
  amostra é 835. **Refazer a medição antes de mexer; nunca ajustar no olho.**
- Limiar **relativo** (participação em abates, fatia de dano) é preferido ao absoluto: é razão
  sobre o time, então não envelhece quando um patch infla a economia.
- O veredito de rota vem de `utils/laneResult.ts` e só dele. A dashboard já teve um segundo sistema
  que decidia rota por `deaths >= 7 && !isVictory`; não recriar. Hoje a lista **não tem** badge de
  rota: a regra própria (`utils/laneVerdict.ts`) precisa de `networth_t[10]`, que só vem no detalhe
  da partida, e `laneResult` dos resumos fica `UNKNOWN` (Fase 6 do plano: badge só para partida já
  aberta, do cache).
- `getHero`/`getItem` sempre devolvem fallback — herói de patch novo aparece como `Hero #<id>`,
  nunca quebra a lista.

## Ao sair um patch

- O badge `NEW` do `MostPlayedHeroes.tsx` sai de `NEW_HERO_IDS` (`constants/heroes.ts`). Herói
  novo: trocar o id lá; esvaziar o conjunto quando ele deixar de ser novidade.
- Reavaliar a taxa de disparo das tags do `MatchList.tsx` se a economia do jogo mudar — a
  inflação de GPM/patrimônio é exatamente o que matou o `750`.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../utils/CLAUDE.md](../../utils/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
