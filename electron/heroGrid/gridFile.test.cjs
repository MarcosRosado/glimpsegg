// `describe`/`it`/`expect`/`beforeEach`/`afterEach` vem dos globais do vitest (`globals: true`
// no vitest.config.ts). Nao ha `import` aqui de proposito: este arquivo é CommonJS de verdade,
// como o modulo sob teste, e é isso que mantem o oxlint capaz de parsea-lo. O Vitest 4 recusa
// `require('vitest')`, entao os globais sao a unica saida que preserva as duas coisas.

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  readGridFile,
  writeGridFile,
  listGridBackups,
  restoreGridFile,
  deepEqual,
} = require('./gridFile.cjs');

/**
 * Testes de `electron/heroGrid/gridFile.cjs` — o codigo que escreve no arquivo INSUBSTITUIVEL do
 * jogador. Referencias `I-n` sao as invariantes de `specs/001-meta-hero-grid/data-model.md`;
 * `L-n`/`E-n` sao as regras de `specs/001-meta-hero-grid/contracts/hero-grid-file.md`.
 *
 * Por que estes testes rodam no processo main e nao em `src/`: a guarda de E-3/E-4 compara os
 * BYTES que vao para o disco. Testar um objeto que alguem prometeu ter serializado direito
 * deixaria de fora exatamente o passo que pode destruir o layout do jogador.
 *
 * Duas escolhas deliberadas de setup:
 *
 * 1. A base é a ANTI-FIXTURE (`hero-grid-adverse.json`), com TRES layouts. Com um layout so — o
 *    caso da fixture real — E-4 ("nenhum outro config alterado") passa por vazio: nao existe
 *    "outro config" para alterar. A invariante mais importante da feature seria verificada por
 *    uma assercao que nao pode falhar.
 * 2. O I/O acontece em `fs.mkdtempSync` dentro do `os.tmpdir()`, NUNCA no Steam real. Um teste
 *    que grava em `~/.local/share/Steam` destroi o grid de quem roda a suite — e é justamente o
 *    acidente que este modulo existe para tornar impossivel.
 */

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'services',
  '__fixtures__',
  'hero-grid-adverse.json',
);

/** Texto cru da anti-fixture. Usado byte a byte na verificacao de E-1. */
const ADVERSE_RAW = fs.readFileSync(FIXTURE_PATH, 'utf-8');
const ADVERSE_BYTES = fs.readFileSync(FIXTURE_PATH);

/** Detector de Dota injetado: nenhum teste executa `ps` de verdade (E-7). */
const dotaClosed = async () => ({ running: false, method: 'ps' });
const dotaOpen = async () => ({ running: true, method: 'ps' });

// E-8 depende de permissao de diretorio, e o root ignora permissao de diretorio.
const itUnlessRoot = typeof process.getuid === 'function' && process.getuid() === 0 ? it.skip : it;

let dir;
let gridPath;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glimpsegg-grid-'));
  gridPath = path.join(dir, 'hero_grid_config.json');
  fs.writeFileSync(gridPath, ADVERSE_RAW, 'utf-8');
});

