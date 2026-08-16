const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const screenshot = require('desktop-screenshot');
const fs = require('fs');

let mainWindow;
let screenshotInterval;

function createKioskWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  globalShortcut.register('Alt+Tab', () => false);
  globalShortcut.register('Alt+F4', () => false);
  globalShortcut.register('CommandOrControl+Shift+I', () => false);

  // Background Screenshot capture timer (Har 30 seconds)
  startScreenshotTask();

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (screenshotInterval) clearInterval(screenshotInterval);
  });
}

function startScreenshotTask() {
  const screenshotsDir = path.join(__dirname, 'temp_screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  screenshotInterval = setInterval(() => {
    const filePath = path.join(screenshotsDir, `shot_${Date.now()}.png`);
    screenshot(filePath, (error, complete) => {
      if (error) {
        console.log('[Screenshot Error]:', error);
      } else {
        console.log('[Screenshot Saved]:', filePath);
        // Clean up temporary screenshot file
        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 5000);
      }
    });
  }, 30000); // 30 seconds
}

app.whenReady().then(() => {
  createKioskWindow();
});

ipcMain.on('unlock-kiosk', (event, parentPin) => {
  if (parentPin === '1234') {
    if (screenshotInterval) clearInterval(screenshotInterval);
    globalShortcut.unregisterAll();
    if (mainWindow) {
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      app.quit();
    }
  } else {
    event.reply('pin-verification-result', { success: false, message: 'Invalid Parent PIN!' });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});