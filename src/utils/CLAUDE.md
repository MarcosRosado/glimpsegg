# src/utils/

Os motores puros do app: recebem dado já mapeado e devolvem número, discriminante ou chave i18n —
nunca frase pronta, nunca rede. É a única camada de `src/` que o vitest alcança
(`environment: 'node'`, sem DOM), então tudo que precisa de teste acaba aqui. Os testes em si moram
em `tests/utils/`, espelhando esta pasta — ver [../../tests/CLAUDE.md](../../tests/CLAUDE.md).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `awardEngine.ts` | Destaques da partida: `computeMatchAwards` devolve `AwardId` + número cru. `SUPERLATIVES` traz `margin` e `floor` **próprios de cada métrica**; `ROUGH_GAME_MAX_IMP`/`ROUGH_GAME_MIN_LEAD` seguram o prêmio de partida difícil |
| `performance.ts` | `calculateCustomImp` (só quando a STRATZ não devolve IMP — o caso do herói recém-lançado) e `calculateRadarStats`. Ambos ancorados em `ROLE_BASELINES` e multiplicadores fixos |
| `performanceEnricher.ts` | `getEnrichedCombatStats`/`FarmStats`/`AbilityUpgrades` e `getItemBenchmarkSeconds`. Contém `ITEM_BENCHMARKS` |
| `buildAdvisor.ts` | `computeBuildAdvice`: "item de build" = item presente no `itemFullPurchase` daquele herói/posição/ranque. Usa `insights/wilson.ts` |
| `dotaFormatters.ts` | Formatação de duração, ouro, IMP (`IMP_EXTREME`, `formatImp*`, `getImpBadgeStyle`), `resolveMatchType`, `formatGameMode`/`formatLobbyType`, `formatRoleName`/`formatLaneName` |
| `laneResult.ts` | **Ponto único** do rótulo de veredito de rota: `LANE_RESULT_KEY`, `hasLaneVerdict`, `isLaneWin`/`isLaneLoss` |
| `rankBracket.ts` | `tierToBracket`, `resolveBracket` (com `isPlayerSpecific`) e `effectivePosition` |
| `minimapCoords.ts` | `isStratzCell`, `stratzCellToMap`/`ToPercent`/`ToWorld`, `worldToStratzCell`, `cellsToPercent` |
| `recentFormStats.ts` | `computeRecentFormStats` — agregados compartilhados por `StatRail`, `ProfileHeader` e `RecentFormCard` |
| `settingsTabs.ts` | `SETTINGS_TABS`, `tabsWithErrors`, `firstTabWithError` — impede erro escondido em aba fechada |
| `stratzToken.ts` | `extractSteamIdFromStratzToken`: lê o claim `SteamId` do JWT. Nunca logar o token |
| `imageFallback.ts` | Placeholders SVG inline e os `handle*ImageError` |
| `cn.ts` | `cn()` = `twMerge(clsx(...))` |
| `insightsEngine.ts` | **Shim de compatibilidade** para imports antigos de `insights/`. Deve desaparecer |
| `insights/` | Motor de coaching ([CLAUDE.md](insights/CLAUDE.md)) |
| `heroGrid/` | Decisões puras do layout espelho ([CLAUDE.md](heroGrid/CLAUDE.md)) |

## Regras locais

- **Motor decide, UI escreve.** `awardEngine` devolve `AwardId`; `laneResult` devolve
  `TranslationKey`; as regras de coaching devolvem `RuleId` + params crus. Literal em pt-BR dentro
  de um motor já produziu "Desempenho lendario com impacto decisivo" na versão en-US.
- **Superlativo exige margem.** "O primeiro de uma lista" não é destaque: cada entrada de
  `SUPERLATIVES` tem `margin` (mediana da vantagem do 1º sobre o 2º naquela métrica) e `floor`
  (p10 do valor do líder), calibrados sobre 60 partidas reais. Lista vazia é resultado válido. O MVP
  **não sai do IMP** — ver [../../CLAUDE.md](../../CLAUDE.md).
- `minimapCoords`: **quem chama declara o espaço de origem; a função nunca infere.** A versão que
  inferia pela faixa de valores plotava todo o lado Radiant errado.
- Veredito de rota só de `top/mid/bottomLaneOutcome`. Sem outcomes, `UNKNOWN` e a UI **omite** o
  badge — nada de deduzir rota de IMP, mortes ou vitória.
- Nada aqui importa de `components/`. A dependência só vai no sentido UI → utils; onde uma tabela
  precisa existir dos dois lados, ela é duplicada com teste de sincronia (caso de
  `heroGrid/heroTooltip.ts`).

## Navegação: dois nomes que enganam

- **`matchContext.ts` não existe.** `tests/utils/matchContext.test.ts` é teste nomeado por *tema*:
  cobre `resolveMatchType` (de `dotaFormatters.ts`) e `ALL_TOWERS_STANDING`/`derivePartySize`/
  `deriveTeamShares` (de `services/stratzGql.ts`).
- `insightsEngine.ts` não contém motor nenhum — só reexporta `./insights`.

## Ao sair um patch

- `ITEM_BENCHMARKS` (`performanceEnricher.ts`) é `Record<itemId, segundos>` com **itemIds
  literais**. Item removido ou com id refeito perde o benchmark sem erro nenhum, e o valor cai no
  degrau por custo do `getItemBenchmarkSeconds`. **É a tabela mais sensível a patch de toda a
  pasta.**
- `formatGameMode`/`formatLobbyType` traduzem enums da Valve que crescem a cada patch; valor novo
  cai em desconhecido, sem erro. Vale conferir depois de patch grande.
- Os limiares de `SUPERLATIVES` e `ROUGH_GAME_*` envelhecem com a inflação de economia do jogo:
  refazer a medição antes de mexer, nunca ajustar no olho.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../constants/CLAUDE.md](../constants/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
