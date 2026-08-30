# src/components/

Toda a UI, agrupada por tela. Nenhum componente tem teste (o vitest não tem ambiente de DOM) —
o que precisa ser verificado vira função pura em `utils/`.

## Subpastas

| Pasta | O que é | CLAUDE.md |
| --- | --- | --- |
| `auth/` | `OnboardingModal.tsx` — primeira execução: cola o token da STRATZ, extrai o SteamID dele, escolhe idioma | — |
| `brand/` | Marca in-app: monograma e wordmark | [ver](brand/CLAUDE.md) |
| `coaching/` | `CoachingInsightsTab.tsx` — aba `COACHING`. Renderiza `CoachingInsight[]` com chip de procedência e aciona `useBuildAdvice` | — |
| `dashboard/` | A home do jogador: perfil, lista de partidas, heróis, tendências | [ver](dashboard/CLAUDE.md) |
| `heroGrid/` | Painel e réplica do layout espelho de heróis | [ver](heroGrid/CLAUDE.md) |
| `layout/` | Chrome do app: `Navbar` e `StatRail` | [ver](layout/CLAUDE.md) |
| `match/` | Aba `OVERVIEW` da partida | [ver](match/CLAUDE.md) |
| `performance/` | `PlayerPerformanceTab.tsx` — aba `PERFORMANCE`: radar de 5 eixos, stats de combate e farm, timeline de itens, habilidades, objetivos | — |
| `search/` | `SearchPlayerModal.tsx` — busca de jogador (Ctrl+K), histórico e favoritos | — |
| `settings/` | `SettingsModal.tsx` — o maior componente do projeto: token, SteamID, idioma e toda a configuração do hero grid | — |
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
- Componentes que hoje **ninguém importa**: `dashboard/MatchDynamicsOverview.tsx` e
  `dashboard/TeammatesMatrix.tsx`. Não são ponto de partida para nada.

## Ao sair um patch

Três lugares na UI têm dado de Dota cravado, e nenhum deles quebra visivelmente quando envelhece:

- `dashboard/MostPlayedHeroes.tsx` — badge `NEW` com os heroId **145** e **131** literais no JSX.
- `match/ScoreboardTable.tsx` — `GENERIC_CONSUMABLES` (nomes `item_*`) e o corte `cost >= 1800`
  que define "item core".
- `performance/PlayerPerformanceTab.tsx` — `deltaSec <= -45` / `>= 60` para item adiantado/atrasado.

Os limiares de destaque da lista de partidas estão em [dashboard/CLAUDE.md](dashboard/CLAUDE.md).
Roteiro completo: [docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md).