afterEach(() => {
  // O teste de E-8 tira a permissao de escrita do diretorio; devolver antes de remover.
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* diretorio ja removido ou sem dono: o rmSync abaixo reporta o que importar */
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Objeto novo da anti-fixture a cada chamada — nenhum teste muta o do outro. */
function adverseFile() {
  return JSON.parse(ADVERSE_RAW);
}

/**
 * Serializa o texto a gravar. Estilo irrelevante de proposito: o main NAO serializa nada, e a
 * guarda compara objetos parseados — quem reproduz o estilo da Valve é `valveJson.ts`, em `src/`.
 */
function serialize(file) {
  return JSON.stringify(file, null, 2);
}

function diskText() {
  return fs.readFileSync(gridPath, 'utf-8');
}

function diskFile() {
  return JSON.parse(diskText());
}

function listDir() {
  return fs.readdirSync(dir).sort();
}

/**
 * Pedido de escrita valido: altera SO a ordem de `hero_ids` do config em `mirrorIndex`.
 *
 * O `configs[2]` da anti-fixture faz o papel de espelho nos testes de caminho feliz — a regra
 * é posicional (N-1), entao qualquer posicao serve desde que so ela mude.
 */
function requestReorderingMirror(mirrorIndex = 2, mutate) {
  const file = adverseFile();
  file.configs[mirrorIndex].categories[0].hero_ids.reverse();
  if (mutate) mutate(file);
  return {
    path: gridPath,
    content: serialize(file),
    expectedSourceIndex: 0,
    expectedSourceConfig: adverseFile().configs[0],
    expectedMirrorIndex: mirrorIndex,
    expectedConfigCount: file.configs.length,
    allowWhileDotaRunning: true,
  };
}

/** Config sintetico para o caso "espelho novo nasce no fim de `configs`" (N-6). */
function newMirrorConfig() {
  const source = adverseFile().configs[0];
  return {
    config_name: 'Meta Espelho — GlimpseGG',
    categories: source.categories.map((category) => ({
      ...category,
      hero_ids: [...category.hero_ids].reverse(),
    })),
  };
}

describe('gridFile — leitura', () => {
  it('L-1: arquivo ausente devolve exists:false, sem erro e SEM criar o arquivo', () => {
    const missing = path.join(dir, 'sub', 'hero_grid_config.json');

    const result = readGridFile(missing);

    expect(result.exists).toBe(false);
    expect(result.file).toBeNull();
    expect(result.code).toBeUndefined();
    expect(fs.existsSync(missing)).toBe(false);
    expect(fs.existsSync(path.join(dir, 'sub'))).toBe(false);
  });

  it('L-1: le a anti-fixture inteira e devolve o texto cru para o backup byte a byte', () => {
    const result = readGridFile(gridPath);

    expect(result.exists).toBe(true);
    expect(result.file.configs).toHaveLength(3);
    expect(result.file.version).toBe(4);
    expect(result.raw).toBe(ADVERSE_RAW);
  });

  it('L-2: JSON invalido devolve INVALID_JSON e nao sobrescreve o arquivo', () => {
    fs.writeFileSync(gridPath, '{ "version": 4, "configs": [ ', 'utf-8');
    const before = diskText();

    const result = readGridFile(gridPath);

    expect(result.file).toBeNull();
    expect(result.code).toBe('INVALID_JSON');
    expect(diskText()).toBe(before);
  });

  it('L-3: configs ausente ou nao-array é tratado como arquivo invalido', () => {
    fs.writeFileSync(gridPath, JSON.stringify({ version: 4 }), 'utf-8');
    expect(readGridFile(gridPath).code).toBe('INVALID_JSON');

    fs.writeFileSync(gridPath, JSON.stringify({ version: 4, configs: {} }), 'utf-8');
    expect(readGridFile(gridPath).code).toBe('INVALID_JSON');
  });

  itUnlessRoot('sem permissao de leitura devolve NO_PERMISSION sem lancar', () => {
    fs.chmodSync(gridPath, 0o000);

    const result = readGridFile(gridPath);

    expect(result.file).toBeNull();
    expect(result.code).toBe('NO_PERMISSION');

    fs.chmodSync(gridPath, 0o600);
  });

  it('aceita injecao de fsImpl, sem tocar no filesystem', () => {
    const fake = {
      readFileSync: () => JSON.stringify({ version: 9, configs: [] }),
    };

    const result = readGridFile('/caminho/que/nao/existe/hero_grid_config.json', fake);

    expect(result.exists).toBe(true);
    expect(result.file.version).toBe(9);
  });
});

describe('gridFile — igualdade profunda', () => {
  it('distingue objeto vazio de array vazio', () => {
    expect(deepEqual({}, [])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual([], [])).toBe(true);
  });

  it('ignora a ordem das chaves, para nao acusar mutacao que nao houve', () => {
    const a = { config_name: 'x', categories: [], future_valve_config_field: 'reservado' };
    const b = { future_valve_config_field: 'reservado', categories: [], config_name: 'x' };

    expect(deepEqual(a, b)).toBe(true);
  });

  it('pega chave a mais, chave a menos e ordem de array', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: null }, { a: {} })).toBe(false);
  });
});

