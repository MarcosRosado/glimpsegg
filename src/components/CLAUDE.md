# src/components/

Toda a UI, agrupada por tela. Nenhum componente tem teste (o vitest não tem ambiente de DOM) —
o que precisa ser verificado vira função pura em `utils/`.

## Subpastas

| Pasta | O que é | CLAUDE.md |
| --- | --- | --- |
| `auth/` | `OnboardingModal.tsx` — primeira execução: escolhe idioma e informa a conta Steam (ID ou link do perfil, via `resolveSteamId`), com confirmação da conta resolvida antes de salvar. Sem token. No modo `guide`, é a ajuda "como encontrar sua conta" | — |
| `brand/` | Marca in-app: monograma e wordmark | [ver](brand/CLAUDE.md) |
| `coaching/` | `CoachingInsightsTab.tsx` — aba `COACHING`. Renderiza `CoachingInsight[]` com chip de procedência. A recomendação de build está **escondida** desde 2026-11-19 (vinha da STRATZ; ver o comentário no componente e a Fase 5 de `docs/PLANO-OPENDOTA.md`) | — |
| `dashboard/` | Os cards de perfil que Início, Partidas e Conta reaproveitam: lista de partidas, forma, heróis, tendências, companheiros | [ver](dashboard/CLAUDE.md) |
| `heroGrid/` | Painel e réplica do layout espelho de heróis | [ver](heroGrid/CLAUDE.md) |
| `home/` | `LastMatchCard.tsx` — o topo do Início: última partida, estado do replay e o "Pedir análise" (que abre a partida e dispara o pedido). O resto do Início reaproveita cards de `dashboard/` | — |
| `layout/` | A moldura: `Sidebar` (seções) e `Navbar` (topo) | [ver](layout/CLAUDE.md) |
| `match/` | Cabeçalho, abas, seletor de jogador, modo placar e a aba Resumo da partida | [ver](match/CLAUDE.md) |
| `performance/` | `PlayerPerformanceTab.tsx` — aba `MY_GAME` ("Meu jogo"): radar de 5 eixos, stats de combate e farm, timeline de itens, habilidades, objetivos | — |
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
- `performance/PlayerPerformanceTab.tsx` — `deltaSec <= -45` / `>= 60` para item adiantado/atrasado.

Os limiares de destaque da lista de partidas estão em [dashboard/CLAUDE.md](dashboard/CLAUDE.md).
Roteiro completo: [docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md).
