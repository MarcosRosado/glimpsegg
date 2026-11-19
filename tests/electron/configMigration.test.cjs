// `.cjs` com `globals: true`: describe/it/expect vem do ambiente (ver tests/CLAUDE.md).
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CONFIG_FILE,
  LEGACY_CONFIG_FILE,
  migratedConfig,
  migrateLegacyConfig,
} = require('../../electron/configMigration.cjs');

/** Token de mentira: so precisa ser reconhecivel no teste. Nunca um token real. */
const FAKE_TOKEN = 'fake-token-for-test';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glimpse-config-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name, obj) => fs.writeFileSync(path.join(dir, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf-8');

describe('migratedConfig', () => {
  it('copia todas as chaves menos stratzApiKey', () => {
    const legacy = { steamAccountId: '123', app_language: 'pt-BR', heroGridEnabled: true, profileHistory: [{ id: '1' }], stratzApiKey: FAKE_TOKEN };
    const out = migratedConfig(legacy);
    expect(out).toEqual({ steamAccountId: '123', app_language: 'pt-BR', heroGridEnabled: true, profileHistory: [{ id: '1' }] });
    expect(JSON.stringify(out)).not.toContain(FAKE_TOKEN);
  });
});

describe('migrateLegacyConfig — o primeiro inicio da versao nova', () => {
  it('antigo existe e novo nao: cria o novo sem o token e deixa o antigo byte a byte igual', () => {
    write(LEGACY_CONFIG_FILE, { steamAccountId: '123', stratzApiKey: FAKE_TOKEN, theme: 'dark' });
    const before = read(LEGACY_CONFIG_FILE);

    expect(migrateLegacyConfig(dir)).toBe('migrated');

    expect(read(LEGACY_CONFIG_FILE)).toBe(before);
    const novo = JSON.parse(read(CONFIG_FILE));
    expect(novo).toEqual({ steamAccountId: '123', theme: 'dark' });
    expect(read(CONFIG_FILE)).not.toContain(FAKE_TOKEN);
    // Nenhum arquivo temporario sobra.
    expect(fs.readdirSync(dir).sort()).toEqual([CONFIG_FILE, LEGACY_CONFIG_FILE].sort());
  });

  it('roda uma vez: com o novo presente, nada muda, nem se o antigo mudou depois', () => {
    write(CONFIG_FILE, { steamAccountId: 'novo' });
    write(LEGACY_CONFIG_FILE, { steamAccountId: 'antigo' });
    expect(migrateLegacyConfig(dir)).toBe('present');
    expect(JSON.parse(read(CONFIG_FILE))).toEqual({ steamAccountId: 'novo' });
  });

  it('instalacao nova, sem arquivo nenhum: nao cria nada', () => {
    expect(migrateLegacyConfig(dir)).toBe('none');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('antigo ilegivel: nao cria o novo e nao toca no antigo', () => {
    write(LEGACY_CONFIG_FILE, '{ quebrado');
    expect(migrateLegacyConfig(dir)).toBe('invalid');
    expect(fs.existsSync(path.join(dir, CONFIG_FILE))).toBe(false);
    expect(read(LEGACY_CONFIG_FILE)).toBe('{ quebrado');

    write(LEGACY_CONFIG_FILE, '[1, 2]');
    expect(migrateLegacyConfig(dir)).toBe('invalid');
    expect(fs.existsSync(path.join(dir, CONFIG_FILE))).toBe(false);
  });
});
