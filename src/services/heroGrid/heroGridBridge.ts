import type { HeroGridApi } from '../../types/electron';
import {
  GridBackupEntry,
  GridReadPayload,
  GridWriteRequest,
  HeroGridErrorCode,
  HeroGridResult,
  SteamAccountCandidate,
} from '../../types/heroGrid';

/**
 * Ponte do renderer para a API de arquivo do main (`window.api.heroGrid`).
 *
 * Ela existe por dois motivos, e nenhum dos dois é "encapsular o IPC por elegancia":
 *
 * 1. **Indisponivel explicito no caminho browser.** Em `npm run dev` nao ha `window.api`,
 *    logo nao ha acesso a disco. Toda operacao daqui devolve
 *    `{ success: false, code: 'UNAVAILABLE' }` — NUNCA um sucesso simulado. É a doutrina
 *    central do projeto: o antigo `src/services/mockData.ts` foi removido de proposito
 *    porque abrir a tela com dado fabricado, em vez de avisar, é pior do que nao abrir.
 *    Aqui o dano seria maior ainda: escrita de arquivo "bem-sucedida" que nao gravou nada
 *    faria o app registrar espelho e data de sincronizacao que nao existem no disco.
 *
 * 2. **Nunca lancar para quem chama.** Toda funcao devolve `HeroGridResult<T>`. Excecao
 *    vinda do IPC (preload quebrado, canal removido, handler que rejeitou) vira resultado
 *    de falha. A UI de sincronizacao nao precisa de try/catch em volta de cada chamada.
 *
 * ## O que esta ponte NAO é
 *
 * **Nao é fronteira de seguranca.** A validacao de caminho (S-1: terminar em
 * `hero_grid_config.json` e estar sob um `userdata/<id3>/570/remote/cfg/` reconhecido, ou
 * ser exatamente o caminho manual configurado) mora no `electron/main.cjs`. O renderer é
 * codigo que um XSS ou um script de terceiro alcanca; validar aqui protege exatamente
 * ninguem, porque quem contorna a ponte fala com o IPC direto. Se voce esta pensando em
 * "adicionar a checagem de caminho aqui para ficar mais perto de quem chama": adicione no
 * main. Checagem aqui é, na melhor das hipoteses, mensagem de erro mais amigavel — nunca
 * garantia.
 *
 * **S-2**: nenhuma mensagem construida aqui interpola argumento de chamada. Em especial
 * `writeFile` recebe `content` (o arquivo de grid inteiro) e `path` (caminho absoluto com
 * o nome do usuario do sistema); nada disso entra em `error`. O token da STRATZ nem passa
 * por este modulo, e é para continuar assim.
 */

/* ------------------------------------------------------------------ *
 * Disponibilidade
 * ------------------------------------------------------------------ */

/** Nome de operacao, so para a mensagem de indisponibilidade dizer qual chamada caiu. */
type HeroGridOperation = keyof HeroGridApi;

/**
 * Resolve a API do main, ou `null` quando ela nao existe.
 *
 * Dois casos distintos caem no mesmo `null` de proposito: caminho browser
 * (`window.api === undefined`) e Electron com preload de versao anterior a esta feature
 * (`window.api` existe, `window.api.heroGrid` nao). Para a UI os dois significam a mesma
 * coisa — nao ha como gravar layout — e tratar o segundo como erro faria uma atualizacao
 * parcial do app virar toast de falha em vez de aviso de modo limitado.
 */
function resolveApi(): HeroGridApi | null {
  // `typeof window` porque o vitest roda em `environment: 'node'`: sem esta guarda os
  // testes das funcoes puras que importam este modulo estourariam ReferenceError.
  if (typeof window === 'undefined' || !window.api) return null;
  const api = window.api.heroGrid;
  return api && typeof api === 'object' ? api : null;
}

/**
 * Predicado unico para a UI decidir entre "mostrar botao de sincronizar" e "mostrar aviso
 * de modo browser". Existe para que nenhum componente reinvente a checagem de
 * `window.api` — cada reinvencao é uma chance de esquecer o ramo `heroGrid` ausente e
 * quebrar com TypeError em vez de avisar.
 */
export function isHeroGridFileAccessAvailable(): boolean {
  return resolveApi() !== null;
}

/**
 * Distingue as duas falhas que a UI precisa contar de formas diferentes:
 * "indisponivel porque este modo nao acessa disco" e "o Electron tentou e falhou".
 *
 * O mecanismo é o codigo `UNAVAILABLE`: ele é emitido EXCLUSIVAMENTE por esta ponte, e
 * nenhum handler do main o usa (ver a lista de `ErrorCode` em
 * `contracts/ipc-hero-grid.md`, que nao o inclui). Logo `code === 'UNAVAILABLE'` implica
 * caminho sem acesso a arquivo, e qualquer outro codigo implica tentativa real no disco.
 * Sem essa separacao as duas situacoes desaguariam na mesma mensagem generica de erro,
 * que nao ajuda ninguem: uma pede "abra o app instalado", a outra pede "veja o que
 * aconteceu com o arquivo".
 */
export function isUnavailableInBrowser(result: HeroGridResult<unknown>): boolean {
  return result.success === false && result.code === 'UNAVAILABLE';
}

/** O resultado de indisponibilidade. Mesma forma para as seis operacoes. */
function unavailable(operation: HeroGridOperation): HeroGridResult<never> {
  return {
    success: false,
    code: 'UNAVAILABLE',
    // A palavra "indisponivel" é criterio de aceitacao do quickstart: em `npm run dev` a
    // escrita de layout tem de aparecer como indisponivel, com essa palavra.
    error:
      `Operacao "${operation}" indisponivel: o acesso ao hero_grid_config.json existe ` +
      'somente no app Electron (npm run electron:dev / build instalado), nao no caminho ' +
      'browser (npm run dev).',
  };
}

