const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

// Local Config Store setup
//
// O arquivo era `stratz_app_config.json` ate a 2.0. No primeiro inicio, a migracao copia o
// antigo para o novo sem a chave `stratzApiKey` e deixa o antigo intocado (os scripts de
// medicao ainda procuram o token la). Regra e motivo em `configMigration.cjs`.
const { CONFIG_FILE, migrateLegacyConfig } = require('./configMigration.cjs');
const { steamProfileXmlUrl, parseSteamProfileXml } = require('./steamProfile.cjs');
const configPath = path.join(app.getPath('userData'), CONFIG_FILE);
try {
  migrateLegacyConfig(app.getPath('userData'));
} catch (err) {
  // Migracao que falha nao derruba o app: ele nasce com o config padrao e o antigo fica onde
  // esta. A mensagem nao leva o conteudo do arquivo — ele pode ter o token.
  console.error('Config migration failed:', err && err.code ? err.code : 'unknown');
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  // Config NOVA nao nasce com token: o app nao usa a STRATZ desde 2026-11-19. O token que
  // uma versao anterior tenha salvo fica no `stratz_app_config.json` antigo, que o app nao
  // le mais — a migracao nao o copia.
  return {
    steamAccountId: process.env.DEFAULT_STEAM_ACCOUNT_ID || '',
    theme: 'dark',
    autoRefresh: true,
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    return false;
  }
}

let appConfig = loadConfig();

// Auto Updater Configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'available',
      version: info.version,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('Auto updater error:', err);
    mainWindow?.webContents.send('updater:status', {
      status: 'error',
      error: err?.message || String(err),
    });
  });
}

// Hosts que o app tem motivo legitimo para abrir no browser do sistema.
// Qualquer outro destino e descartado silenciosamente: um link malicioso vindo
// de dado de API nao deve conseguir abrir uma janela nem navegar o renderer.
// Os hosts da STRATZ sairam em 2026-11-19: nenhuma tela abre mais link para stratz.com
// (conferido por grep em src/ depois da remocao do onboarding de token e da aba de token).
const EXTERNAL_HOST_ALLOWLIST = new Set([
  'steamcommunity.com',
  'www.steamcommunity.com',
  'opendota.com',
  'www.opendota.com',
  'github.com',
]);

function isAllowedExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && EXTERNAL_HOST_ALLOWLIST.has(url.hostname);
  } catch {
    return false;
  }
}

// Bloqueia window.open e navegacao para fora do app.
// Sem isso, o renderer pode ser levado a carregar conteudo remoto arbitrario,
// que passaria a rodar com o mesmo preload e as mesmas pontes de IPC.
function applyNavigationGuards(contents, appOrigin) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) {
      shell.openExternal(url);
    } else {
      console.warn('Blocked window.open for disallowed URL:', url);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (url === contents.getURL()) return;

    // Navegacao interna permitida: o proprio bundle (file://) ou o dev server.
    if (appOrigin && url.startsWith(appOrigin)) return;

    event.preventDefault();
    if (isAllowedExternal(url)) {
      shell.openExternal(url);
    } else {
      console.warn('Blocked navigation to disallowed URL:', url);
    }
  });

  contents.on('will-attach-webview', (event) => {
    // O app nao usa <webview>; anexar um seria sempre injecao de terceiro.
    event.preventDefault();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#080b11',
    title: 'GlimpseGG - Tactical Dota 2 Analytics & Performance Intelligence',
    icon: path.join(__dirname, '../build/icons/256x256.png'),
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    applyNavigationGuards(mainWindow.webContents, new URL(devUrl).origin);
    mainWindow.loadURL(devUrl);
  } else {
    applyNavigationGuards(mainWindow.webContents, 'file://');
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // Check for updates automatically in production
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.warn('Silent auto-update check error:', err);
        });
      }, 3000);
    });
  }

  // Start application maximized
  mainWindow.maximize();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Config Store
ipcMain.handle('store:get', (event, key) => {
  return appConfig[key];
});

ipcMain.handle('store:set', (event, key, value) => {
  appConfig[key] = value;
  saveConfig(appConfig);
  return true;
});

ipcMain.handle('store:getAll', () => {
  return appConfig;
});

