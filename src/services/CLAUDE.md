# src/services/

Toda a rede do app. Nada aqui renderiza: os módulos buscam, mapeiam e cacheiam. Cada um cobre os
**dois caminhos** (Electron por IPC / browser por `fetch`) — a bifurcação está na doutrina em
[../../CLAUDE.md](../../CLAUDE.md).

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `stratzGql.ts` | O maior. Guarda `GET_PLAYER_PROFILE_QUERY` e `GET_MATCH_DETAILS_QUERY`, `fetchPlayerProfile`, `fetchMatchDetails`, `fetchPlayerPeers` e o mapper puro `mapStratzMatch`. Exporta também `resolvePlayerLaneResult`, `derivePartySize`, `deriveTeamShares` e `ALL_TOWERS_STANDING` | `App.tsx` |
| `stratzHeroStats.ts` | `GET_HERO_BUILD_CONTEXT_QUERY`: `itemFullPurchase` + `heroVsHeroMatchup` num **único** documento sob a raiz `heroStats` (1 request a frio). `fetchHeroBuildContext` trata `RateLimitedError` como caso explícito | `hooks/useBuildAdvice.ts`, `heroGrid/stratzWinrates.ts` |
| `gameVersionService.ts` | Resolvedor de patch em cascata: Steam News → STRATZ (`GetGameVersions` inline) → OpenDota `constants/patch` → GitHub dotaconstants → `CURRENT_GAME_PATCH`. Cache em `localStorage` com TTL de 1h. Expõe `parsePatchVersion`, `comparePatches`, `extractPatchFromTitle`, `getCachedGamePatch`, `fetchLatestGamePatch`, `subscribeToPatchUpdates` | `hooks/useGamePatch.ts`, `statsCache.ts`, `heroGrid/*` |
| `statsCache.ts` | `localStorage` + memória, TTL de 7 dias. `readStatsCache`/`writeStatsCache`/`statsCacheKey`, com poda quando a cota estoura | `stratzHeroStats.ts`, `heroGrid/*Winrates.ts` |
| `opendota.ts` | REST público, sem token: `fetchOpenDotaHeroStats` e `fetchOpenDotaPlayer`. É o **padrão curto** dos dois caminhos de rede | `heroGrid/openDotaWinrates.ts` |
| `steamResolver.ts` | `resolveSteamId`: SteamID64/32 ou vanity URL → conta | `App.tsx`, `settings/SettingsModal.tsx` |
| `visionMapper.ts` | Puro e testado. `buildVisionData`, `emptyVisionData`, `wardsBySlot`, `computePlayerVisionStats`, `observerUptimePct`, `VISION_SOURCE_IS_ESTIMATED` | `stratzGql.ts`, `vision/WardMinimapTab.tsx`, `utils/insights/rules/vision.ts` |
| `heroGrid/` | Fontes de meta e ponte de arquivo do layout espelho ([CLAUDE.md](heroGrid/CLAUDE.md)) | `hooks/useHeroGridSync.ts` |
| `__fixtures__/` | Respostas reais anonimizadas ([CLAUDE.md](__fixtures__/CLAUDE.md)) | os testes |

## Regras locais

- **Falha devolve `null` ou lista vazia, nunca dado fabricado.** `mockData.ts` foi removido de
  propósito. A UI mostra toast; não existe fallback inventado.
- `computeAvailability` é **privada** em `stratzGql.ts` e roda uma vez dentro de `mapStratzMatch`.
  Disponibilidade nunca é adivinhada depois — condição nova vira flag em `MatchDataAvailability`.
- `resolvePlayerLaneResult` recebe **só** lane, lado e outcomes. Não passar sinal de partida.
- `visionMapper.ts` tem precedência explícita de fonte: `PLAYBACK` → `PLAYER_STATS` → `NONE`.
  Nunca inventar ward; `VISION_SOURCE_IS_ESTIMATED` diz à UI quando avisar.
- Host novo exige liberação em três lugares (CSP, allowlist do main, handler IPC). Query nova na
  STRATZ **não** precisa de handler: `api:stratz-graphql` é genérico.

## Ao sair um patch

- **Nenhuma query GraphQL filtra por versão de jogo.** O patch é rótulo na UI e chave de cache — e
  nada mais. Não existe consulta "meta do patch X"; existe agregado atual, invalidado quando o
  patch vira.
- `statsCache.ts` invalida **duro** por patch (`env.patch !== patch`) antes mesmo do TTL de 7 dias.
  Virada de patch limpa a meta em cache sozinha; não há passo manual.
- **Enum novo da STRATZ falha em silêncio.** `mapStratzRole` e `mapStratzLane` caem em `'UNKNOWN'`
  sem lançar erro — deliberado (chutar `POSITION_1` ou `SAFE` produziria veredito errado), mas
  significa que um valor novo de `Role`/`Lane` some sem sinal. `gameMode`/`lobbyType` passam por
  `formatGameMode`/`formatLobbyType` em `utils/dotaFormatters.ts`, que também são mudos, de outro
  jeito: valor desconhecido vira o próprio enum formatado (`ABILITY_DRAFT` → "Ability Draft"), e
  **entrada vazia** vira o palpite `"All Pick Ranqueado"` / `"Ranqueada"`. Modo ou papel novo ⇒
  conferir estes quatro pontos.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../types/CLAUDE.md](../types/CLAUDE.md) ·
[../hooks/CLAUDE.md](../hooks/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
