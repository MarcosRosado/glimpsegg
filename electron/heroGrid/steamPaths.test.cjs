// `describe`/`it`/`expect`/`vi` vem dos globais do vitest (`globals: true` no
// vitest.config.ts). Nao ha `import` aqui de proposito: este arquivo é CommonJS de verdade,
// como o modulo sob teste, e é isso que mantem o oxlint capaz de parsea-lo. O Vitest 4
// recusa `require('vitest')`, entao os globais sao a unica saida que preserva as duas coisas.

const path = require('path');

const {
  steamRootCandidates,
  isAccountDirName,
  gridFilePathFor,
  listSteamAccounts,
} = require('./steamPaths.cjs');

/**
 * Testes de `steamPaths.cjs` — I-25, I-26 e I-27 de `specs/001-meta-hero-grid/data-model.md`.
 *
 * Nenhum teste toca no filesystem real: o Steam de quem roda a suite nao é fixture, e um
 * teste que le `~/.steam` passa na minha maquina e falha no CI. Todo I/O vai por `fsImpl`.
 */

/**
 * Caminhos montados com `path.resolve`/`path.join`, nunca com literal POSIX.
 *
 * `steamRootCandidates` monta as raizes com `path.join`, que no Windows usa `\`. Um literal
 * com `/` no fake de `fs` nunca casa com o que o modulo gera, entao a raiz "nao existe", é
 * descartada em silencio, e o teste de dedupe (I-25) via duas instalacoes distintas virarem
 * uma — falha que aparecia SO no runner do Windows, e que passa despercebida porque o
 * sintoma (uma conta a menos) parece ser exatamente o que o dedupe deveria fazer.
 */
const HOME = path.resolve('/home/tester');
const REAL_ROOT = path.join(HOME, '.local', 'share', 'Steam');
const FLATPAK_ROOT = path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam');
/** Raiz que existe mas cujo `userdata/` nao pode ser lido — usada no teste de degradacao. */
const SEM_USERDATA = path.resolve('/opt/steam-sem-userdata');

/**
 * `fs` falso.
 *
 * @param {object} spec
 * @param {string[]} spec.exists caminhos que "existem"
 * @param {Record<string, string>} [spec.realpath] candidato -> caminho real (symlink)
 * @param {Record<string, string[]|Error>} [spec.readdir] caminho -> entradas, ou Error a lancar
 * @param {string[]} [spec.realpathFails] caminhos cujo `realpathSync` lanca
 */
function makeFakeFs(spec) {
  const exists = new Set(spec.exists || []);
  const realpath = spec.realpath || {};
  const readdir = spec.readdir || {};
  const realpathFails = new Set(spec.realpathFails || []);

  // Qualquer tentativa de ESCRITA é falha de teste: este modulo é somente leitura, e I-27
  // proibe criar o `hero_grid_config.json` quando ele nao existe.
  const forbidden = () => {
    throw new Error('steamPaths nao pode escrever no filesystem');
  };

  return {
    existsSync: (p) => exists.has(String(p)),
    realpathSync: (p) => {
      const key = String(p);
      if (realpathFails.has(key)) throw new Error(`EACCES: realpath ${key}`);
      return realpath[key] || key;
    },
    readdirSync: (p) => {
      const key = String(p);
      const entries = readdir[key];
      if (entries instanceof Error) throw entries;
      if (!entries) throw new Error(`ENOENT: readdir ${key}`);
      return entries;
    },
    writeFileSync: forbidden,
    mkdirSync: forbidden,
    openSync: forbidden,
  };
}

describe('isAccountDirName', () => {
  it('aceita inteiro positivo', () => {
    expect(isAccountDirName('1')).toBe(true);
    expect(isAccountDirName('12')).toBe(true);
    expect(isAccountDirName('123456789')).toBe(true);
  });

  it('I-26: recusa as pseudo-contas "0" e "anonymous" que existem de verdade em userdata/', () => {
    expect(isAccountDirName('0')).toBe(false);
    expect(isAccountDirName('anonymous')).toBe(false);
  });

  it('recusa string vazia, negativo, decimal, sufixo nao numerico e espaco a esquerda', () => {
    expect(isAccountDirName('')).toBe(false);
    expect(isAccountDirName('-1')).toBe(false);
    expect(isAccountDirName('1.5')).toBe(false);
    expect(isAccountDirName('12a')).toBe(false);
    expect(isAccountDirName(' 12')).toBe(false);
    expect(isAccountDirName('00')).toBe(false);
    expect(isAccountDirName('012')).toBe(false);
  });

  it('recusa o que nao é string sem lancar', () => {
    expect(isAccountDirName(undefined)).toBe(false);
    expect(isAccountDirName(null)).toBe(false);
    expect(isAccountDirName(12)).toBe(false);
    expect(isAccountDirName({})).toBe(false);
  });
});