// O handler `api:stratz-graphql` morava aqui. Saiu em 2026-11-19: o app nao fala mais com
// a STRATZ em tempo de execucao. A chave `stratzApiKey` do config em disco NAO foi apagada
// de proposito — scripts de medicao fora do app ainda leem esse arquivo.

// IPC Handler: OpenDota REST Fetch
ipcMain.handle('api:opendota-fetch', async (event, { endpoint }) => {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const response = await fetch(`https://api.opendota.com/api/${cleanEndpoint}`, {
      headers: {
        'User-Agent': 'GlimpseGG_Dota2_Desktop/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: response.statusText,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// IPC Handler: pedido de parse na OpenDota (POST /request/{match_id})
//
// Handler proprio, e nao um `method` no `api:opendota-fetch`: aquele recebe um endpoint
// livre do renderer, e deixar o renderer escolher o verbo abriria qualquer POST da API.
// Este so aceita um id numerico e monta a URL aqui. O parse e assincrono: a resposta
// diz so que o pedido entrou na fila.
// Formato verificado com uma chamada real em 2026-11-19: 200 com {"job":{"jobId":<numero>}}.
// Cada pedido conta como 10 chamadas no limite da OpenDota (especificacao publica).
ipcMain.handle('api:opendota-request-parse', async (event, { matchId }) => {
  const id = Number(matchId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: 'invalid match id' };
  }
  try {
    const response = await fetch(`https://api.opendota.com/api/request/${id}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'GlimpseGG_Dota2_Desktop/1.0',
      },
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const json = await response.json();
    const jobId = json && json.job ? json.job.jobId : undefined;
    return { success: true, jobId: typeof jobId === 'number' ? jobId : undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// IPC Handler: Steam ID Resolver
// IPC Handler: perfil público da Steam (nome e foto) para a confirmação do onboarding.
// Só aceita SteamID64 (a URL sai de `steamProfileXmlUrl`, que valida); devolve campos já
// filtrados por `parseSteamProfileXml`, nunca o XML cru.
ipcMain.handle('api:steam-profile', async (event, { steamId64 } = {}) => {
  const url = steamProfileXmlUrl(steamId64);
  if (!url) return { success: false, error: 'invalid steam id' };
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GlimpseGG_Dota2_Desktop/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const parsed = parseSteamProfileXml(await response.text());
    if (!parsed) return { success: false, error: 'unexpected response' };
    return { success: true, ...parsed };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('api:resolve-steam-id', async (event, { input }) => {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Empty input' };
  }

  const trimmed = input.trim();
  const STEAM64_OFFSET = BigInt('76561197960265728');

  // Case 1: Pure digits
  if (/^\d+$/.test(trimmed)) {
    const num = BigInt(trimmed);
    if (num > STEAM64_OFFSET) {
      // It is a SteamID64
      const steam32 = Number(num - STEAM64_OFFSET);
      return {
        success: true,
        steamAccountId: String(steam32),
        steamId64: trimmed,
      };
    } else {
      // It is already a SteamID32 / Account ID
      const steam64 = String(BigInt(trimmed) + STEAM64_OFFSET);
      return {
        success: true,
        steamAccountId: trimmed,
        steamId64: steam64,
      };
    }
  }

  // Case 2: URL format
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/);
  if (profileMatch) {
    const num = BigInt(profileMatch[1]);
    const steam32 = Number(num - STEAM64_OFFSET);
    return {
      success: true,
      steamAccountId: String(steam32),
      steamId64: profileMatch[1],
    };
  }

  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  const vanityName = vanityMatch ? vanityMatch[1] : trimmed;

  // Attempt to search OpenDota for vanity/player name
  try {
    const searchRes = await fetch(`https://api.opendota.com/api/search?q=${encodeURIComponent(vanityName)}`);
    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const steam32 = String(first.account_id);
        const steam64 = String(BigInt(steam32) + STEAM64_OFFSET);
        return {
          success: true,
          steamAccountId: steam32,
          steamId64: steam64,
          personaname: first.personaname,
          avatar: first.avatarfull,
        };
      }
    }
  } catch (e) {
    console.error('Failed to resolve vanity name:', e);
  }

  return {
    success: false,
    error: 'Could not resolve Steam ID. Please provide a 32-bit Account ID (e.g. 155353139) or SteamID64.',
  };
});

// IPC Handler: Auto Updater
ipcMain.handle('updater:check', async () => {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return { dev: true };
  }
  try {
    const res = await autoUpdater.checkForUpdates();
    return { updateInfo: res?.updateInfo };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall();
});

// IPC Handler: App Info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

/* ==================================================================== *
 * IPC Handlers: hero grid (specs/001-meta-hero-grid)
 *
 * Principio de fronteira: o main NAO decide nada aqui. Ele nao sabe o que é winrate,
 * espelho nem ranking — recebe o texto ja serializado por `src/utils/heroGrid/valveJson.ts`
 * e grava. Toda decisao mora em funcao pura sob `src/`, onde o vitest alcanca. Os modulos
 * de `electron/heroGrid/` sao I/O e nada mais, e cada um tem teste proprio.
 * ==================================================================== */

const { listSteamAccounts } = require('./heroGrid/steamPaths.cjs');
const { assertAllowedGridPath } = require('./heroGrid/pathGuard.cjs');
const {
  readGridFile,
  writeGridFile,
  restoreGridFile,
  listGridBackups,
} = require('./heroGrid/gridFile.cjs');
const { isDotaRunning } = require('./heroGrid/dotaProcess.cjs');

/**
 * S-1: todo handler que recebe `path` do renderer passa por aqui ANTES de tocar no disco.
 *
 * O renderer nao é a fronteira de confianca: ele roda o codigo que pode estar errado, e um
 * `path` nao validado faria o processo privilegiado gravar em qualquer arquivo do usuario —
 * com backup e escrita atomica, o que so tornaria o estrago mais convincente. O caminho manual
 * do jogador (FR-006) é lido do config aqui, no lado privilegiado, e nao aceito do renderer:
 * senao a excecao viraria o proprio buraco.
 */
function guardGridPath(filePath) {
  const verdict = assertAllowedGridPath(filePath, {
    manualPath: appConfig.heroGridFilePath || null,
  });
  if (verdict.allowed) return null;
  return {
    success: false,
    error: `Caminho de arquivo de grids nao autorizado (${verdict.reason}).`,
    code: 'UNSUPPORTED_PLATFORM',
  };
}

ipcMain.handle('grid:list-accounts', () => {
  try {
    const accounts = listSteamAccounts({
      configuredSteamAccountId: appConfig.steamAccountId || null,
    });
    return { success: true, data: accounts };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('grid:read', (event, { path: filePath }) => {
  const blocked = guardGridPath(filePath);
  if (blocked) return blocked;

  try {
    const result = readGridFile(filePath);
    // L-2/L-3: arquivo invalido é falha explicita, nunca "arquivo vazio" — quem le como vazio
    // acaba gravando por cima do que nao conseguiu entender.
    if (result.code) {
      return { success: false, error: result.error, code: result.code };
    }
    return {
      success: true,
      data: { exists: result.exists, file: result.file, raw: result.raw },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('grid:write', async (event, request) => {
  if (!request || typeof request !== 'object') {
    return { success: false, error: 'Requisicao de escrita invalida.' };
  }
  const blocked = guardGridPath(request.path);
  if (blocked) return blocked;

  try {
    // A guarda de imutabilidade (E-3/E-4) mora dentro de `writeGridFile`, de proposito: é a
    // ultima linha antes do disco e tem de validar os bytes que vao ser gravados.
    return await writeGridFile(request);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('grid:restore', (event, { path: filePath, backupPath }) => {
  const blocked = guardGridPath(filePath);
  if (blocked) return blocked;

  try {
    return restoreGridFile(filePath, backupPath);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('grid:list-backups', (event, { path: filePath }) => {
  const blocked = guardGridPath(filePath);
  if (blocked) return blocked;

  try {
    return { success: true, data: listGridBackups(filePath) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('grid:is-dota-running', async () => {
  try {
    return { success: true, data: await isDotaRunning() };
  } catch {
    // Degradacao de `dotaProcess.cjs`: falso positivo permanente mataria a feature, entao a
    // falha de consulta responde "nao esta rodando" em vez de virar erro na tela.
    return { success: true, data: { running: false, method: 'unsupported' } };
  }
});

// IPC Handler: Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);