/* ------------------------------------------------------------------ *
 * Traducao de excecao em resultado
 * ------------------------------------------------------------------ */

/** Os codigos do contrato, para reconhecer um `code` que ja venha pronto na excecao. */
const KNOWN_CODES: readonly HeroGridErrorCode[] = [
  'FILE_NOT_FOUND',
  'INVALID_JSON',
  'NO_PERMISSION',
  'SOURCE_MUTATED',
  'CONFIG_COUNT_MISMATCH',
  'SOURCE_INDEX_GONE',
  'DOTA_RUNNING',
  'WRITE_IN_PROGRESS',
  'NAME_COLLISION',
  'UNSUPPORTED_PLATFORM',
  'UNAVAILABLE',
];

/**
 * Infere o codigo quando der, e devolve `undefined` quando nao der.
 *
 * `undefined` é resposta legitima e melhor do que um chute: a UI trata "falhou sem codigo"
 * mostrando a mensagem crua, enquanto um codigo errado a faria dizer com confianca a coisa
 * errada (ex.: acusar `SOURCE_MUTATED`, que manda o jogador reconferir o layout, quando o
 * que houve foi canal de IPC ausente).
 *
 * Nota: `UNAVAILABLE` nunca é inferido aqui. Ele marca "modo sem acesso a arquivo", e uma
 * excecao no Electron é o oposto disso — houve tentativa real.
 */
function inferCode(err: unknown): HeroGridErrorCode | undefined {
  if (err instanceof SyntaxError) return 'INVALID_JSON';
  const raw = (err as { code?: unknown })?.code;
  if (typeof raw !== 'string') return undefined;
  if (raw !== 'UNAVAILABLE' && (KNOWN_CODES as readonly string[]).includes(raw)) {
    return raw as HeroGridErrorCode;
  }
  // Codigos do Node, que aparecem quando o handler do main deixa o erro cru subir.
  if (raw === 'ENOENT') return 'FILE_NOT_FOUND';
  if (raw === 'EACCES' || raw === 'EPERM' || raw === 'EROFS') return 'NO_PERMISSION';
  return undefined;
}

/** Mensagem legivel a partir de algo que pode nao ser um `Error`. */
function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'erro desconhecido no processo principal';
}

/**
 * Envelope comum das seis operacoes: resolve a API, executa e nunca deixa escapar excecao.
 *
 * O resultado do IPC volta INTACTO, mesma referencia — inclusive o `code`. A UI depende de
 * `SOURCE_MUTATED` chegar aqui sem traducao para dizer "o layout de origem mudou, reveja
 * antes de gravar" em vez de "falha ao gravar". Reembalar o resultado aqui seria a maneira
 * mais facil de perder essa informacao sem ninguem notar.
 */
async function callBridge<T>(
  operation: HeroGridOperation,
  invoke: (api: HeroGridApi) => Promise<HeroGridResult<T>>,
): Promise<HeroGridResult<T>> {
  const api = resolveApi();
  if (!api) return unavailable(operation);

  try {
    const result = await invoke(api);
    // Preload antigo/quebrado pode resolver `undefined`. Sem esta guarda o `result.success`
    // de quem chama estouraria TypeError bem longe da causa.
    if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
      return {
        success: false,
        error: `Operacao "${operation}" devolveu resposta invalida do processo principal.`,
      };
    }
    return result;
  } catch (err) {
    return {
      success: false,
      code: inferCode(err),
      // S-2: so a mensagem da excecao, nunca os argumentos (que carregam caminho absoluto
      // e o conteudo do arquivo de grid).
      error: `Operacao "${operation}" falhou: ${messageOf(err)}`,
    };
  }
}

/* ------------------------------------------------------------------ *
 * As seis operacoes
 * ------------------------------------------------------------------ */

export function listAccounts(): Promise<HeroGridResult<SteamAccountCandidate[]>> {
  return callBridge('listAccounts', (api) => api.listAccounts());
}

export function readFile(args: { path: string }): Promise<HeroGridResult<GridReadPayload>> {
  return callBridge('readFile', (api) => api.readFile(args));
}

export function writeFile(
  args: GridWriteRequest,
): Promise<HeroGridResult<{ backupPath: string; bytesWritten: number }>> {
  return callBridge('writeFile', (api) => api.writeFile(args));
}

export function restoreBackup(
  args: { path: string; backupPath?: string },
): Promise<HeroGridResult<{ restoredFrom: string }>> {
  return callBridge('restoreBackup', (api) => api.restoreBackup(args));
}

export function listBackups(args: { path: string }): Promise<HeroGridResult<GridBackupEntry[]>> {
  return callBridge('listBackups', (api) => api.listBackups(args));
}

export function isDotaRunning(): Promise<
  HeroGridResult<{ running: boolean; method: 'ps' | 'tasklist' | 'unsupported' }>
> {
  return callBridge('isDotaRunning', (api) => api.isDotaRunning());
}

/**
 * As seis operacoes reunidas, com o tipo amarrado a `HeroGridApi`.
 *
 * Nao é acucar: a anotacao faz `tsc -b` falhar se `HeroGridApi` ganhar uma operacao que a
 * ponte nao implemente, e é sobre este objeto que o teste itera para garantir que TODA
 * operacao — inclusive uma futura — devolva indisponivel no caminho browser. Sem um ponto
 * unico de enumeracao, uma operacao nova entraria sem cobertura desse ramo.
 */
export const heroGridBridge: { [K in keyof HeroGridApi]: HeroGridApi[K] } = {
  listAccounts,
  readFile,
  writeFile,
  restoreBackup,
  listBackups,
  isDotaRunning,
};
