// `describe`/`it`/`expect` vem dos globais do vitest (`globals: true` no vitest.config.ts).
// Sem `import` aqui: o arquivo é CommonJS de verdade, como o modulo sob teste, e é isso que
// mantem o oxlint capaz de parsea-lo.

const path = require('path');

const { decomposeGridPath, assertAllowedGridPath, GRID_FILE_NAME } = require('./pathGuard.cjs');

/**
 * `path.resolve` aqui, e nao a string crua, por causa do Windows.
 *
 * `pathGuard.cjs` normaliza a entrada com `path.resolve`, que no Windows PREFIXA a letra do
 * drive (`\home\x` -> `C:\home\x`), enquanto `steamRootCandidates` monta as raizes so com
 * `path.join` e nao prefixa nada. Com caminho POSIX cravado os dois lados divergiam e a
 * guarda recusava a propria raiz valida — falha que aparecia SO no runner do Windows.
 *
 * Em producao isso nao acontece: no Windows as raizes vem do registro ou de
 * `C:\Program Files (x86)\Steam`, ja com drive nos dois lados. O defeito era do teste, nao
 * do modulo — e resolver os caminhos na origem mantem o teste identico em toda plataforma.
 */
const HOME = path.resolve('/home/jogador');
const NATIVE = path.join(HOME, '.local/share/Steam');
const grid = (root, id3) => path.join(root, 'userdata', String(id3), '570', 'remote', 'cfg', GRID_FILE_NAME);

/**
 * `realpathSync` falso: as tres raizes de Linux apontam para a nativa, como na maquina real.
 * Sem isso o teste nao distingue "a guarda aceita a raiz certa" de "a guarda aceita
 * qualquer coisa que exista no disco de quem roda o teste".
 */
const fsImpl = {
  realpathSync: (p) => {
    if (p === path.join(HOME, '.steam/steam') || p === path.join(HOME, '.steam/root')) return NATIVE;
    return p;
  },
};

const opts = (extra = {}) => ({ platform: 'linux', homeDir: HOME, fsImpl, ...extra });

describe('decomposeGridPath — a forma exigida pelo contrato', () => {
  it('decompoe o caminho canonico em raiz e id3', () => {
    expect(decomposeGridPath(grid(NATIVE, 86738327))).toEqual({
      steamRoot: NATIVE,
      steamId3: '86738327',
    });
  });

  it('recusa nome de arquivo diferente de hero_grid_config.json', () => {
    expect(decomposeGridPath(path.join(NATIVE, 'userdata/1/570/remote/cfg/outro.json'))).toBeNull();
  });

  it('recusa quando falta qualquer segmento da forma userdata/<id3>/570/remote/cfg', () => {
    expect(decomposeGridPath(path.join(NATIVE, 'userdata/1/570/cfg', GRID_FILE_NAME))).toBeNull();
    expect(decomposeGridPath(path.join(NATIVE, 'userdata/1/571/remote/cfg', GRID_FILE_NAME))).toBeNull();
    expect(decomposeGridPath(path.join(NATIVE, '1/570/remote/cfg', GRID_FILE_NAME))).toBeNull();
  });

  // I-26 vale aqui tambem: `0` e `anonymous` existem em userdata/ e nao sao contas, entao
  // nao podem servir de caminho valido para escrita.
  it('I-26: recusa as pseudo-contas 0 e anonymous na posicao do id3', () => {
    expect(decomposeGridPath(grid(NATIVE, '0'))).toBeNull();
    expect(decomposeGridPath(grid(NATIVE, 'anonymous'))).toBeNull();
  });

  it('recusa entrada vazia, nao-string e caminho relativo sem a forma', () => {
    expect(decomposeGridPath('')).toBeNull();
    expect(decomposeGridPath(null)).toBeNull();
    expect(decomposeGridPath(undefined)).toBeNull();
    expect(decomposeGridPath(42)).toBeNull();
  });
});

