const { app, BrowserWindow, desktopCapturer, ipcMain, dialog } = require("electron");
const fs = require('fs');
const path = require('path');


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

ipcMain.handle('save-recording', async (_, buffer) => {


  // implement: when user cancel save the location then only save rec into systems video folder
   // Show Save Dialog
   const { filePath } = await dialog.showSaveDialog({
    title: "Save Recording",
    defaultPath: path.join(app.getPath("videos"), `recording-${Date.now()}.webm`),
    filters: [{ name: "WebM", extensions: ["webm"] }]
});

    // If user selects a location, save there
    if (filePath) {
      fs.writeFileSync(filePath, buffer);
      return filePath;
  }

  // If the user cancels, save automatically to the Videos folder
  const autoSavePath = path.join(app.getPath("videos"), `recording-${Date.now()}.webm`);
  fs.writeFileSync(autoSavePath, buffer);
  return autoSavePath;
});



