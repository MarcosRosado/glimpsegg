# electron/

O processo main e a ponte para o renderer. É o único lado privilegiado do app: aqui existe
`fs`, `child_process` e acesso à rede sem CSP. Nenhuma regra de domínio mora aqui — o main
não sabe o que é IMP, winrate ou espelho.

## Arquivos

| Item | Papel |
| --- | --- |
| `main.cjs` | Janela, auto-updater, guardas de navegação, store de config e **todos** os handlers IPC |
| `configMigration.cjs` | `stratz_app_config.json` → `glimpsegg_config.json` no primeiro início: copia tudo menos `stratzApiKey`, deixa o antigo intocado, escrita atômica, roda uma vez. Testado em `tests/electron/configMigration.test.cjs` |
| `preload.cjs` | `contextBridge.exposeInMainWorld('api', …)`: `store.{get,set,getAll}`, `openDotaFetch`, `openDotaRequestParse`, `resolveSteamId`, `windowControl.*`, `updater.*`, `heroGrid.*`, `getPlatform()`, `getVersion()`. Só encaminha `ipcRenderer.invoke` — nenhuma lógica |
| `heroGrid/` | I/O do `hero_grid_config.json` do jogador ([CLAUDE.md](heroGrid/CLAUDE.md)) |

Handlers em `main.cjs`: `store:get` · `store:set` · `store:getAll` ·
`api:opendota-fetch` · `api:opendota-request-parse` · `api:resolve-steam-id` · `updater:check` · `updater:quitAndInstall` ·
`app:getVersion` · `grid:list-accounts` · `grid:read` · `grid:write` · `grid:restore` ·
`grid:list-backups` · `grid:is-dota-running` · `window:minimize` · `window:maximize` ·
`window:close` · `window:isMaximized`.

## Regras locais

- **Não existe mais handler da STRATZ.** `api:stratz-graphql` e a ponte `stratzQuery` do preload
  saíram em 2026-11-19: o app não fala com `api.stratz.com` em tempo de execução. Não recriar.
- **`api:opendota-fetch` é genérico.** Recebe só o `endpoint` — endpoint novo de leitura da
  OpenDota **não** precisa de handler novo.
- **`api:opendota-request-parse` é handler próprio, não um `method` no fetch genérico.** O
  `api:opendota-fetch` aceita endpoint livre do renderer; deixar o renderer escolher o verbo
  abriria qualquer POST da API. Este recebe só `{ matchId }`, valida que é inteiro positivo e
  monta a URL de `POST /request/{id}` no main.
- **`success` tem de significar a mesma coisa nos dois transportes** (IPC e `fetch` direto do
  caminho browser). Handler novo que devolva `success: true` para qualquer HTTP 200 recria a
  divergência que o handler da STRATZ já teve: erro parcial passava no Electron e falhava em
  `npm run dev`.
- **`EXTERNAL_HOST_ALLOWLIST` não filtra fetch.** São 5 hosts, e servem **só** para decidir o
  que `shell.openExternal` pode abrir no navegador do sistema (via `applyNavigationGuards`:
  `setWindowOpenHandler`, `will-navigate` e o `will-attach-webview` que barra `<webview>`).
  Host novo de rede exige liberação em **três** lugares independentes: a CSP em
  `vite.config.ts` (só produção), esta allowlist e um handler IPC. Os três hosts
  da STRATZ saíram em 2026-11-19, quando nenhuma tela passou a abrir link para `stratz.com`.
- **`guardGridPath` roda antes de qualquer toque no disco.** Todo handler `grid:*` que recebe
  `path` do renderer passa por `assertAllowedGridPath` primeiro. O caminho manual do jogador é
  lido do `appConfig` **aqui**, no lado privilegiado — aceitá-lo do renderer transformaria a
  exceção no próprio buraco. Detalhe em [heroGrid/CLAUDE.md](heroGrid/CLAUDE.md).
- **`grid:is-dota-running` degrada, não falha.** Erro de consulta responde
  `{ running: false, method: 'unsupported' }`: falso positivo permanente mataria a feature.
- A config vive em `glimpsegg_config.json` dentro do `userData`, em **texto claro**. Até a 2.0 era
  `stratz_app_config.json`; a migração (`configMigration.cjs`) **copia** e não renomeia, e não leva
  a chave `stratzApiKey`: o arquivo antigo fica intocado de propósito, porque token salvo por
  versão anterior não é revogável e os scripts de medição fora do app ainda o procuram lá. Não
  "limpar" o arquivo antigo, não copiar o token para o novo, e nada de logar `appConfig` — nem o
  erro da migração leva o conteúdo do arquivo.
- Os testes do processo main moram em `tests/electron/`, e entram no vitest pelo glob
  `tests/**/*.test.cjs` (`globals: true`). Com eles fora de `electron/`, o `files` do
  `electron-builder` empacota `electron/**/*` inteiro sem precisar de exclusão.

## Ao sair um patch

Nada aqui muda por patch de Dota. O main só transporta bytes: não conhece herói, item, patch
nem métrica. O que envelhece está em `src/constants/`. Roteiro completo em
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../src/CLAUDE.md](../src/CLAUDE.md) ·
[heroGrid/CLAUDE.md](heroGrid/CLAUDE.md) · [../tests/CLAUDE.md](../tests/CLAUDE.md)
