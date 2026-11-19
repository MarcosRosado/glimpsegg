# src/components/

Toda a UI, agrupada por tela. Nenhum componente tem teste (o vitest não tem ambiente de DOM) —
o que precisa ser verificado vira função pura em `utils/`.

## Subpastas

| Pasta | O que é | CLAUDE.md |
| --- | --- | --- |
| `account/` | `AccountStats.tsx` — seção Conta: totais da carreira (média, soma e a **amostra de cada linha**), recordes que abrem a partida e contagens por lado, rota registrada, modo (por `matchModeKey` sem a fila: nunca "casual" no chute) e patch (`services/openDotaAccount.ts`) | — |
| `auth/` | `OnboardingModal.tsx` — primeira execução: escolhe idioma e informa a conta Steam (ID ou link do perfil, via `resolveSteamId`), com confirmação da conta resolvida antes de salvar. Sem token. No modo `guide`, é a ajuda "como encontrar sua conta" | — |
| `brand/` | Marca in-app: monograma e wordmark | [ver](brand/CLAUDE.md) |
| `coaching/` | `CoachingInsightsTab.tsx` — aba `COACHING`. Renderiza `CoachingInsight[]` com chip de procedência. A recomendação de build está **escondida** desde 2026-11-19 (vinha da STRATZ; ver o comentário no componente e a Fase 5 de `docs/PLANO-OPENDOTA.md`), e desde a 2.0 a aba diz isso numa nota ("Fora desta versão") em vez de silêncio | — |
| `dashboard/` | Os cards de perfil que Início, Partidas e Conta reaproveitam: lista de partidas, forma, heróis, tendências, companheiros | [ver](dashboard/CLAUDE.md) |
| `filters/` | `PeriodPatchFilter.tsx` — período (30 dias, 3 meses, 1 ano, tudo) e patch, compartilhado por Partidas e Heróis, mais `usePatchWindows` e `toMatchFilters`. Só monta o filtro: quem contorna o `?patch=` que não conhece o patch novo é o serviço | — |
| `heroes/` | `HeroesSection.tsx` — seção Heróis: partidas, winrate ("amostra pequena" abaixo de 5), KDA agregado e última vez, por período e patch. **Sem Glint médio** — a lista completa não traz os insumos da nota. O clique abre Partidas filtrada | — |
| `heroGrid/` | Painel e réplica do layout espelho de heróis | [ver](heroGrid/CLAUDE.md) |
| `home/` | O Início: `HomeSection.tsx` (última partida, forma, tendência e os cards menores), `LastMatchCard.tsx` (estado do replay e o "Pedir análise", que abre a partida e dispara o pedido) e `useTrendMatches.ts` (as 100 partidas mais recentes para as janelas de 50 e 100 da tendência serem reais; sem elas, os gráficos só oferecem as janelas que a lista preenche) | [ver](home/CLAUDE.md) |
| `layout/` | A moldura: `Sidebar` (seções) e `Navbar` (topo) | [ver](layout/CLAUDE.md) |
| `matches/` | `MatchesSection.tsx` — seção Partidas: o `MatchList` com período, patch e herói no servidor (o clique em Heróis traz período e patch junto) e "carregar mais" além das 40. O offset conta páginas da lista crua (o corte local por patch encurta páginas); falha de rede mostra erro com "tentar de novo", nunca "fim da lista" | — |
| `match/` | Cabeçalho, abas, seletor de jogador, modo placar e a aba Resumo da partida | [ver](match/CLAUDE.md) |
| `performance/` | A aba "Meu jogo": desempenho de um jogador, uso de item ativo e tempo morto | [ver](performance/CLAUDE.md) |
| `search/` | `SearchPlayerModal.tsx` — busca (Ctrl+K) de conta **ou partida** (`classifySearchInput`; o número ambíguo ganha a opção "abrir como partida"), histórico e favoritos | — |
| `settings/` | `SettingsModal.tsx` — o maior componente do projeto: conta Steam, idioma e toda a configuração do hero grid | — |
| `ui/` | Primitivos compartilhados | [ver](ui/CLAUDE.md) |
| `vision/` | `WardMinimapTab.tsx` — aba `VISION`: wards sobre o minimapa, filtros, cobertura | — |

As pastas sem CLAUDE.md próprio têm um arquivo só; a linha acima é a documentação delas.

## Regras locais

- **Texto nunca é literal no JSX.** Tudo passa por `t()` do `LanguageContext`, e chave nunca é
  montada em runtime — tabela dinâmica é `Record<..., TranslationKey>` com literais.
- **Rótulo e cor moram na UI; número e decisão moram no motor.** `awardEngine` devolve `AwardId` +
  valor cru, e `AWARD_LABEL`/`AWARD_STYLE`/`AWARD_VALUE`/`AWARD_HINT` vivem em
  `match/TeamOverviewCard.tsx`. O mesmo vale para as regras de coaching (`RULE_TEXT` → i18n).
- **Dado ausente esconde a seção.** Nenhum componente estima para preencher lacuna; quem manda é
  `MatchDataAvailability` e o `BenchmarkSource` do valor.
- Os dois componentes que ninguém importava (`dashboard/MatchDynamicsOverview.tsx` e
  `dashboard/TeammatesMatrix.tsx`) foram apagados nos renomes da 2.0, com as dez chaves de
  tradução que só eles usavam.

## Ao sair um patch

Três lugares na UI têm dado de Dota cravado, e nenhum deles quebra visivelmente quando envelhece:

- `dashboard/MostPlayedHeroes.tsx` — badge `NEW` lê `NEW_HERO_IDS` de `constants/heroes.ts`.
- `match/ScoreboardTable.tsx` — `GENERIC_CONSUMABLES` (nomes `item_*`) e o corte `cost >= 1800`
  que define "item core".
- `performance/PlayerPerformanceTab.tsx` — `deltaSec <= -45` / `>= 60` para item adiantado/atrasado (ver [performance/CLAUDE.md](performance/CLAUDE.md)).

Os limiares de destaque da lista de partidas estão em [dashboard/CLAUDE.md](dashboard/CLAUDE.md).
Roteiro completo: [docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md).
