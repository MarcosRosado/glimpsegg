// Testa `electron/heroGrid/dotaProcess.cjs`, incluido na suite pelo glob
// `electron/**/*.test.cjs` do vitest.config.ts.
//
// Sem `require('vitest')` de proposito, e sem `import` tambem: o Vitest 4 recusa ser importado por
// require() ("Vitest cannot be imported in a CommonJS module using require()"), e um `import` num
// arquivo .cjs faz o oxlint falhar no parse ("Cannot use import statement outside a module"). A
// saida que atende os dois e `globals: true` no vitest.config.ts — por isso `describe`, `it`,
// `expect` e `vi` aqui vem do ambiente.
//
// Nenhum teste deste arquivo executa `ps` ou `tasklist` de verdade: `execImpl` e sempre injetado.

const { parseProcessList, isDotaRunning } = require('./dotaProcess.cjs');

describe('parseProcessList — Linux/macOS (ps -A -o comm=)', () => {
  it('reconhece o Dota quando "dota2" e uma linha da lista', () => {
    const stdout = ['systemd', 'gnome-shell', 'steam', 'dota2', 'node'].join('\n');
    expect(parseProcessList(stdout, 'linux')).toBe(true);
  });

  it('aceita o caminho completo do executavel, como o ps do macOS devolve', () => {
    const stdout = ['/usr/sbin/syslogd', '/Applications/Steam Library/dota 2 beta/game/dota2'].join('\n');
    expect(parseProcessList(stdout, 'darwin')).toBe(true);
  });

  // GUARDA CONTRA O FALSO POSITIVO PERMANENTE (R12). Se esta comparacao voltar a ser `includes`,
  // qualquer processo cuja linha contenha "dota2" — este proprio projeto, cujo diretorio se chama
  // dota2-stratz-analyzer — marca o Dota como aberto para sempre e a feature nunca escreve.
  it('NAO da falso positivo para linha que apenas CONTEM "dota2" como substring', () => {
    const stdout = [
      'systemd',
      'dota2-stratz-analyzer',
      'node /home/x/dota2-stratz-analyzer/vite.js',
      'bash -c "grep dota2 /proc/*/comm"',
      'code /home/x/dota2-stratz-analyzer',
    ].join('\n');
    expect(parseProcessList(stdout, 'linux')).toBe(false);
  });

  it('ignora espacos em volta do nome do processo', () => {
    expect(parseProcessList('  steam  \n   dota2   \n', 'linux')).toBe(true);
  });

  it('nao casa nome parecido como "dota2launcher" ou "notdota2"', () => {
    const stdout = ['dota2launcher', 'notdota2', 'dota2.exe'].join('\n');
    expect(parseProcessList(stdout, 'linux')).toBe(false);
  });
});

describe('parseProcessList — Windows (tasklist /FO CSV /NH)', () => {
  it('reconhece o Dota pelo primeiro campo entre aspas do CSV', () => {
    const stdout = [
      '"System Idle Process","0","Services","0","8 K"',
      '"steam.exe","4120","Console","1","120.512 K"',
      '"dota2.exe","1234","Console","1","2.048.512 K"',
    ].join('\r\n');
    expect(parseProcessList(stdout, 'win32')).toBe(true);
  });

  it('compara o nome da imagem sem diferenciar maiusculas', () => {
    expect(parseProcessList('"DOTA2.EXE","1234","Console","1","2.048 K"', 'win32')).toBe(true);
  });

  it('nao casa "dota2launcher.exe"', () => {
    expect(parseProcessList('"dota2launcher.exe","1234","Console","1","2.048 K"', 'win32')).toBe(false);
  });

  it('nao casa "notdota2.exe"', () => {
    expect(parseProcessList('"notdota2.exe","1234","Console","1","2.048 K"', 'win32')).toBe(false);
  });

  it('nao casa "dota2.exe" quando ele aparece so em outro campo da linha', () => {
    const stdout = '"cmd.exe","900","Console","1","tail -f dota2.exe.log"';
    expect(parseProcessList(stdout, 'win32')).toBe(false);
  });
});

describe('parseProcessList — entradas degeneradas', () => {
  it('devolve false para saida vazia, null e undefined, sem lancar', () => {
    expect(parseProcessList('', 'linux')).toBe(false);
    expect(parseProcessList('   \n  \n', 'linux')).toBe(false);
    expect(parseProcessList(null, 'linux')).toBe(false);
    expect(parseProcessList(undefined, 'win32')).toBe(false);
    expect(parseProcessList(null, undefined)).toBe(false);
  });

  it('devolve false para plataforma desconhecida mesmo com "dota2" na saida', () => {
    expect(parseProcessList('dota2', 'freebsd')).toBe(false);
  });
});

describe('isDotaRunning', () => {
  it('usa "ps -A -o comm=" no Linux e devolve method "ps"', async () => {
    const execImpl = vi.fn().mockResolvedValue({ stdout: 'steam\ndota2\n' });
    const result = await isDotaRunning({ platform: 'linux', execImpl });

    expect(result).toEqual({ running: true, method: 'ps' });
    expect(execImpl).toHaveBeenCalledWith('ps', ['-A', '-o', 'comm='], expect.objectContaining({ timeout: 2000 }));
  });

  it('usa "tasklist /FO CSV /NH" no Windows e devolve method "tasklist"', async () => {
    const execImpl = vi.fn().mockResolvedValue({ stdout: '"dota2.exe","1234","Console","1","2.048 K"' });
    const result = await isDotaRunning({ platform: 'win32', execImpl });

    expect(result).toEqual({ running: true, method: 'tasklist' });
    expect(execImpl).toHaveBeenCalledWith('tasklist', ['/FO', 'CSV', '/NH'], expect.objectContaining({ timeout: 2000 }));
  });

  it('aceita execImpl que devolve a saida como string crua', async () => {
    const execImpl = vi.fn().mockResolvedValue('dota2\n');
    await expect(isDotaRunning({ platform: 'linux', execImpl })).resolves.toEqual({ running: true, method: 'ps' });
  });

  it('degrada para running false, sem lancar, quando o comando falha', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const execImpl = vi.fn().mockRejectedValue(new Error('spawn ps ENOENT'));

    const result = await isDotaRunning({ platform: 'linux', execImpl });

    expect(result).toEqual({ running: false, method: 'ps' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('devolve unsupported em plataforma desconhecida, sem executar comando nenhum', async () => {
    const execImpl = vi.fn();
    const result = await isDotaRunning({ platform: 'freebsd', execImpl });

    expect(result).toEqual({ running: false, method: 'unsupported' });
    expect(execImpl).not.toHaveBeenCalled();
  });
});