describe('gridFile — a guarda de escrita (I-1, I-2, E-3, E-4)', () => {
  it('I-1/E-3: config de ORIGEM alterado aborta com SOURCE_MUTATED e nao grava', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2, (file) => {
      // A origem é `configs[0]`: mover um heroi de grupo é exatamente o que FR-007b proibe.
      file.configs[0].categories[0].hero_ids.push(99);
    });

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_MUTATED');
    expect(diskText()).toBe(before);
  });

  it('I-1/E-3: expectedSourceConfig divergente do que esta em disco aborta com SOURCE_MUTATED', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    // Simula origem renomeada dentro do Dota depois da leitura do renderer.
    request.expectedSourceConfig = adverseFile().configs[0];
    request.expectedSourceConfig.config_name = 'nome que nao esta em disco';

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_MUTATED');
    expect(diskText()).toBe(before);
  });

  it('I-2/E-4: outro layout alterado no INDICE 0 aborta com SOURCE_MUTATED e nao grava', async () => {
    const before = diskText();
    const file = adverseFile();
    file.configs[2].categories[0].hero_ids.reverse(); // o espelho, permitido
    file.configs[0].categories[2].category_name = 'renomeado pelo app'; // proibido

    const request = {
      path: gridPath,
      content: serialize(file),
      // Origem em 1: o `configs[0]` aqui é "qualquer outro layout", nao a origem.
      expectedSourceIndex: 1,
      expectedSourceConfig: adverseFile().configs[1],
      expectedMirrorIndex: 2,
      expectedConfigCount: 3,
      allowWhileDotaRunning: true,
    };

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_MUTATED');
    expect(diskText()).toBe(before);
  });

  it('I-2/E-4: outro layout alterado no ULTIMO indice aborta com SOURCE_MUTATED e nao grava', async () => {
    const before = diskText();
    const file = adverseFile();
    file.configs[2].categories[1].hero_ids = [1, 2, 3]; // ultimo layout do jogador, proibido
    file.configs.push(newMirrorConfig()); // espelho novo no fim

    const request = {
      path: gridPath,
      content: serialize(file),
      expectedSourceIndex: 0,
      expectedSourceConfig: adverseFile().configs[0],
      expectedMirrorIndex: 3,
      expectedConfigCount: 4,
      allowWhileDotaRunning: true,
    };

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_MUTATED');
    expect(diskText()).toBe(before);
  });

  it('I-2: layout removido do conteudo aborta, nunca é gravado', async () => {
    const before = diskText();
    const file = adverseFile();
    file.configs.splice(1, 1); // remover config que o app nao criou

    const request = {
      path: gridPath,
      content: serialize(file),
      expectedSourceIndex: 0,
      expectedSourceConfig: adverseFile().configs[0],
      expectedMirrorIndex: 1,
      expectedConfigCount: 3,
      allowWhileDotaRunning: true,
    };

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(diskText()).toBe(before);
  });

  it('CONFIG_COUNT_MISMATCH: numero de configs diferente de expectedConfigCount aborta', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    request.expectedConfigCount = 4; // o conteudo tem 3

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('CONFIG_COUNT_MISMATCH');
    expect(diskText()).toBe(before);
  });

  it('CONFIG_COUNT_MISMATCH: arquivo em disco cresceu desde a leitura do renderer', async () => {
    // O jogador criou um layout novo dentro do Dota entre a leitura e a escrita.
    const grown = adverseFile();
    grown.configs.push(newMirrorConfig());
    fs.writeFileSync(gridPath, serialize(grown), 'utf-8');
    const before = diskText();

    const request = requestReorderingMirror(2); // montado com 3 configs
    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('CONFIG_COUNT_MISMATCH');
    expect(diskText()).toBe(before);
  });

  it('CONFIG_COUNT_MISMATCH: posicao de espelho fora da faixa do conteudo aborta', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    request.expectedMirrorIndex = 9;

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('CONFIG_COUNT_MISMATCH');
    expect(diskText()).toBe(before);
  });

  it('SOURCE_INDEX_GONE: posicao de origem que nao existe mais aborta', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    request.expectedSourceIndex = 7;

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_INDEX_GONE');
    expect(diskText()).toBe(before);
  });

  it('I-3: alterar version aborta — version é preservado, nunca reescrito', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2, (file) => {
      file.version = 3;
    });

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_MUTATED');
    expect(diskText()).toBe(before);
  });

  it('INVALID_JSON: conteudo que nao faz parse aborta antes de tocar em qualquer coisa', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    request.content = '{ "version": 4, "configs": [ ';

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_JSON');
    expect(diskText()).toBe(before);
    expect(listDir()).toEqual(['hero_grid_config.json']);
  });

  it('FILE_NOT_FOUND: arquivo ausente nunca é criado pela escrita (L-1)', async () => {
    fs.rmSync(gridPath);
    const request = requestReorderingMirror(2);

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(result.code).toBe('FILE_NOT_FOUND');
    expect(fs.existsSync(gridPath)).toBe(false);
  });

  it('E-2: nenhum .glimpse.tmp sobra depois de um abort', async () => {
    const request = requestReorderingMirror(2, (file) => {
      file.configs[0].config_name = 'origem mexida';
    });

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(false);
    expect(listDir().filter((name) => name.endsWith('.glimpse.tmp'))).toEqual([]);
  });
});

