# src/services/

Toda a rede do app. Nada aqui renderiza: os módulos buscam, mapeiam e cacheiam. Cada um cobre os
**dois caminhos** (Electron por IPC / browser por `fetch`) — a bifurcação está na doutrina em
[../../CLAUDE.md](../../CLAUDE.md).

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `gameVersionService.ts` | Resolvedor de patch em cascata: Steam News → OpenDota `constants/patch` → GitHub dotaconstants → `CURRENT_GAME_PATCH` (o degrau da STRATZ e o parâmetro `token` saíram em 2026-11-19). Cache em `localStorage` com TTL de 1h. Expõe `parsePatchVersion`, `comparePatches`, `extractPatchFromTitle`, `getCachedGamePatch`, `fetchLatestGamePatch`, `subscribeToPatchUpdates` | `hooks/useGamePatch.ts`, `statsCache.ts`, `heroGrid/openDotaWinrates.ts`, `hooks/useHeroGridSync.ts` |
| `statsCache.ts` | `localStorage` + memória, TTL de 7 dias. `readStatsCache`/`writeStatsCache`/`statsCacheKey`, com poda quando a cota estoura | `heroGrid/openDotaWinrates.ts` |
| `openDotaProfile.ts` | **A dashboard inteira.** `fetchPlayerProfile` (perfil, vitórias, 40 partidas recentes, heróis mais jogados, companheiros), `fetchHeroBenchmarkTable` (tabela de percentis por herói, cache de 7 dias) e os mappers puros `mapOpenDotaProfile`, `mapOpenDotaPlayerMatch`, `mapMostPlayedHeroes`, `mapOpenDotaPeers`, `classifyMatchDynamic`. O cabeçalho lista o que a lista de partidas **não** tem. Na 2.0 ganhou a paginação e os filtros: `fetchPlayerMatchesPage` (`offset`/`limit`, `hasMore`), `fetchHeroPerformance`/`mapHeroPerformance` (todos os heróis, com `lastPlayed` do `start_time`), `fetchPatchCatalog`/`mapPatchCatalog`/`patchWindows` e o filtro de patch em `patchServerQuery` + `filterRowsToPatch` — ver a regra abaixo | `App.tsx` |
| `openDotaMatch.ts` | **O detalhe da partida.** Mapper puro `mapOpenDotaMatch` (o único mapper de partida desde a etapa 2), `isOpenDotaMatchParsed`, `fetchOpenDotaMatchDetails` e `requestOpenDotaParse` (`POST /request/{id}`), os dois últimos nos dois caminhos de rede. O cabeçalho do arquivo lista o que a OpenDota **não** tem e fica desligado | `App.tsx` |
| `openDotaAccount.ts` | **A seção Conta da 2.0.** `fetchAccountTotals`/`mapAccountTotals` (média com o `n` **do próprio campo** — campo de replay analisado tem amostra menor; `kda` e `comeback`/`stomp`/`throw`/`loss` ficam fora, porque não somam), `fetchAccountCounts`/`mapAccountCounts` (patch, modo, fila, rota, lado, região, abandono; `lane_role` 0 sai, não é rota) e `fetchAccountRecords`/`mapAccountRecord` (`matches?sort=<campo>&limit=1`, uma chamada por campo, cache de um dia; `deaths` não é recorde) | a seção Conta |
| `opendota.ts` | REST público, sem token. `openDotaGet(endpoint)` é **o** ponto dos dois caminhos de rede (IPC / `fetch`), `null` em falha, e reporta o status de cada resposta ao `openDotaHealth`; `fetchOpenDotaHeroStats` e `fetchOpenDotaPlayer` passam por ele | todos os serviços de leitura da OpenDota |
| `openDotaHealth.ts` | Quais rotas da OpenDota deram 5xx na última chamada (`endpointFamily`: `players/:id/wl`), e qual aviso mostrar (`openDotaNotice`: `UNSTABLE` medido vence `SLOW`). Funções puras + um store que o `App` assina com `useSyncExternalStore`. `SLOW_OPENDOTA_NOTICE_MS` é o limiar de demora | `opendota.ts` (alimenta), `App.tsx` (aviso no topo e na abertura) |
| `steamResolver.ts` | `resolveSteamId`: SteamID64/32 ou vanity URL → conta (só a busca de nome traz nome e foto). `withAccountProfile`: completa com nome e foto do perfil público **daquele id** — Steam primeiro (`api:steam-profile`, só no Electron; o "não existe" dela é final), OpenDota (`players/{id}`) de reserva — e diz `profileStatus` (`FOUND`/`NOT_FOUND`/`UNAVAILABLE`). Sem ele, a confirmação do onboarding mostrava só o número | `App.tsx`, `settings/SettingsModal.tsx`, `auth/OnboardingModal.tsx` |
| `visionMapper.ts` | Puro e testado. Só helpers sobre `VisionData` (quem monta é o `buildVision` de `openDotaMatch.ts`): `emptyVisionData`, `wardsBySlot`, `computePlayerVisionStats`, `observerUptimePct`, `VISION_SOURCE_IS_ESTIMATED` | `openDotaMatch.ts`, `vision/WardMinimapTab.tsx`, `utils/insights/rules/vision.ts` |
| `heroGrid/` | Fontes de meta e ponte de arquivo do layout espelho ([CLAUDE.md](heroGrid/CLAUDE.md)) | `hooks/useHeroGridSync.ts` |
| `__fixtures__/` | Respostas reais anonimizadas ([CLAUDE.md](__fixtures__/CLAUDE.md)) | os testes |