describe('assertAllowedGridPath — a guarda S-1', () => {
  it('aceita o caminho sob a raiz Steam nativa', () => {
    const r = assertAllowedGridPath(grid(NATIVE, 86738327), opts());
    expect(r.allowed).toBe(true);
    expect(r.via).toBe('STEAM_ROOT');
    expect(r.steamId3).toBe('86738327');
  });

  // O caso da maquina real: ~/.steam/steam é symlink para ~/.local/share/Steam. Recusar por
  // diferenca de symlink recusaria a unica conta que existe.
  it('aceita raiz que é symlink para uma raiz reconhecida (o caso da maquina real)', () => {
    const symlinked = path.join(HOME, '.steam', 'steam');
    expect(assertAllowedGridPath(grid(symlinked, 86738327), opts()).allowed).toBe(true);
  });

  it('aceita as raizes Flatpak e Snap do contrato', () => {
    const flatpak = path.join(HOME, '.var/app/com.valvesoftware.Steam/.local/share/Steam');
    const snap = path.join(HOME, 'snap/steam/common/.local/share/Steam');
    expect(assertAllowedGridPath(grid(flatpak, 1), opts()).allowed).toBe(true);
    expect(assertAllowedGridPath(grid(snap, 1), opts()).allowed).toBe(true);
  });

  // A razao de a guarda existir: sem ela o renderer manda o main gravar em qualquer lugar.
  // Dois motivos DIFERENTES de recusa, e vale distinguir: caminho que nem tem a forma do
  // contrato para em `BAD_SHAPE`, e caminho com a forma certa sob raiz desconhecida para em
  // `UNKNOWN_STEAM_ROOT`. Colapsar os dois num `allowed: false` esconderia a guarda de forma
  // passar a aceitar qualquer coisa.
  it('recusa caminho solto, que nem tem a forma userdata/<id3>/570/remote/cfg', () => {
    const r = assertAllowedGridPath(path.resolve('/tmp/qualquer/hero_grid_config.json'), opts());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('BAD_SHAPE');
  });

  it('recusa caminho com a forma certa mas sob raiz Steam nao reconhecida', () => {
    const r = assertAllowedGridPath(grid(path.resolve('/opt/steam-pirata'), 86738327), opts());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('UNKNOWN_STEAM_ROOT');
  });

  it('recusa arquivo que nao é hero_grid_config.json, mesmo sob a raiz certa', () => {
    const r = assertAllowedGridPath(path.join(NATIVE, 'userdata/1/570/remote/cfg/config.vdf'), opts());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('NOT_GRID_FILE');
  });

  // Travessia: o caminho "comeca" com a raiz valida mas escapa dela. `path.resolve` colapsa
  // o `..` antes da comparacao, entao a forma nem chega a bater.
  it('recusa travessia com .. que aparenta estar sob a raiz Steam', () => {
    const evil = path.join(NATIVE, 'userdata/1/570/remote/cfg/../../../../../../..', GRID_FILE_NAME);
    expect(assertAllowedGridPath(evil, opts()).allowed).toBe(false);
  });

  // Prefixo de string nao é prefixo de caminho: `/home/jogador/.local/share/SteamEvil` nao
  // esta sob `/home/jogador/.local/share/Steam`, embora `startsWith` diga que sim.
  it('recusa raiz que apenas COMECA com o nome de uma raiz reconhecida', () => {
    const r = assertAllowedGridPath(grid(`${NATIVE}Evil`, 1), opts());  // sufixo colado: nao é filho
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('UNKNOWN_STEAM_ROOT');
  });

  describe('caminho manual (FR-006)', () => {
    const manual = path.resolve('/mnt/disco2/SteamLibrary/hero_grid_config.json');

    it('aceita exatamente o caminho manual configurado pelo jogador', () => {
      const r = assertAllowedGridPath(manual, opts({ manualPath: manual }));
      expect(r.allowed).toBe(true);
      expect(r.via).toBe('MANUAL_PATH');
    });

    // O jogador aponta um ARQUIVO, nao autoriza uma arvore. Um vizinho no mesmo diretorio
    // nao herda a autorizacao.
    it('recusa vizinho no mesmo diretorio do caminho manual', () => {
      const vizinho = path.resolve('/mnt/disco2/SteamLibrary/outra/hero_grid_config.json');
      expect(assertAllowedGridPath(vizinho, opts({ manualPath: manual })).allowed).toBe(false);
    });

    it('sem caminho manual configurado, o mesmo caminho é recusado', () => {
      expect(assertAllowedGridPath(manual, opts()).allowed).toBe(false);
    });
  });

  it('recusa entrada vazia e nao-string sem lancar', () => {
    for (const bad of ['', '   ', null, undefined, 0, {}, []]) {
      expect(assertAllowedGridPath(bad, opts()).allowed).toBe(false);
    }
  });
});
