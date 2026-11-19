# src/utils/

Os motores puros do app: recebem dado já mapeado e devolvem número, discriminante ou chave i18n —
nunca frase pronta, nunca rede. É a única camada de `src/` que o vitest alcança
(`environment: 'node'`, sem DOM), então tudo que precisa de teste acaba aqui. Os testes em si moram
em `tests/utils/`, espelhando esta pasta — ver [../../tests/CLAUDE.md](../../tests/CLAUDE.md).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `awardEngine.ts` | Destaques da partida: `computeMatchAwards` devolve `AwardId` + número cru. `SUPERLATIVES` traz `margin` e `floor` **próprios de cada métrica**; `ROUGH_GAME_MAX_GLINT`/`ROUGH_GAME_MIN_LEAD_GLINT` seguram o prêmio de partida difícil. `resolveScoreKind` diz se a partida tem nota (`GLINT`) ou não (`null`) — e sem nota os prêmios que dependem dela são omitidos. A escala `IMP` saiu em 2026-11-19 |
| `glint.ts` | **A nota de impacto do app, experimental.** `computeGlint` (regressão sobre oito percentis da OpenDota), `GLINT_MODEL` (pesos + métricas do teste), `GLINT_THRESHOLDS` (por quantil), `percentileFromTable`/`glintPercentilesFromRaw` (o caminho da lista de partidas) e os formatadores `formatGlint`/`getGlintColor`/`getGlintBadgeStyle`. Pesos e limiares saem de `scripts/fit-glint-experimental.cjs` |
| `performance.ts` | `calculateRadarStats`, ancorado em `ROLE_BASELINES` e multiplicadores fixos. O `calculateCustomImp` saiu em 2026-11-19 com o mapper da STRATZ |
| `performanceEnricher.ts` | `getEnrichedCombatStats`/`FarmStats`/`AbilityUpgrades` e `getItemBenchmarkSeconds`. Contém `ITEM_BENCHMARKS` |
| `buildAdvisor.ts` | `computeBuildAdvice`: "item de build" = item presente no `itemFullPurchase` daquele herói/posição/ranque. Usa `insights/wilson.ts` |
| `dotaFormatters.ts` | Formatação de duração, ouro, `resolveMatchType`, `matchModeKey`/`lobbyTypeKey` (modo e fila como **chave de tradução**; vazio é `null`, desconhecido sai com o id), `formatRoleName`/`formatLaneName`. Os formatadores de IMP saíram em 2026-11-19 (o IMP não existe mais no app) |
| `laneResult.ts` | **Ponto único** do rótulo de veredito de rota: `LANE_RESULT_KEY`, `hasLaneVerdict`, `isLaneWin`/`isLaneLoss` e `laneVerdictView` (o que a tela mostra: veredito com a diferença da rota, "Vantagem aos 10 min" em rota desigual, ou `null` para omitir) |
| `laneVerdict.ts` | **O veredito de rota próprio (Fase 3).** `measureLanes` (patrimônio e xp aos 10 min, média por herói, média das duas diferenças relativas com o mesmo peso — o xp é decisão do dono, D1), `laneOutcomesFrom`, `resolvePlayerLaneResult` (rota geográfica, lado, outcomes — nada mais) e `playerLaneAdvantage` (as duas diferenças, `networthDiff` e `xpDiff`, mais o `score` do lado do jogador). `LANE_VERDICT_MODEL` traz limiares e aceite; sai de `scripts/fit-lane-verdict.cjs` |
| `navigation.ts` | `initialMatchView` (slot e aba inicial: "Meu jogo" só quando o slot achado é da conta configurada e a partida foi analisada) e `classifySearchInput` (Ctrl+K: link de partida ou id acima de 32 bits é partida; número que cabe em 32 bits é conta com a partida oferecida, nunca adivinhada). Testado em `tests/utils/navigation.test.ts` |
| `rankBracket.ts` | `tierToBracket`, `resolveBracket` (com `isPlayerSpecific`) e `effectivePosition` |
| `minimapCoords.ts` | `isStratzCell`, `stratzCellToMap`/`ToPercent`/`ToWorld`, `worldToStratzCell`, `cellsToPercent` |
| `heroShare.ts` | `summarizeHeroShare` (heróis de uma lista de partidas, do mais jogado ao menos, com "outros" acima do teto de fatias; Glint só das partidas com nota) e `winRateTilt` (posição na escala divergente do anel do Início; `null` abaixo de `HERO_SHARE_MIN_SAMPLE`, porque com 1 ou 2 partidas o winrate só pode ser 0, 50 ou 100%) |
| `recentFormStats.ts` | `computeRecentFormStats` — agregados compartilhados por `ProfileHeader` e `RecentFormCard`. `avgGlint` é a média **só das partidas com nota** (`null` se nenhuma tem) e `glintCount` diz quantas entraram; não há mais `avgImp` |
| `settingsTabs.ts` | `SETTINGS_TABS`, `tabsWithErrors`, `firstTabWithError` — impede erro escondido em aba fechada |
| `imageFallback.ts` | Placeholders SVG inline e os `handle*ImageError` |
| `legacyStorage.ts` | `LOCAL_STORAGE_KEYS` (`glimpsegg_steam_id`, `glimpsegg_profile_history`) e `migrateLegacyLocalStorage`: copia as chaves `stratz_*` uma vez, nunca toca em `stratz_api_key`, nunca lança. Caminho browser; o par no Electron é `electron/configMigration.cjs` |
| `cn.ts` | `cn()` = `twMerge(clsx(...))` |
| `insightsEngine.ts` | **Shim de compatibilidade** para imports antigos de `insights/`. Deve desaparecer |
| `matchMetrics/` | **Métricas novas da 2.0** (§4 da proposta), puras sobre `MatchDetails`, versão **descritiva**: contagens e somas cruas, sem rótulo de "venceu"/"converteu" até haver taxa de disparo medida. `fights.ts`: `summarizeFights` (por luta, os dois lados e os objetivos até a luta seguinte). `deathCost.ts`: `playerDeathCosts` (por morte, os objetivos que o adversário levou com o jogador fora — janela cortada no buyback; sem respawn visto, aberta até o fim). `itemUsage.ts`: `activeItemUsage` (usos por item e ritmo por 10 min sobre o **teto** de posse — não há hora de venda, então o ritmo é **piso**; item recomprado ou sem compra sai sem ritmo; a OpenDota conta troca de Power Treads como uso). `turningPoint.ts`: `turningPoint` (maior deficit do vencedor, o minuto dele e o minuto a partir do qual liderou de vez; `isComeback` só a partir do piso de `TURNING_POINT_MODEL`, que sai de `scripts/fit-turning-point.cjs` por taxa de 10%). `laneEfficiency.ts`: `laneEfficiency` (o `lane_efficiency` da OpenDota com a base declarada — ouro aos 10 min sobre a **referência fixa** de 4.948, não contra herói, posição nem ranque) |
| `insights/` | Motor de coaching ([CLAUDE.md](insights/CLAUDE.md)) |
| `heroGrid/` | Decisões puras do layout espelho ([CLAUDE.md](heroGrid/CLAUDE.md)) |

