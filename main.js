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

// Function to convert WebM to MP4
async function convertWebMToMP4(filePath) {
  return new Promise((resolve, reject) => {
      const outputFilePath = filePath.replace('.webm', '.mp4');

      ffmpeg(filePath)
          .output(outputFilePath)
          .outputOptions('-c:v libx264')  // Convert video to H.264 for MP4
          .outputOptions('-preset fast')  // Fast encoding preset
          .outputOptions('-movflags +faststart') // Enable fast seeking
          .on('end', () => {
              console.log("Converted WebM to MP4:", outputFilePath);
              resolve(outputFilePath);
          })
          .on('error', (err) => {
              console.error("Error converting WebM to MP4:", err);
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

let finalSavePath = filePath;

if (!filePath) {
    // If user cancels, save automatically to Videos folder
    finalSavePath = path.join(app.getPath("videos"), `recording-${Date.now()}.webm`);
    console.log(`User canceled. Auto-saving to: ${finalSavePath}`);
}

// Save WebM file
fs.writeFileSync(finalSavePath, buffer);

try {
    // Convert WebM to MP4
    const mp4FilePath = await convertWebMToMP4(finalSavePath);

    // Delete original WebM file to keep only MP4
    fs.unlinkSync(finalSavePath);
    console.log("Deleted original WebM file:", finalSavePath);

    return mp4FilePath;
} catch (err) {
    console.error("Failed to convert WebM to MP4:", err);
    return finalSavePath; // Return WebM if conversion fails
}
});