describe('gridFile — caminho feliz da escrita', () => {
  it('aceita alteracao SO na posicao do espelho e mantem o resto igual em profundidade', async () => {
    const original = adverseFile();
    const request = requestReorderingMirror(2);

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    expect(result.data.bytesWritten).toBe(Buffer.byteLength(request.content, 'utf-8'));

    const written = diskFile();
    expect(written.configs).toHaveLength(3);
    expect(deepEqual(written.configs[0], original.configs[0])).toBe(true);
    expect(deepEqual(written.configs[1], original.configs[1])).toBe(true);
    // O espelho é o unico diferente, e a diferenca é so a ORDEM de hero_ids.
    expect(written.configs[2].categories[0].hero_ids).toEqual(
      [...original.configs[2].categories[0].hero_ids].reverse(),
    );
    expect(new Set(written.configs[2].categories[0].hero_ids)).toEqual(
      new Set(original.configs[2].categories[0].hero_ids),
    );
  });

  it('I-3: version do arquivo escrito é o do conteudo (4 na anti-fixture), nao um valor fixo', async () => {
    const request = requestReorderingMirror(2);

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    expect(diskFile().version).toBe(4);
  });

  it('L-4: campos desconhecidos da Valve sobrevivem a escrita', async () => {
    const request = requestReorderingMirror(2);

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    const written = diskFile();
    expect(written.configs[1].future_valve_config_field).toBe('reservado');
    expect(written.configs[0].categories[1].future_valve_field).toBe(7);
    // L-5: id fora do catalogo do app continua no arquivo.
    expect(written.configs[1].categories[0].hero_ids).toContain(9999);
  });

  it('N-6: espelho NOVO no fim de configs é aceito, sem mover os layouts do jogador', async () => {
    const original = adverseFile();
    const file = adverseFile();
    file.configs.push(newMirrorConfig());

    const request = {
      path: gridPath,
      content: serialize(file),
      expectedSourceIndex: 0,
      expectedSourceConfig: adverseFile().configs[0],
      expectedMirrorIndex: 3,
      expectedConfigCount: 4,
      allowWhileDotaRunning: true,
    };

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    const written = diskFile();
    expect(written.configs).toHaveLength(4);
    for (let i = 0; i < 3; i += 1) {
      expect(deepEqual(written.configs[i], original.configs[i])).toBe(true);
    }
    expect(written.configs[3].config_name).toBe('Meta Espelho — GlimpseGG');
  });

  it('E-2: nenhum .glimpse.tmp sobra depois de uma escrita bem-sucedida', async () => {
    const result = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    expect(listDir().filter((name) => name.endsWith('.glimpse.tmp'))).toEqual([]);
  });
});

