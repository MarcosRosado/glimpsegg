const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

// Local Config Store setup
const configPath = path.join(app.getPath('userData'), 'stratz_app_config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return {
    stratzApiKey: process.env.STRATZ_API_KEY || '',
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
const EXTERNAL_HOST_ALLOWLIST = new Set([
  'stratz.com',
  'www.stratz.com',
  'api.stratz.com',
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

// IPC Handler: STRATZ GraphQL Request
ipcMain.handle('api:stratz-graphql', async (event, { query, variables, customApiKey }) => {
  const token = customApiKey || appConfig.stratzApiKey || process.env.STRATZ_API_KEY || '';
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'STRATZ_API',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    const response = await fetch('https://api.stratz.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      };
    }

    const json = await response.json();
    return {
      success: true,
      data: json.data,
      errors: json.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

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

// IPC Handler: Steam ID Resolver
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
