const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const appUrl = process.env.APP_SERVER_URL;

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#eef4fb',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (appUrl) {
    win.loadURL(appUrl);
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  if (process.env.NODE_ENV !== 'production') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
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
