# electron/

O processo main e a ponte para o renderer. É o único lado privilegiado do app: aqui existe
`fs`, `child_process` e acesso à rede sem CSP. Nenhuma regra de domínio mora aqui — o main
não sabe o que é IMP, winrate ou espelho.

## Arquivos

| Item | Papel |
| --- | --- |
| `main.cjs` | Janela, auto-updater, guardas de navegação, store de config e **todos** os handlers IPC |
| `preload.cjs` | `contextBridge.exposeInMainWorld('api', …)`: `store.{get,set,getAll}`, `stratzQuery`, `openDotaFetch`, `resolveSteamId`, `windowControl.*`, `updater.*`, `heroGrid.*`, `getPlatform()`, `getVersion()`. Só encaminha `ipcRenderer.invoke` — nenhuma lógica |
| `heroGrid/` | I/O do `hero_grid_config.json` do jogador ([CLAUDE.md](heroGrid/CLAUDE.md)) |

Handlers em `main.cjs`: `store:get` · `store:set` · `store:getAll` · `api:stratz-graphql` ·
`api:opendota-fetch` · `api:resolve-steam-id` · `updater:check` · `updater:quitAndInstall` ·
`app:getVersion` · `grid:list-accounts` · `grid:read` · `grid:write` · `grid:restore` ·
`grid:list-backups` · `grid:is-dota-running` · `window:minimize` · `window:maximize` ·
`window:close` · `window:isMaximized`.

## Regras locais

- **`api:stratz-graphql` é genérico.** Ele recebe `{ query, variables, customApiKey }` — query
  nova na STRATZ **não** precisa de handler novo. O mesmo vale para `api:opendota-fetch`, que
  recebe só o `endpoint`.
- **`success` tem de significar a mesma coisa nos dois transportes.** O handler devolve
  `success: !json.errors || json.errors.length === 0`, não "HTTP 200". A versão anterior fazia
  um erro parcial de GraphQL passar no Electron e cair no caminho de falha em `npm run dev`.
- **`EXTERNAL_HOST_ALLOWLIST` não filtra fetch.** São 8 hosts, e servem **só** para decidir o
  que `shell.openExternal` pode abrir no navegador do sistema (via `applyNavigationGuards`:
  `setWindowOpenHandler`, `will-navigate` e o `will-attach-webview` que barra `<webview>`).
  Host novo de rede exige liberação em **três** lugares independentes: a CSP em
  `vite.config.ts` (só produção), esta allowlist e um handler IPC.
- **`guardGridPath` roda antes de qualquer toque no disco.** Todo handler `grid:*` que recebe
  `path` do renderer passa por `assertAllowedGridPath` primeiro. O caminho manual do jogador é
  lido do `appConfig` **aqui**, no lado privilegiado — aceitá-lo do renderer transformaria a
  exceção no próprio buraco. Detalhe em [heroGrid/CLAUDE.md](heroGrid/CLAUDE.md).
- **`grid:is-dota-running` degrada, não falha.** Erro de consulta responde
  `{ running: false, method: 'unsupported' }`: falso positivo permanente mataria a feature.
- A config vive em `stratz_app_config.json` dentro do `userData`, em **texto claro** — inclusive
  o token da STRATZ, que não é revogável. Nada de logar `appConfig`.
- Os testes do processo main moram em `tests/electron/`, e entram no vitest pelo glob
  `tests/**/*.test.cjs` (`globals: true`). Com eles fora de `electron/`, o `files` do
  `electron-builder` empacota `electron/**/*` inteiro sem precisar de exclusão.

## Ao sair um patch

Nada aqui muda por patch de Dota. O main só transporta bytes: não conhece herói, item, patch
nem métrica. O que envelhece está em `src/constants/`. Roteiro completo em
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../src/CLAUDE.md](../src/CLAUDE.md) ·
[heroGrid/CLAUDE.md](heroGrid/CLAUDE.md) · [../tests/CLAUDE.md](../tests/CLAUDE.md)