describe('gridFile — backup (E-1, E-6)', () => {
  it('E-1: o backup é criado e é BYTE A BYTE igual ao original', async () => {
    const result = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });

    expect(result.success).toBe(true);
    const backupPath = result.data.backupPath;
    expect(path.basename(backupPath)).toMatch(/^hero_grid_config\.glimpse\.bak\.\d+$/);
    expect(path.dirname(backupPath)).toBe(dir);

    const backupBytes = fs.readFileSync(backupPath);
    expect(backupBytes.equals(ADVERSE_BYTES)).toBe(true);
    expect(backupBytes.length).toBe(ADVERSE_BYTES.length);
  });

  it('E-6: com 7 backups existentes, depois de escrever restam os 5 MAIS RECENTES', async () => {
    const epochs = [1000, 1001, 1002, 1003, 1004, 1005, 1006];
    for (const epoch of epochs) {
      fs.writeFileSync(path.join(dir, `hero_grid_config.glimpse.bak.${epoch}`), `bak ${epoch}`, 'utf-8');
    }

    const result = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });
    expect(result.success).toBe(true);

    const remaining = listDir().filter((name) => name.includes('.glimpse.bak.'));
    expect(remaining).toHaveLength(5);
    expect(remaining).toContain(path.basename(result.data.backupPath));
    // O novo backup (epoch de agora) + os 4 mais recentes dos antigos.
    expect(remaining).toContain('hero_grid_config.glimpse.bak.1006');
    expect(remaining).toContain('hero_grid_config.glimpse.bak.1005');
    expect(remaining).toContain('hero_grid_config.glimpse.bak.1004');
    expect(remaining).toContain('hero_grid_config.glimpse.bak.1003');
    expect(remaining).not.toContain('hero_grid_config.glimpse.bak.1002');
    expect(remaining).not.toContain('hero_grid_config.glimpse.bak.1001');
    expect(remaining).not.toContain('hero_grid_config.glimpse.bak.1000');
  });

  it('listGridBackups devolve os backups do mais novo para o mais velho, com bytes', async () => {
    fs.writeFileSync(path.join(dir, 'hero_grid_config.glimpse.bak.1000'), 'aa', 'utf-8');
    fs.writeFileSync(path.join(dir, 'hero_grid_config.glimpse.bak.2000'), 'bbb', 'utf-8');
    fs.writeFileSync(path.join(dir, 'ruido.txt'), 'x', 'utf-8');

    const entries = listGridBackups(gridPath);

    expect(entries.map((entry) => entry.at)).toEqual([2000, 1000]);
    expect(entries.map((entry) => entry.bytes)).toEqual([3, 2]);
    expect(entries.every((entry) => path.dirname(entry.path) === dir)).toBe(true);
  });
});