## Regras locais

- **Partida recém-terminada vem como esboço.** A OpenDota responde 200 com 10 jogadores de
  `hero_id: 0`, `duration: 0` e placar 0 a 0 antes de ingerir a partida. `isOpenDotaMatchUsable`
  barra isso em `fetchOpenDotaMatchDetails` (vira `null` e o aviso de falha); antes a tela abria
  com "Dire venceu", "Player 0" e "Hero #0".
- **Falha parcial do perfil sai marcada, não vazia.** Em `fetchPlayerProfile`, a lista de
  partidas recentes e os companheiros que voltam `null` viram `recentMatchesFailed` /
  `peersFailed` (e `activityDays` ausente), não `[]`: lista vazia dizia "conta sem partidas".
  `fetchPlayerPeers` devolve `null` em falha pelo mesmo motivo.
- **Leitura da OpenDota passa por `openDotaGet`.** É ele que alimenta o aviso de instabilidade:
  leitura que chame `window.api.openDotaFetch` ou `fetch` direto não aparece no aviso. Em
  2026-11-22 as leituras de partida, patch e heróis pessoais passaram a usá-lo. Só 5xx conta
  (404, 429 e falha de rede não são instabilidade dela), e a instabilidade é **por rota**: no caso
  real, `players/{id}` respondia enquanto `/wl`, `/matches`, `/peers` e `/heroes` davam 500 depois
  de 12 a 43 s. Fora do aviso, de propósito: a busca por nome do `steamResolver` e o pedido de
  análise, que têm erro próprio na tela.
- **Falha devolve `null` ou lista vazia, nunca dado fabricado.** `mockData.ts` foi removido de
  propósito. A UI mostra toast; não existe fallback inventado.
- A disponibilidade é calculada **uma vez**, dentro de `mapOpenDotaMatch`. Nunca é adivinhada
  depois — condição nova vira flag em `MatchDataAvailability`.
- O veredito de rota é **chamado** daqui, não calculado: `mapOpenDotaMatch` passa ao
  `utils/laneVerdict.ts` só o campo `lane`, o lado, `networth_t[10]` e `xp_t[10]` de cada jogador.
  `resolvePlayerLaneResult` recebe **só** rota, lado e outcomes. Não passar sinal de partida.
- A visão sai de `obs_log`/`sen_log` com saída real (`PLAYBACK`) ou não sai (`NONE`). Ward sem
  linha de saída tem fim estimado e marcado em `expiryInferred`. Nunca inventar ward.
  `PLAYER_STATS` (fallback da STRATZ) ficou sem produtor desde que o `buildVisionData` saiu.
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
  `ALL_TOWERS_STANDING`) e a fixture `match-parsed.json`; depois, o `buildVisionData` de
  `visionMapper.ts`.

- **`?patch=` da OpenDota não conhece o patch novo logo depois da virada.** Um dia depois da 7.42,
  `?patch=61` voltava `[]` para uma conta com partidas de 7.42, e `?patch=60` funcionava. Filtro só
  do servidor diria "0 partidas neste patch". Por isso o patch atual vai por `?date=` (dias desde a
  virada) e todo filtro de patch passa pelo corte local em `start_time` (`filterRowsToPatch`);
  patch anterior vai por `?patch=<id>`. Linha sem `start_time` sai do filtro: não dá para afirmar o
  patch dela.

## Ao sair um patch

- **Nenhuma consulta filtra por versão de jogo.** O patch é rótulo na UI e chave de cache — e
  nada mais. Não existe consulta "meta do patch X"; existe agregado atual, invalidado quando o
  patch vira.
- `statsCache.ts` invalida **duro** por patch (`env.patch !== patch`) antes mesmo do TTL de 7 dias.
  Virada de patch limpa a meta em cache sozinha; não há passo manual.
- **Valor novo de posição ou rota falha em silêncio.** `mapPosition` e `mapLane`
  (`openDotaMatch.ts`) caem em `'UNKNOWN'` sem lançar erro — deliberado (chutar `POSITION_1` ou
  `SAFE` produziria veredito errado), mas significa que um valor novo some sem sinal. Modo e fila
  vão crus para `MatchDetails.gameModeId`/`lobbyTypeId`, e a tela os traduz por
  `matchModeKey`/`lobbyTypeKey` (`utils/dotaFormatters.ts`): modo desconhecido sai como "Modo {id}"
  e entrada vazia é `null`. Os antigos `formatGameMode`/`formatLobbyType` (texto fixo em pt-BR,
  palpite na entrada vazia) saíram na 2.0. Modo ou papel novo ⇒ conferir a tabela de
  `matchModeKey` e os dois dicionários.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../types/CLAUDE.md](../types/CLAUDE.md) ·
[../hooks/CLAUDE.md](../hooks/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
