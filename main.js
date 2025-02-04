const { app, BrowserWindow, desktopCapturer, ipcMain, dialog } = require("electron");
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegStatic);

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

// Function to process WebM for seeking
async function processWebM(filePath) {
  return new Promise((resolve, reject) => {
      const outputFilePath = filePath.replace('.webm', '-seekable.webm');

      ffmpeg(filePath)
          .output(outputFilePath)
          .outputOptions('-c copy') // Copy streams without re-encoding
          .outputOptions('-movflags +faststart') // Allow seeking
          .on('end', () => {
              resolve(outputFilePath);
          })
          .on('error', (err) => {
              console.error('FFmpeg error:', err);
              reject(err);
          })
          .run();
  });
}


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

if (!filePath) return null;

// Save the raw WebM file first
fs.writeFileSync(filePath, buffer);

try {
    // Process WebM for seekability
    const fixedFilePath = await processWebM(filePath);

    // Replace the original file with the fixed one
    fs.renameSync(fixedFilePath, filePath);
    console.log(`Fixed WebM file saved at: ${filePath}`);
} catch (err) {
    console.error('Failed to fix WebM file for seeking:', err);
}
      return filePath;

  // If the user cancels, save automatically to the Videos folder
  // const autoSavePath = path.join(app.getPath("videos"), `recording-${Date.now()}.webm`);
  // fs.writeFileSync(autoSavePath, buffer);
  // return autoSavePath;
});