describe('gridFile — trava, Dota aberto e permissao (E-5, E-7, E-8)', () => {
  it('E-5: a segunda escrita concorrente recebe WRITE_IN_PROGRESS e nada corrompe o arquivo', async () => {
    // O detector é o ponto de espera: `await` no meio da escrita é o que permite a segunda
    // chamada entrar enquanto a primeira ainda esta em curso.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const slowDetector = () => gate.then(() => ({ running: false, method: 'ps' }));

    const first = requestReorderingMirror(2);
    first.allowWhileDotaRunning = false;
    const second = requestReorderingMirror(1);
    second.allowWhileDotaRunning = false;

    const p1 = writeGridFile(first, { isDotaRunningImpl: slowDetector });
    const p2 = writeGridFile(second, { isDotaRunningImpl: slowDetector });
    release();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);
    expect(r2.code).toBe('WRITE_IN_PROGRESS');

    // O arquivo tem exatamente o conteudo da primeira escrita — nem mistura, nem JSON quebrado.
    expect(diskText()).toBe(first.content);
    expect(() => diskFile()).not.toThrow();
  });

  it('E-5: a trava é liberada depois da escrita, inclusive depois de abort', async () => {
    const aborted = requestReorderingMirror(2, (file) => {
      file.configs[0].config_name = 'origem mexida';
    });
    const failure = await writeGridFile(aborted, { isDotaRunningImpl: dotaClosed });
    expect(failure.success).toBe(false);

    const ok = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });
    expect(ok.success).toBe(true);
  });

  it('E-7: Dota rodando e allowWhileDotaRunning:false devolve DOTA_RUNNING e nao grava', async () => {
    const before = diskText();
    const request = requestReorderingMirror(2);
    request.allowWhileDotaRunning = false;

    const result = await writeGridFile(request, { isDotaRunningImpl: dotaOpen });

    expect(result.success).toBe(false);
    expect(result.code).toBe('DOTA_RUNNING');
    expect(diskText()).toBe(before);
    expect(listDir()).toEqual(['hero_grid_config.json']);
  });

  it('E-7: com confirmacao explicita do jogador, grava mesmo com o Dota aberto e nem consulta processos', async () => {
    let consulted = false;
    const detector = async () => {
      consulted = true;
      return { running: true, method: 'ps' };
    };
    const request = requestReorderingMirror(2);
    request.allowWhileDotaRunning = true;

    const result = await writeGridFile(request, { isDotaRunningImpl: detector });

    expect(result.success).toBe(true);
    expect(consulted).toBe(false);
  });

  itUnlessRoot('E-8: diretorio sem permissao de escrita falha com NO_PERMISSION e original intacto', async () => {
    const before = diskText();
    fs.chmodSync(dir, 0o500);

    const result = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });

    fs.chmodSync(dir, 0o700);

    expect(result.success).toBe(false);
    expect(result.code).toBe('NO_PERMISSION');
    expect(diskText()).toBe(before);
    expect(listDir()).toEqual(['hero_grid_config.json']);
  });
});

describe('gridFile — restauracao (SC-004)', () => {
  it('restoreGridFile devolve o arquivo BYTE A BYTE igual ao backup', async () => {
    const written = await writeGridFile(requestReorderingMirror(2), { isDotaRunningImpl: dotaClosed });
    expect(written.success).toBe(true);
    expect(diskText()).not.toBe(ADVERSE_RAW);

    const restored = restoreGridFile(gridPath);

    expect(restored.success).toBe(true);
    expect(restored.data.restoredFrom).toBe(written.data.backupPath);
    expect(fs.readFileSync(gridPath).equals(ADVERSE_BYTES)).toBe(true);
    expect(listDir().filter((name) => name.endsWith('.glimpse.tmp'))).toEqual([]);
  });

  it('restoreGridFile aceita um backup especifico e usa o mais recente por padrao', async () => {
    const antigo = path.join(dir, 'hero_grid_config.glimpse.bak.1000');
    const recente = path.join(dir, 'hero_grid_config.glimpse.bak.2000');
    fs.writeFileSync(antigo, 'conteudo antigo', 'utf-8');
    fs.writeFileSync(recente, 'conteudo recente', 'utf-8');

    expect(restoreGridFile(gridPath, antigo).data.restoredFrom).toBe(antigo);
    expect(diskText()).toBe('conteudo antigo');

    expect(restoreGridFile(gridPath).data.restoredFrom).toBe(recente);
    expect(diskText()).toBe('conteudo recente');
  });

  it('restoreGridFile sem nenhum backup falha explicitamente, sem tocar no arquivo', () => {
    const before = diskText();

    const result = restoreGridFile(gridPath);

    expect(result.success).toBe(false);
    expect(result.code).toBe('FILE_NOT_FOUND');
    expect(diskText()).toBe(before);
  });
});
