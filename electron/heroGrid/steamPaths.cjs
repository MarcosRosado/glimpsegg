/**
 * Deteccao das raizes do Steam e das contas em `userdata/`.
 *
 * Mora em `electron/` porque é I/O de disco: só o main process pode olhar o filesystem do
 * jogador. CommonJS e sem `require('electron')` de proposito — o teste
 * (`steamPaths.test.cjs`) roda no vitest, em Node puro, e um `require('electron')` no topo
 * derrubaria o modulo antes da primeira asserção. O que vier do Electron entra por
 * parametro.
 *
 * As raizes e o formato do caminho estao em `specs/001-meta-hero-grid/contracts/hero-grid-file.md`.
 * As tres decisoes que este arquivo existe para sustentar, todas medidas na maquina real
 * (research.md R2):
 *
 *  1. I-25 — `~/.steam/steam`, `~/.steam/root` e `~/.local/share/Steam` sao o MESMO
 *     diretorio por symlink. Sem `realpath` + dedupe, a UI oferece a mesma conta tres vezes.
 *  2. I-26 — `userdata/` contem `0` e `anonymous` de verdade, e nenhum dos dois é conta.
 *  3. `cfg/` esta no nivel 5, entao a deteccao MONTA o caminho em vez de varrer o disco
 *     (uma busca com `-maxdepth 4` nao acha o arquivo).
 *
 * Nada aqui lanca: raiz que nao existe, `readdir` sem permissao ou `realpath` quebrado sao
 * raizes DESCARTADAS, nao falha da funcao — a tela de escolha de conta tem de abrir mesmo
 * quando uma das cinco raizes do Linux esta podre.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

/** Sub-caminho fixo do Dota 2 (appid 570) dentro de `userdata/<id3>/`. */
const GRID_RELATIVE_PARTS = ['570', 'remote', 'cfg', 'hero_grid_config.json'];

/**
 * Le `HKCU\Software\Valve\Steam\SteamPath`.
 *
 * Falhar aqui é NORMAL e nao é erro do app: `reg.exe` pode nao estar no PATH, a chave pode
 * nao existir (Steam nunca instalado) e a saida pode vir em outro idioma. Devolve `null` e
 * o chamador segue para o fallback `C:\Program Files (x86)\Steam`.
 */
function readRegistrySteamPath() {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    });
    const match = /SteamPath\s+REG_[A-Z_]+\s+(.+)/i.exec(String(out));
    if (!match) return null;
    const value = match[1].trim();
    // O Steam grava o valor com barras normais ("C:/Program Files (x86)/Steam").
    return value ? path.normalize(value) : null;
  } catch {
    // Ver comentario acima: ausencia de registro nao é excecao a propagar.
    return null;
  }
}

/**
 * Raizes candidatas do Steam para a plataforma, NA ORDEM DO CONTRATO.
 *
 * Pura no que importa para o teste: nao toca no filesystem. Em `win32` consulta o registro,
 * e por isso o leitor é injetavel — o teste passa um stub e nunca depende de `reg.exe`.
 * Plataforma desconhecida devolve `[]`, que degrada para "nenhuma conta detectada" em vez
 * de estourar (o codigo `UNSUPPORTED_PLATFORM` é decisao da camada de cima).
 */
function steamRootCandidates(platform, homeDir, registryReader = readRegistrySteamPath) {
  const home = homeDir || os.homedir();

  if (platform === 'linux') {
    return [
      path.join(home, '.steam', 'steam'),
      path.join(home, '.steam', 'root'),
      path.join(home, '.local', 'share', 'Steam'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
      path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
    ];
  }

  if (platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', 'Steam')];
  }

  if (platform === 'win32') {
    const roots = [];
    let fromRegistry = null;
    try {
      fromRegistry = typeof registryReader === 'function' ? registryReader() : null;
    } catch {
      // Leitor injetado que lanca tambem é so "sem registro".
      fromRegistry = null;
    }
    if (typeof fromRegistry === 'string' && fromRegistry.trim() !== '') {
      roots.push(fromRegistry.trim());
    }
    roots.push('C:\\Program Files (x86)\\Steam');
    return roots;
  }

  return [];
}

/**
 * I-26: nome de diretorio em `userdata/` que é conta de verdade.
 *
 * So inteiro positivo. `0` e `anonymous` existem na maquina real e nao sao contas; id3 do
 * Steam nunca tem zero a esquerda, entao `'012'` tambem cai fora — melhor recusar um nome
 * improvavel do que deixar passar lixo e montar caminho para um diretorio inventado.
 */
function isAccountDirName(name) {
  if (typeof name !== 'string') return false;
  return /^[1-9][0-9]*$/.test(name);
}

/**
 * Monta o caminho do arquivo de grids. Deterministico e sem I/O: o contrato fixa
 * `<steamRoot>/userdata/<id3>/570/remote/cfg/hero_grid_config.json`, entao varrer o disco
 * seria mais lento e menos correto.
 */
function gridFilePathFor(steamRoot, steamId3) {
  return path.join(steamRoot, 'userdata', String(steamId3), ...GRID_RELATIVE_PARTS);
}

/** Nome do diretorio, aceitando tanto `string` quanto `Dirent` (`withFileTypes`). */
function dirEntryName(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.name === 'string') return entry.name;
  return null;
}

