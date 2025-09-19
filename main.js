const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const store = new Store();

// Configs
const URL_TO_LOAD = 'https://streamingcommunityz.cc/';
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
let mainWindow = null;
let blocker = null;

// Adblock
async function initAdBlocker() {
  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
}

// Window
function createWindow() {
  const windowBounds = store.get('windowBounds', { width: 1280, height: 720 });

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: true,
    },
  });

  // Set UserAgent
  mainWindow.webContents.setUserAgent(USER_AGENT);

  // Load Site
  const loadSite = async (url = URL_TO_LOAD) => {
    try {
      await mainWindow.loadURL(url);
    } catch (error) {
      console.error('[Load Error]', error);
    }
  };
  loadSite();

  // Show it when ready
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Save window
  let saveTimeout;
  const saveBounds = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (mainWindow) {
        store.set('windowBounds', mainWindow.getBounds());
      }
    }, 300);
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('moved', saveBounds);

  mainWindow.once('closed', () => {
    mainWindow = null;
  });

  // Block new windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Block unauthorized domains
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowedDomains = [URL_TO_LOAD];
    if (!allowedDomains.some(domain => navigationUrl.startsWith(domain))) {
      console.warn('[Blocked Navigation]', navigationUrl);
      event.preventDefault();
    }
  });
}

// Events
app.whenReady().then(async () => {
  await initAdBlocker();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC
ipcMain.handle('get-store-value', (_, key, def) => store.get(key, def));
ipcMain.handle('set-store-value', (_, key, val) => store.set(key, val));
ipcMain.handle('load-url', (_, url) => mainWindow?.loadURL(url));
ipcMain.handle('go-home', () => mainWindow?.loadURL(URL_TO_LOAD));
ipcMain.handle('reload-page', () => mainWindow?.reload());

// Error handling
process.on('uncaughtException', err => console.error('[Uncaught Exception]', err));
process.on('unhandledRejection', (reason, p) =>
  console.error('[Unhandled Rejection]', p, 'Reason:', reason)
);
