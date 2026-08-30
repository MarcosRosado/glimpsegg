# electron/heroGrid/

I/O do `hero_grid_config.json` do jogador — o único arquivo que o app escreve e que **não é
nosso**: formato da Valve, trabalho manual do jogador, e o cliente do Dota também escreve nele.
Aqui não se decide nada: o texto chega pronto de `src/utils/heroGrid/valveJson.ts`.

## Arquivos

| Arquivo | Papel | Exporta |
| --- | --- | --- |
| `gridFile.cjs` | Leitura, escrita e restauração. Backup byte a byte, escrita atômica, poda e a guarda de imutabilidade | `readGridFile`, `writeGridFile`, `restoreGridFile`, `listGridBackups`, `parseGridText`, `evaluateWriteGuards`, `deepEqual`, `TMP_SUFFIX`, `BACKUP_INFIX`, `MAX_BACKUPS` |
| `pathGuard.cjs` | Guarda S-1: valida o `path` que o renderer manda | `assertAllowedGridPath`, `decomposeGridPath`, `GRID_FILE_NAME` |
| `steamPaths.cjs` | Descobre raízes do Steam e contas em `userdata/` | `steamRootCandidates`, `isAccountDirName`, `gridFilePathFor`, `listSteamAccounts`, `readRegistrySteamPath` |
| `dotaProcess.cjs` | "O Dota está aberto agora?" | `parseProcessList`, `isDotaRunning`, `COMMAND_TIMEOUT_MS` |

Cada um tem `.test.cjs` correspondente em `tests/electron/heroGrid/`, incluídos no vitest pelo
glob `tests/**/*.test.cjs` com `globals: true` — o Vitest 4 recusa `require('vitest')` e um
`import` num `.cjs` quebra o parse do oxlint. Eles rodam contra o código do processo main de
propósito: os invariantes que importam aqui só podem ser verificados onde o I/O acontece, sobre os
bytes que vão para o disco.

## Regras locais

- **A guarda de imutabilidade mora aqui de propósito.** `writeGridFile` faz `JSON.parse` do
  texto que vai ao disco e compara por igualdade profunda (`deepEqual`) o config de origem e
  **todos** os outros configs com o que leu; divergiu, aborta com `SOURCE_MUTATED` antes de
  gravar. É a última linha antes do disco e precisa validar os bytes reais, não um objeto que
  alguém prometeu ter serializado direito — por isso ela é a exceção à regra "decisão mora em
  `src/`". A lógica de decisão está em `evaluateWriteGuards`, pura e testada.
- **Escrita atômica e recuperável**: backup `<stem>.glimpse.bak.<epoch>` (`BACKUP_INFIX`) →
  tmp `.glimpse.tmp` (`TMP_SUFFIX`) → `fsync` → `rename`, e poda para no máximo `MAX_BACKUPS`
  (5). `writeInProgress` é trava de processo: a segunda escrita concorrente recebe
  `WRITE_IN_PROGRESS`, não uma corrida.
- **Arquivo inválido é falha explícita, nunca "arquivo vazio"** — quem lê como vazio grava por
  cima do que não conseguiu entender.
- **`pathGuard.cjs` é do main, não da ponte.** A ponte em `src/services/heroGrid/` roda do lado
  que pode estar errado. Sem validação, o processo privilegiado gravaria em qualquer arquivo do
  usuário — com backup e atomicidade, o que só deixaria o estrago mais convincente.
  `REQUIRED_SEGMENTS` exige `userdata/<id3>/570/remote/cfg/`, e o `path.resolve` colapsa `..`
  antes da comparação.
- **`gridFile.cjs` não revalida caminho.** Chamá-lo com caminho arbitrário grava em caminho
  arbitrário: a validação é pré-requisito de quem chama (`electron/main.cjs`).
- **Nenhuma mensagem de erro daqui cita conteúdo de config** — código, índice e caminho, nunca
  nome de layout, nome de categoria ou lista de heróis.
- **Detecção de processo é por nome EXATO de executável** (`dota2` / `dota2.exe`), nunca
  substring da linha de comando: `pgrep -f 'dota2'` casa com o próprio shell e com este
  projeto, cujo diretório se chama `dota2-stratz-analyzer` — falso positivo permanente que
  impediria a feature de escrever para sempre.
- **`steamPaths.cjs` não lança e não usa `require('electron')`.** Raiz inexistente ou
  `readdir` sem permissão é raiz **descartada**; o que vem do Electron entra por parâmetro,
  para o teste rodar em Node puro. `~/.steam/steam`, `~/.steam/root` e `~/.local/share/Steam`
  são o mesmo diretório por symlink: sem `realpath` + dedupe a mesma conta aparece três vezes.

## Ao sair um patch

Nada aqui muda por patch de Dota — mas **muda por mudança do Steam ou do cliente**: o appid
`570`, a forma `userdata/<id3>/570/remote/cfg/` e o nome do executável estão cravados. Patch de
herói não toca em nada disto.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../CLAUDE.md](../../CLAUDE.md) ·
[src/components/heroGrid/CLAUDE.md](../../src/components/heroGrid/CLAUDE.md) ·
[tests/CLAUDE.md](../../tests/CLAUDE.md)