## Regras locais

- **Motor decide, UI escreve.** `awardEngine` devolve `AwardId`; `laneResult` devolve
  `TranslationKey`; as regras de coaching devolvem `RuleId` + params crus. Literal em pt-BR dentro
  de um motor já produziu "Desempenho lendario com impacto decisivo" na versão en-US.
- **Superlativo exige margem.** "O primeiro de uma lista" não é destaque: cada entrada de
  `SUPERLATIVES` tem `margin` (mediana da vantagem do 1º sobre o 2º naquela métrica) e `floor`
  (p10 do valor do líder), calibrados sobre 60 partidas reais. Lista vazia é resultado válido. O MVP
  **não sai da nota** (nem do IMP de antes, nem do Glint de hoje) — ver [../../CLAUDE.md](../../CLAUDE.md).
- `minimapCoords`: **quem chama declara o espaço de origem; a função nunca infere.** A versão que
  inferia pela faixa de valores plotava todo o lado Radiant errado.
- **Glint nunca sem rótulo de experimental, e nunca `0` no lugar de `null`.** Limiar novo sai por
  quantil do script de ajuste, não somando 50 a um limiar de IMP — a escala é comprimida.
- **Veredito de rota só de dado dos 10 primeiros minutos de quem estava na rota** (`laneVerdict.ts`).
  Rota sem medida fica `UNKNOWN` e a UI **omite** a seção; rota desigual nunca vira "Rota vencida"
  (não passou no aceite) — nada de deduzir rota de Glint, mortes ou vitória. Limiar novo sai do
  script de ajuste, por taxa de disparo, e se o aceite cair muda o rótulo, não o limiar.
- Nada aqui importa de `components/`. A dependência só vai no sentido UI → utils; onde uma tabela
  precisa existir dos dois lados, ela é duplicada com teste de sincronia (caso de
  `heroGrid/heroTooltip.ts`).

## Navegação: um nome que engana

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