/**
 * Contas Steam detectadas, prontas para a tela de escolha de conta (FR-005).
 *
 * Tudo injetavel para o teste (`fsImpl`, `platform`, `homeDir`) — o teste nao pode ler o
 * Steam real nem escrever no disco.
 *
 * @param {object} [options]
 * @param {string} [options.platform] default `process.platform`
 * @param {string} [options.homeDir] default `os.homedir()`
 * @param {object} [options.fsImpl] default `fs`; precisa de `existsSync`, `realpathSync`, `readdirSync`
 * @param {string|null} [options.configuredSteamAccountId] id3 que o app ja guarda, para pre-selecionar
 * @param {Function} [options.registryReader] so `win32`
 * @returns {Array<{steamId3: string, steamRoot: string, gridFilePath: string, gridFileExists: boolean, isConfiguredProfile: boolean}>}
 */
function listSteamAccounts(options) {
  const opts = options || {};
  const platform = opts.platform || process.platform;
  const homeDir = opts.homeDir || os.homedir();
  const fsImpl = opts.fsImpl || fs;
  const registryReader = opts.registryReader || readRegistrySteamPath;

  const configuredId =
    opts.configuredSteamAccountId === null || opts.configuredSteamAccountId === undefined
      ? null
      : String(opts.configuredSteamAccountId).trim() || null;

  const candidates = steamRootCandidates(platform, homeDir, registryReader);

  const accounts = [];
  // I-25: a chave do dedupe é o caminho REAL, nunca o candidato — os tres primeiros
  // candidatos do Linux resolvem para o mesmo `/home/<user>/.local/share/Steam`.
  const seenRoots = new Set();

  for (const candidate of candidates) {
    let realRoot;
    try {
      if (!fsImpl.existsSync(candidate)) continue;
      realRoot = fsImpl.realpathSync(candidate);
    } catch {
      // Raiz ilegivel é raiz descartada. Seguir para a proxima.
      continue;
    }
    if (typeof realRoot !== 'string' || realRoot === '') continue;
    if (seenRoots.has(realRoot)) continue;
    seenRoots.add(realRoot);

    let entries;
    try {
      entries = fsImpl.readdirSync(path.join(realRoot, 'userdata'));
    } catch {
      // `userdata/` ausente (Steam instalado, nunca logado) ou sem permissao.
      continue;
    }
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      const name = dirEntryName(entry);
      if (!isAccountDirName(name)) continue;

      const gridFilePath = gridFilePathFor(realRoot, name);
      let gridFileExists = false;
      try {
        gridFileExists = Boolean(fsImpl.existsSync(gridFilePath));
      } catch {
        // I-27: nao dar para saber é o mesmo que "ainda nao existe" — estado
        // apresentavel, e em nenhum caso este modulo cria o arquivo.
        gridFileExists = false;
      }

      accounts.push({
        steamId3: name,
        steamRoot: realRoot,
        gridFilePath,
        gridFileExists,
        isConfiguredProfile: configuredId !== null && name === configuredId,
      });
    }
  }

  // Ordem estavel: a UI pre-seleciona o primeiro item, e o teste precisa de resultado
  // deterministico. Conta configurada primeiro, depois id3 numerico crescente (nao
  // lexicografico: '9' vem antes de '10'), e a raiz desempata quando o mesmo id3 aparece
  // em duas instalacoes distintas (Flatpak + nativa, por exemplo).
  accounts.sort((a, b) => {
    if (a.isConfiguredProfile !== b.isConfiguredProfile) return a.isConfiguredProfile ? -1 : 1;
    const byId = Number(a.steamId3) - Number(b.steamId3);
    if (byId !== 0) return byId;
    return a.steamRoot < b.steamRoot ? -1 : a.steamRoot > b.steamRoot ? 1 : 0;
  });

  return accounts;
}

module.exports = {
  steamRootCandidates,
  isAccountDirName,
  gridFilePathFor,
  listSteamAccounts,
  readRegistrySteamPath,
};
