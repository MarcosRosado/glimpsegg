// Deteccao de "o Dota 2 esta aberto agora?" para a feature de hero grid.
//
// O modulo e dividido em duas metades de proposito: `parseProcessList` e pura (recebe a saida
// crua do comando, devolve boolean) e por isso e testavel pelo vitest via
// `tests/**/*.test.cjs`; `isDotaRunning` e a casca de I/O, com injecao de dependencia para
// que o teste nunca precise executar `ps` ou `tasklist` de verdade.

const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');

// Promisificado em vez de `execFileSync`: isso roda no processo main, que e a mesma thread que
// atende o IPC e desenha a janela. Um `execFileSync` de ate 2s congelaria a UI inteira do app
// a cada checagem — custo alto para uma informacao que so gera um aviso na tela.
const execFileAsync = promisify(execFile);

// Curto de proposito: se `ps`/`tasklist` nao respondeu em 2s, a maquina esta em um estado em que
// esperar mais nao melhora a resposta, e a degradacao (ver `isDotaRunning`) e segura.
const COMMAND_TIMEOUT_MS = 2000;

// Teto generoso para a lista de processos de uma maquina carregada; sem isso o Node aborta com
// ENOBUFS em maquinas com muitos processos e a checagem falharia por motivo errado.
const COMMAND_MAX_BUFFER = 4 * 1024 * 1024;

const UNIX_EXECUTABLE_NAME = 'dota2';
const WINDOWS_IMAGE_NAME = 'dota2.exe';

/**
 * Decide se o Dota 2 esta na lista de processos.
 *
 * ESTA FUNCAO EXISTE SEPARADA E TESTADA POR UM MOTIVO ESPECIFICO (R12): casar substring da linha
 * de comando produz FALSO POSITIVO PERMANENTE. Na pesquisa, `pgrep -a -f 'dota2|dota\.sh'` casou
 * com o proprio shell que rodava o comando, porque o padrao aparecia na linha de comando dele.
 * Qualquer terminal, editor ou script cujo comando contenha "dota2" — inclusive este proprio
 * projeto, cujo diretorio se chama `dota2-stratz-analyzer` — marcaria o Dota como aberto para
 * sempre, e a feature nunca escreveria o layout. A unica comparacao aceitavel e por NOME EXATO
 * de executavel.
 *
 * - Linux/macOS: `ps -A -o comm=` da uma linha por processo com so o nome do executavel (no
 *   macOS, o caminho completo dele). Comparacao: basename da linha === `dota2`. Usar basename
 *   continua sendo nome exato — nao e substring: `dota2-stratz-analyzer` tem basename
 *   `dota2-stratz-analyzer`, e uma linha de comando como `node /x/dota2-.../vite.js` tem
 *   basename `vite.js`. Ambos falham a comparacao, que e o comportamento desejado.
 * - Windows: `tasklist /FO CSV /NH` da CSV; o nome da imagem e o PRIMEIRO campo entre aspas.
 *   Comparacao: campo extraido === `dota2.exe`, case-insensitive (o Windows nao diferencia
 *   maiusculas em nome de executavel).
 *
 * @param {string|null|undefined} stdout Saida crua do comando.
 * @param {string} platform Valor no formato de `process.platform`.
 * @returns {boolean}
 */
function parseProcessList(stdout, platform) {
  if (typeof stdout !== 'string' || stdout.trim() === '') return false;

  const lines = stdout.split(/\r?\n/);

  if (platform === 'win32') {
    return lines.some((line) => extractWindowsImageName(line) === WINDOWS_IMAGE_NAME);
  }

  if (platform === 'linux' || platform === 'darwin') {
    return lines.some((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return false;
      return path.basename(trimmed) === UNIX_EXECUTABLE_NAME;
    });
  }

  // Plataforma que nao sabemos consultar: nao ha saida crua que possamos interpretar com
  // honestidade, entao nao afirmamos nada.
  return false;
}

/**
 * Extrai o nome da imagem de uma linha de `tasklist /FO CSV /NH`, normalizado para minusculas.
 * Devolve `null` quando a linha nao tem a forma esperada.
 */
function extractWindowsImageName(line) {
  const quoted = /^\s*"([^"]*)"/.exec(line);
  if (quoted) return quoted[1].trim().toLowerCase();

  // Fallback para uma variante sem aspas: ainda comparamos o campo inteiro, nunca substring.
  const trimmed = line.trim();
  if (trimmed === '') return null;
  return trimmed.split(',')[0].trim().toLowerCase();
}

/** Qual comando serve a plataforma. */
function methodForPlatform(platform) {
  if (platform === 'win32') return 'tasklist';
  if (platform === 'linux' || platform === 'darwin') return 'ps';
  return 'unsupported';
}

/**
 * Consulta a lista de processos da maquina.
 *
 * @param {{ platform?: string, execImpl?: Function }} [options] `execImpl(file, args, opts)` deve
 *   devolver `{ stdout }` ou a string de saida. Existe para o teste injetar saida fixa — nenhum
 *   teste deste modulo executa `ps` ou `tasklist` de verdade.
 * @returns {Promise<{ running: boolean, method: 'ps'|'tasklist'|'unsupported' }>}
 */
async function isDotaRunning(options = {}) {
  const platform = options.platform || process.platform;
  const execImpl = options.execImpl || execFileAsync;
  const method = methodForPlatform(platform);

  if (method === 'unsupported') {
    return { running: false, method: 'unsupported' };
  }

  const file = method === 'tasklist' ? 'tasklist' : 'ps';
  const args = method === 'tasklist' ? ['/FO', 'CSV', '/NH'] : ['-A', '-o', 'comm='];

  try {
    const result = await execImpl(file, args, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER,
      windowsHide: true,
    });
    const stdout = typeof result === 'string' ? result : result && result.stdout;
    return { running: parseProcessList(stdout, platform), method };
  } catch (err) {
    // Falha do comando (binario ausente, timeout, sandbox sem permissao) NAO lanca: degradamos
    // para `false`.
    //
    // Por que `false` e a degradacao certa, e nao `true`: a assimetria das consequencias. Falso
    // negativo = o jogador ve um aviso de menos e, se sair do Dota depois, o Dota pode
    // sobrescrever o layout com o estado que tinha em memoria — perda recuperavel (existe backup,
    // a origem nunca e tocada) e que a propria UI ja avisa que pode acontecer. Falso positivo
    // permanente = a feature nunca escreve nada, ou seja, fica inteiramente quebrada sem
    // sintoma que aponte a causa. Entre "aviso a menos" e "feature morta", o default e o
    // primeiro.
    console.warn(`[heroGrid] Falha ao consultar processos com "${file}":`, err && err.message ? err.message : err);
    return { running: false, method };
  }
}

module.exports = {
  parseProcessList,
  isDotaRunning,
  COMMAND_TIMEOUT_MS,
};
