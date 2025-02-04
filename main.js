const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
});

ipcMain.handle("get-sources", async () => {
  return await desktopCapturer.getSources({ types: ["screen", "window"] });
});
