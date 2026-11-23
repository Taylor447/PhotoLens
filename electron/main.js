const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'photolens', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

let mainWindow;
const historyPath = () => path.join(app.getPath('userData'), 'photolens-history.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, minHeight: 680,
    title: 'PhotoLens', backgroundColor: '#080b12', autoHideMenuBar: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const trustedIndexUrl = 'photolens://app/index.html';
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: http://localhost:8787 http://127.0.0.1:8787; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['photolens://*'] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedIndexUrl) event.preventDefault();
  });
  mainWindow.loadURL(trustedIndexUrl);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function chooseImages() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn ảnh để phân tích', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Ảnh', extensions: ['jpg','jpeg','png','webp','heic','heif'] }]
  });
  if (selection.canceled) return;
  const files = await Promise.all(selection.filePaths.map(async filePath => ({
    name: path.basename(filePath), type: ({ jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif' })[path.extname(filePath).slice(1).toLowerCase()] || 'application/octet-stream',
    data: (await fs.readFile(filePath)).toString('base64')
  })));
  mainWindow?.webContents.send('photolens:open-files', files);
}

function createMenu() {
  const template = [
    { label: 'PhotoLens', submenu: [{ label: 'Giới thiệu PhotoLens', click: () => dialog.showMessageBox(mainWindow, { message: 'PhotoLens', detail: 'Phân tích ảnh riêng tư, trực tiếp trên thiết bị.' }) }, { type: 'separator' }, { role: 'quit', label: 'Thoát' }] },
    { label: 'Tệp', submenu: [{ label: 'Mở ảnh…', accelerator: 'CmdOrCtrl+O', click: chooseImages }, { label: 'Xuất báo cáo PDF…', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('photolens:export') }] },
    { label: 'Chỉnh sửa', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Xem', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('photolens:save-file', async (_event, { filename, data }) => {
  const ext = path.extname(filename).toLowerCase();
  const filters = [{ name: ext === '.pdf' ? 'PDF' : ext === '.png' ? 'PNG' : ext === '.json' ? 'JSON' : 'Tệp', extensions: [ext.replace('.','') || 'dat'] }];
  const chosen = await dialog.showSaveDialog(mainWindow, { defaultPath: filename, filters });
  if (chosen.canceled || !chosen.filePath) return { canceled: true };
  try { await fs.writeFile(chosen.filePath, Buffer.from(data, 'base64')); return { saved: true }; }
  catch (error) { return { error: error.message }; }
});
ipcMain.handle('photolens:load-history', async () => { try { return JSON.parse(await fs.readFile(historyPath(), 'utf8')); } catch { return []; } });
ipcMain.handle('photolens:save-history', async (_event, value) => { await fs.mkdir(app.getPath('userData'), { recursive: true }); await fs.writeFile(historyPath(), JSON.stringify(value), 'utf8'); return true; });
ipcMain.handle('photolens:clear-history', async () => { await fs.rm(historyPath(), { force: true }); return true; });
ipcMain.handle('photolens:open-files', chooseImages);

app.whenReady().then(async () => {
  const distRoot = path.resolve(__dirname, '..', 'dist');
  protocol.handle('photolens', async request => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(distRoot, relative);
    if (!filePath.startsWith(distRoot + path.sep)) return new Response('Forbidden', { status: 403 });
    try { return await net.fetch(pathToFileURL(filePath).href); }
    catch { return new Response('Not found', { status: 404 }); }
  });
  createMenu(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