describe('gridFilePathFor', () => {
  it('monta o caminho do contrato: userdata/<id3>/570/remote/cfg/hero_grid_config.json', () => {
    expect(gridFilePathFor(REAL_ROOT, '123456')).toBe(
      path.join(REAL_ROOT, 'userdata', '123456', '570', 'remote', 'cfg', 'hero_grid_config.json'),
    );
  });

  it('normaliza pelo path.join em vez de concatenar barra na mao', () => {
    expect(gridFilePathFor('/a/b/', '7')).toBe(
      path.join('/a/b', 'userdata', '7', '570', 'remote', 'cfg', 'hero_grid_config.json'),
    );
  });

  it('aceita id3 numerico, porque o caminho é montado com String()', () => {
    expect(gridFilePathFor(REAL_ROOT, 42)).toBe(gridFilePathFor(REAL_ROOT, '42'));
  });
});

describe('steamRootCandidates', () => {
  it('devolve as cinco raizes do Linux na ordem do contrato', () => {
    expect(steamRootCandidates('linux', HOME)).toEqual([
      path.join(HOME, '.steam', 'steam'),
      path.join(HOME, '.steam', 'root'),
      path.join(HOME, '.local', 'share', 'Steam'),
      path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
      path.join(HOME, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
    ]);
  });

  it('devolve a raiz unica do macOS', () => {
    expect(steamRootCandidates('darwin', HOME)).toEqual([
      path.join(HOME, 'Library', 'Application Support', 'Steam'),
    ]);
  });

  it('no Windows poe o valor do registro antes do fallback de Program Files', () => {
    const roots = steamRootCandidates('win32', HOME, () => 'D:\\Games\\Steam');
    expect(roots).toEqual(['D:\\Games\\Steam', 'C:\\Program Files (x86)\\Steam']);
  });

  it('degrada para so o fallback quando o registro nao pode ser lido', () => {
    // Ler o registro pode falhar (chave ausente, `reg.exe` fora do PATH) e isso é normal.
    expect(steamRootCandidates('win32', HOME, () => null)).toEqual([
      'C:\\Program Files (x86)\\Steam',
    ]);
    expect(
      steamRootCandidates('win32', HOME, () => {
        throw new Error('reg.exe ausente');
      }),
    ).toEqual(['C:\\Program Files (x86)\\Steam']);
  });

  it('devolve [] em plataforma desconhecida, sem lancar', () => {
    expect(steamRootCandidates('aix', HOME)).toEqual([]);
    expect(steamRootCandidates(undefined, HOME)).toEqual([]);
  });
});

describe('listSteamAccounts', () => {
  it('I-25: tres raizes com o mesmo realpath rendem UMA entrada por conta, nao tres', () => {
    // Este é o caso da maquina real: `~/.steam/steam`, `~/.steam/root` e
    // `~/.local/share/Steam` sao o MESMO diretorio por symlink. Sem o dedupe por
    // realpath a UI ofereceria a mesma conta tres vezes.
    const linked = [
      path.join(HOME, '.steam', 'steam'),
      path.join(HOME, '.steam', 'root'),
      path.join(HOME, '.local', 'share', 'Steam'),
    ];
    const fsImpl = makeFakeFs({
      exists: [...linked, path.join(REAL_ROOT, 'userdata', '123', '570', 'remote', 'cfg', 'hero_grid_config.json')],
      realpath: { [linked[0]]: REAL_ROOT, [linked[1]]: REAL_ROOT, [linked[2]]: REAL_ROOT },
      readdir: { [path.join(REAL_ROOT, 'userdata')]: ['123'] },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    expect(accounts).toHaveLength(1);
    expect(accounts[0].steamId3).toBe('123');
    expect(accounts[0].steamRoot).toBe(REAL_ROOT);
    expect(accounts[0].gridFileExists).toBe(true);
  });

  it('I-25: instalacoes de verdade distintas (nativa + Flatpak) continuam sendo duas entradas', () => {
    const native = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [native, FLATPAK_ROOT],
      readdir: {
        [path.join(REAL_ROOT, 'userdata')]: ['123'],
        [path.join(FLATPAK_ROOT, 'userdata')]: ['123'],
      },
      realpath: { [native]: REAL_ROOT },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.steamRoot).sort()).toEqual([FLATPAK_ROOT, REAL_ROOT].sort());
  });

  it('I-26: "0" e "anonymous" nunca aparecem no resultado, e as contas numericas aparecem', () => {
    const root = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [root],
      realpath: { [root]: REAL_ROOT },
      readdir: {
        [path.join(REAL_ROOT, 'userdata')]: ['0', 'anonymous', '123456', '9', 'ac', ''],
      },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    // Ordem deterministica: id3 NUMERICO crescente, entao '9' antes de '123456'.
    expect(accounts.map((a) => a.steamId3)).toEqual(['9', '123456']);
  });

  it('I-27: conta sem hero_grid_config.json vem com gridFileExists false, sem lancar e sem criar arquivo', () => {
    const root = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      // A raiz existe; o arquivo de grids NAO. É o estado de quem nunca montou grid no Dota.
      exists: [root],
      realpath: { [root]: REAL_ROOT },
      readdir: { [path.join(REAL_ROOT, 'userdata')]: ['123456'] },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toEqual({
      steamId3: '123456',
      steamRoot: REAL_ROOT,
      gridFilePath: gridFilePathFor(REAL_ROOT, '123456'),
      gridFileExists: false,
      isConfiguredProfile: false,
    });
    // `writeFileSync`/`mkdirSync` do fake lancam: se algo tivesse tentado criar o arquivo,
    // o teste acima nao teria chegado aqui.
  });

  it('pre-seleciona a conta configurada, colocando-a em primeiro', () => {
    const root = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [root],
      realpath: { [root]: REAL_ROOT },
      readdir: { [path.join(REAL_ROOT, 'userdata')]: ['111', '222', '333'] },
    });

    const accounts = listSteamAccounts({
      platform: 'linux',
      homeDir: HOME,
      fsImpl,
      configuredSteamAccountId: '333',
    });

    expect(accounts.map((a) => a.steamId3)).toEqual(['333', '111', '222']);
    expect(accounts.map((a) => a.isConfiguredProfile)).toEqual([true, false, false]);
  });

  it('aceita configuredSteamAccountId numerico, como o app guarda o steamAccountId', () => {
    const root = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [root],
      realpath: { [root]: REAL_ROOT },
      readdir: { [path.join(REAL_ROOT, 'userdata')]: ['111', '222'] },
    });

    const accounts = listSteamAccounts({
      platform: 'linux',
      homeDir: HOME,
      fsImpl,
      configuredSteamAccountId: 222,
    });

    expect(accounts[0].steamId3).toBe('222');
    expect(accounts[0].isConfiguredProfile).toBe(true);
  });

  it('nao lanca e devolve [] quando nenhuma raiz existe', () => {
    const fsImpl = makeFakeFs({ exists: [] });
    expect(listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl })).toEqual([]);
  });

  it('descarta a raiz que falha em realpath ou readdir e mantem as demais', () => {
    const broken = path.join(HOME, '.steam', 'steam');
    const noUserdata = path.join(HOME, '.steam', 'root');
    const good = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [broken, noUserdata, good],
      realpathFails: [broken],
      realpath: { [noUserdata]: SEM_USERDATA, [good]: REAL_ROOT },
      readdir: {
        [path.join(SEM_USERDATA, 'userdata')]: new Error('EACCES: permission denied'),
        [path.join(REAL_ROOT, 'userdata')]: ['123456'],
      },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    expect(accounts.map((a) => a.steamId3)).toEqual(['123456']);
  });

  it('aceita entradas de readdir com withFileTypes (Dirent) alem de string', () => {
    const root = path.join(HOME, '.local', 'share', 'Steam');
    const fsImpl = makeFakeFs({
      exists: [root],
      realpath: { [root]: REAL_ROOT },
      readdir: { [path.join(REAL_ROOT, 'userdata')]: [{ name: '777' }, { name: 'anonymous' }] },
    });

    const accounts = listSteamAccounts({ platform: 'linux', homeDir: HOME, fsImpl });

    expect(accounts.map((a) => a.steamId3)).toEqual(['777']);
  });

  it('devolve [] em plataforma nao suportada, sem consultar o filesystem', () => {
    const fsImpl = makeFakeFs({
      exists: [],
      readdir: {},
    });
    // `existsSync` do fake nunca deveria achar nada aqui, mas o ponto é nao lancar.
    expect(listSteamAccounts({ platform: 'aix', homeDir: HOME, fsImpl })).toEqual([]);
  });
});
