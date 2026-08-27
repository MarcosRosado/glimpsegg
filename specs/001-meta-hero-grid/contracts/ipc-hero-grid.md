# Contrato: ponte IPC `window.api.heroGrid`

Superfície nova exposta pelo `preload.cjs`. Segue a forma dos handlers que já existem:
`{ success, data?, error? }`, nunca lança para o renderer.

**Princípio de fronteira**: o main process **não decide nada**. Ele não sabe o que é winrate, nem
espelho, nem ranking. Recebe o objeto do arquivo pronto e grava. Toda decisão é código testável em
`src/` (R9).

```ts
interface HeroGridApi {
  /** Lista contas Steam candidatas na máquina. Não lê o conteúdo dos grids. */
  listAccounts(): Promise<Result<SteamAccountCandidate[]>>;

  /** Lê e faz parse do arquivo. `data: null` com `exists: false` quando não há arquivo. */
  readFile(args: { path: string }): Promise<Result<{ exists: boolean; file: HeroGridFile | null; raw?: string }>>;

  /**
   * Grava o arquivo. Recebe `content` JÁ SERIALIZADO pelo renderer — o serializador é uma
   * função pura em `src/utils/heroGrid/valveJson.ts`, testável pelo vitest, e é isso que
   * mantém a decisão de formatação sob teste em vez de escondida num .cjs (R9).
   *
   * `expectedSourceConfig` é a guarda de E-3: o main faz JSON.parse do `content` e compara o
   * config de origem por igualdade profunda, ABORTANDO se divergir. A guarda mora no main de
   * propósito — é a última linha antes do disco, e precisa validar exatamente os bytes que vão
   * ser gravados, não um objeto que alguém prometeu ter serializado direito.
   */
  writeFile(args: {
    path: string;
    content: string;                       // texto final, byte a byte, produzido por valveJson.ts
    expectedSourceIndex: number;           // POSIÇÃO, não nome — ver "Identidade" em hero-grid-file.md
    expectedSourceConfig: HeroGridConfig;
    expectedMirrorIndex: number;           // a única posição que pode ter mudado ou nascido
    expectedConfigCount: number;           // quantos configs o arquivo tinha antes (+1 se o espelho é novo)
    allowWhileDotaRunning: boolean;
  }): Promise<Result<{ backupPath: string; bytesWritten: number }>>;

  /** Restaura o backup mais recente (ou um específico). */
  restoreBackup(args: { path: string; backupPath?: string }): Promise<Result<{ restoredFrom: string }>>;

  listBackups(args: { path: string }): Promise<Result<Array<{ path: string; at: number; bytes: number }>>>;

  /** Nome de executável exato, nunca substring de linha de comando (R12). */
  isDotaRunning(): Promise<Result<{ running: boolean; method: 'ps' | 'tasklist' | 'unsupported' }>>;
}

type Result<T> = { success: true; data: T } | { success: false; error: string; code?: ErrorCode };

type ErrorCode =
  | 'FILE_NOT_FOUND' | 'INVALID_JSON' | 'NO_PERMISSION'
  | 'SOURCE_MUTATED'        // a guarda E-3 pegou divergência — o caso que importa
  | 'CONFIG_COUNT_MISMATCH' // o array de configs mudou de tamanho de forma inesperada
  | 'SOURCE_INDEX_GONE'    // a posição registrada não existe mais (layout apagado)
  | 'DOTA_RUNNING'
  | 'WRITE_IN_PROGRESS'
  | 'NAME_COLLISION'
  | 'UNSUPPORTED_PLATFORM';
```

## Handlers no `main.cjs`

| Canal | Faz |
| --- | --- |
| `grid:list-accounts` | Monta candidatos, dedupe por realpath, filtra pseudo-contas |
| `grid:read` | `readFileSync` + `JSON.parse`, devolve também o `raw` para o backup byte a byte |
| `grid:write` | Trava → `JSON.parse(content)` → guarda E-3/E-4 **por posição**, incluindo checagem de `expectedConfigCount` → backup → tmp+fsync+rename → poda de backups |
| `grid:restore` | Copia backup sobre o arquivo, atômico igual |
| `grid:list-backups` | Lista `*.glimpse.bak.*` do diretório |
| `grid:is-dota-running` | `ps -A -o comm=` / `tasklist /FO CSV /NH` |

**Nenhum handler de rede novo.** As fontes de winrate usam `api:opendota-fetch` e
`api:stratz-graphql`, que já existem. O handler `api:d2pt-grid` previsto no plano original saiu com o
corte do D2PT.

## Caminho browser (`npm run dev`)

`window.api` é `undefined` → `heroGridBridge.ts` devolve indisponível para **todas** as operações de
arquivo. As fontes de winrate funcionam (fetch direto, hosts já na CSP), então a UI mostra o ranking
normalmente e diz, sem rodeio, que nesse modo não escreve layout. Nunca simular sucesso de escrita.

## Regras de segurança

| # | Regra |
| --- | --- |
| S-1 | `path` recebido do renderer é validado no main: precisa terminar em `hero_grid_config.json` e estar sob um `userdata/<id3>/570/remote/cfg/` de uma raiz Steam reconhecida, **ou** ser exatamente o caminho manual que o jogador configurou. Sem isso, o renderer poderia mandar o main gravar em qualquer lugar |
| S-2 | Nenhuma mensagem de erro inclui o token da STRATZ ou conteúdo de config do app |
| S-3 | Nenhum handler aceita URL vinda do renderer. Os handlers de rede existentes já falam com hosts fixos |
