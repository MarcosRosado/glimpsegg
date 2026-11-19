# src/services/

Toda a rede do app. Nada aqui renderiza: os módulos buscam, mapeiam e cacheiam. Cada um cobre os
**dois caminhos** (Electron por IPC / browser por `fetch`) — a bifurcação está na doutrina em
[../../CLAUDE.md](../../CLAUDE.md).

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `gameVersionService.ts` | Resolvedor de patch em cascata: Steam News → OpenDota `constants/patch` → GitHub dotaconstants → `CURRENT_GAME_PATCH` (o degrau da STRATZ e o parâmetro `token` saíram em 2026-11-19). Cache em `localStorage` com TTL de 1h. Expõe `parsePatchVersion`, `comparePatches`, `extractPatchFromTitle`, `getCachedGamePatch`, `fetchLatestGamePatch`, `subscribeToPatchUpdates` | `hooks/useGamePatch.ts`, `statsCache.ts`, `heroGrid/openDotaWinrates.ts`, `hooks/useHeroGridSync.ts` |
| `statsCache.ts` | `localStorage` + memória, TTL de 7 dias. `readStatsCache`/`writeStatsCache`/`statsCacheKey`, com poda quando a cota estoura | `heroGrid/openDotaWinrates.ts` |
| `openDotaProfile.ts` | **A dashboard inteira.** `fetchPlayerProfile` (perfil, vitórias, 40 partidas recentes, heróis mais jogados, companheiros), `fetchHeroBenchmarkTable` (tabela de percentis por herói, cache de 7 dias) e os mappers puros `mapOpenDotaProfile`, `mapOpenDotaPlayerMatch`, `mapMostPlayedHeroes`, `mapOpenDotaPeers`, `classifyMatchDynamic`. O cabeçalho lista o que a lista de partidas **não** tem | `App.tsx` |
| `openDotaMatch.ts` | **O detalhe da partida.** Mapper puro `mapOpenDotaMatch` (o único mapper de partida desde a etapa 2), `isOpenDotaMatchParsed`, `fetchOpenDotaMatchDetails` e `requestOpenDotaParse` (`POST /request/{id}`), os dois últimos nos dois caminhos de rede. O cabeçalho do arquivo lista o que a OpenDota **não** tem e fica desligado | `App.tsx` |
| `opendota.ts` | REST público, sem token. `openDotaGet(endpoint)` é **o** ponto dos dois caminhos de rede (IPC / `fetch`), `null` em falha; mais `fetchOpenDotaHeroStats` e `fetchOpenDotaPlayer` | `heroGrid/openDotaWinrates.ts` |
| `steamResolver.ts` | `resolveSteamId`: SteamID64/32 ou vanity URL → conta | `App.tsx`, `settings/SettingsModal.tsx` |
| `visionMapper.ts` | Puro e testado. `buildVisionData` (formato da STRATZ; sem consumidor no app desde a etapa 2, fica pelos testes de `observerUptimePct`), `emptyVisionData`, `wardsBySlot`, `computePlayerVisionStats`, `observerUptimePct`, `VISION_SOURCE_IS_ESTIMATED` | `openDotaMatch.ts`, `vision/WardMinimapTab.tsx`, `utils/insights/rules/vision.ts` |
| `heroGrid/` | Fontes de meta e ponte de arquivo do layout espelho ([CLAUDE.md](heroGrid/CLAUDE.md)) | `hooks/useHeroGridSync.ts` |
| `__fixtures__/` | Respostas reais anonimizadas ([CLAUDE.md](__fixtures__/CLAUDE.md)) | os testes |

## Regras locais

- **Falha devolve `null` ou lista vazia, nunca dado fabricado.** `mockData.ts` foi removido de
  propósito. A UI mostra toast; não existe fallback inventado.
- A disponibilidade é calculada **uma vez**, dentro de `mapOpenDotaMatch`. Nunca é adivinhada
  depois — condição nova vira flag em `MatchDataAvailability`.
- O veredito de rota é **chamado** daqui, não calculado: `mapOpenDotaMatch` passa ao
  `utils/laneVerdict.ts` só o campo `lane`, o lado e `networth_t[10]` de cada jogador.
  `resolvePlayerLaneResult` recebe **só** rota, lado e outcomes. Não passar sinal de partida.
- `visionMapper.ts` tem precedência explícita de fonte: `PLAYBACK` → `PLAYER_STATS` → `NONE`.
  Nunca inventar ward; `VISION_SOURCE_IS_ESTIMATED` diz à UI quando avisar.
- **`mapOpenDotaMatch` não estima o que falta.** O que a OpenDota não tem vira flag desligada; os
  substitutos são fases do plano, cada uma com aceite medido — o veredito de rota (Fase 3) já
  passou e entrou; a nota de impacto entrou como Glint **experimental**, com nome próprio.
- **As séries `*_t` da OpenDota são todas cumulativas**; o modelo do app quer delta em tudo menos
  patrimônio. A conversão acontece uma vez, em `openDotaMatch.ts` — quem consome continua indexando
  só por `utils/insights/timeSeries.ts`.
- **Ward da OpenDota: `attackername` igual ao herói de quem colocou significa que expirou sozinha**,
  não que foi destruída pelo dono. Deward é só herói do time adversário.
- Host novo exige liberação em três lugares (CSP, allowlist do main, handler IPC). Endpoint novo
  de leitura da OpenDota **não** precisa de handler: `api:opendota-fetch` é genérico.
- **Nada aqui fala com a STRATZ em tempo de execução** (decisão de 2026-11-19). O handler
  `api:stratz-graphql`, a ponte `window.api.stratzQuery` e `api.stratz.com` na CSP foram removidos;
  `stratzHeroStats.ts` e `heroGrid/stratzWinrates.ts` foram apagados. Na etapa 2 (mesmo dia)
  saíram `stratzGql.ts` (consultas, `mapStratzMatch`, `derivePartySize`, `deriveTeamShares`,
  `ALL_TOWERS_STANDING`) e a fixture `match-parsed.json`.

## Ao sair um patch

- **Nenhuma consulta filtra por versão de jogo.** O patch é rótulo na UI e chave de cache — e
  nada mais. Não existe consulta "meta do patch X"; existe agregado atual, invalidado quando o
  patch vira.
- `statsCache.ts` invalida **duro** por patch (`env.patch !== patch`) antes mesmo do TTL de 7 dias.
  Virada de patch limpa a meta em cache sozinha; não há passo manual.
- **Valor novo de posição ou rota falha em silêncio.** `mapPosition` e `mapLane`
  (`openDotaMatch.ts`) caem em `'UNKNOWN'` sem lançar erro — deliberado (chutar `POSITION_1` ou
  `SAFE` produziria veredito errado), mas significa que um valor novo some sem sinal. `gameMode`/`lobbyType` passam por
  `formatGameMode`/`formatLobbyType` em `utils/dotaFormatters.ts`, que também são mudos, de outro
  jeito: valor desconhecido vira o próprio enum formatado (`ABILITY_DRAFT` → "Ability Draft"), e
  **entrada vazia** vira o palpite `"All Pick Ranqueado"` / `"Ranqueada"`. Modo ou papel novo ⇒
  conferir estes quatro pontos.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../types/CLAUDE.md](../types/CLAUDE.md) ·
[../hooks/CLAUDE.md](../hooks/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
