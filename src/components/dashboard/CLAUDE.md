# src/components/dashboard/

A home do jogador: o que aparece quando não há partida selecionada. Todos são montados pelo
`App.tsx`, exceto onde indicado.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `ProfileHeader.tsx` | Avatar, medalha, KPIs de carreira e o botão do espelho de heróis. Usa `getRankTierInfo` | `App.tsx` |
| `MatchList.tsx` | Lista de partidas com filtros e badges de destaque (`getAccumulatedMatchTags`). **Concentra os limiares calibrados da dashboard** | `App.tsx` |
| `MatchContextCell.tsx` | Célula compacta com bracket médio, tamanho do grupo e tipo de fila | `MatchList.tsx` |
| `RecentFormCard.tsx` | Sequência dos últimos jogos (avatar do herói + resultado) | `App.tsx` |
| `MostPlayedHeroes.tsx` | Top heróis com winrate, KDA e IMP | `App.tsx` |
| `PerformanceTrendChart.tsx` | Tendência de IMP/winrate/GPM com média móvel (`recharts`) | `App.tsx` |
| `ActivityHeatmap.tsx` | Heatmap de 30 dias, partidas/dia com winrate | `App.tsx` |
| `StratzTrendsCard.tsx` | Sunburst de heróis por posição, equalizer de IMP e histórico de rota (`echarts`) | `App.tsx` |
| `StratzTeammatesCard.tsx` | Top companheiros com winrate junto | `App.tsx` |
| `MatchDynamicsOverview.tsx` | Cards de stomp/comeback/even. **Órfão — ninguém importa** | — |
| `TeammatesMatrix.tsx` | Matriz de companheiros com busca. **Órfão — ninguém importa** | — |

## Regras locais

- **O limiar de tag envelhece em silêncio.** As constantes do topo do `MatchList.tsx`
  (`FARM_GPM`, `KILL_PARTICIPATION_PCT`, `DAMAGE_SHARE_PCT`, `CS_PER_MIN`, `TOWER_DAMAGE`,
  `HERO_HEALING`, `DENIES`, `MAX_LEVEL`, `MARATHON_MIN`, `UNSPENT_GOLD`) carregam **a taxa de disparo medida ao
  lado**, alvo de 5% a 15%. A calibração é de 2026-08-30, 100 partidas reais de bracket 6. O valor
  anterior de `FARM_GPM` era `goldPerMinute >= 750` e disparava em 59% das partidas — a mediana da
  amostra é 835. **Refazer a medição antes de mexer; nunca ajustar no olho.**
- Limiar **relativo** (participação em abates, fatia de dano) é preferido ao absoluto: é razão
  sobre o time, então não envelhece quando um patch infla a economia.
- O veredito de rota vem de `utils/laneResult.ts` e só dele. A dashboard já teve um segundo sistema
  que decidia rota por `deaths >= 7 && !isVictory`; não recriar.
- `getHero`/`getItem` sempre devolvem fallback — herói de patch novo aparece como `Hero #<id>`,
  nunca quebra a lista.

## Ao sair um patch

- `MostPlayedHeroes.tsx` tem os heroId **145** e **131** cravados para o badge `NEW`. Herói novo
  não ganha o selo, e esses dois seguem marcados como novos para sempre. Atualizar ou remover.
- Reavaliar a taxa de disparo das tags do `MatchList.tsx` se a economia do jogo mudar — a
  inflação de GPM/patrimônio é exatamente o que matou o `750`.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../utils/CLAUDE.md](../../utils/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
