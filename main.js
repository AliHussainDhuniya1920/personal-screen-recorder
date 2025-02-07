const ffmpeg = require("fluent-ffmpeg"); // ✅ Ensure this is at the top
const path = require("path");
const fs = require("fs");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  dialog,
  screen,
  globalShortcut
} = require("electron");


// const ffmpegStatic = require("ffmpeg-static");
const unzipper = require("unzipper");
const https = require("https");
const ffbinaries = require("ffbinaries");






let mainWindow;
let webcamWindow;




app.whenReady().then(() => {
     // ✅ Register Global Shortcuts
 globalShortcut.register("CommandOrControl+Shift+S", () => {
  console.log("🎥 Start Recording Shortcut Pressed");
  mainWindow.webContents.send("start-recording");
});

globalShortcut.register("CommandOrControl+Shift+X", () => {
  console.log("🛑 Stop Recording Shortcut Pressed");
  mainWindow.webContents.send("stop-recording");
});



globalShortcut.register("CommandOrControl+Shift+W", () => {
  console.log("📷 Toggle Webcam Shortcut Pressed");
  mainWindow.webContents.send("toggle-webcam");
});



app.on("will-quit", () => {
  globalShortcut.unregisterAll(); // ✅ Unregister shortcuts on app quit
});


  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // Allow require() in renderer process
      contextIsolation: false, // Ensure proper IPC communication
      enableRemoteModule: true, // Needed if using remote module
    },
  
  });



  
  mainWindow.loadFile("index.html");
  mainWindow.on("closed", () => {
    closeWebcamWindow(); // ✅ Close webcam when main app closes
  });
});





// Function to create a floating webcam window
function createWebcamWindow() {
  if (webcamWindow) return; // Prevent multiple windows

  const { width, height } = screen.getPrimaryDisplay().workAreaSize; // Get screen size
  const taskbarHeight = screen.getPrimaryDisplay().size.height - height; // Detect taskbar height

  const overlaySize = 250 // Webcam overlay size
  const xPos = width - overlaySize - 5; // Right-aligned
  const yPos = height - overlaySize - taskbarHeight + 145; // Positioned over system time


  webcamWindow = new BrowserWindow({
    width: overlaySize,
    height: overlaySize,
    x: xPos,
    y: yPos,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

   // ✅ Ensure it stays above the taskbar
   webcamWindow.setAlwaysOnTop(true, "screen-saver");
  webcamWindow.setIgnoreMouseEvents(true, { forward: true }); // Allow clicks through window
  webcamWindow.loadFile("webcam.html");

  webcamWindow.on("closed", () => {
    webcamWindow = null; // Ensure window reference is cleared
  });
}

// Function to close the webcam window
function closeWebcamWindow() {
  if (webcamWindow) {
    webcamWindow.close();
    webcamWindow = null;
  }
}

// Listen for start and stop events from renderer
ipcMain.on("start-webcam", () => {
  createWebcamWindow();
});

ipcMain.on("stop-webcam", () => {
  closeWebcamWindow();
});

// Ensure webcam closes when app is quit
app.on("window-all-closed", () => {
  closeWebcamWindow();
  app.quit();
});



function getAvailableEncoders() {
  // ✅ Define ffmpegPath before using it
const ffmpegPath = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");

(async () => {
  
  // Dynamically import 'electron-is-dev'
  const isDev = (await import("electron-is-dev")).default;

  const ffmpegPath = isDev
    ? path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe")
    : path.join(process.resourcesPath, "ffmpeg", "bin", "ffmpeg.exe");

  console.log("🚀 Using FFmpeg Path:", ffmpegPath);
})();

// ✅ Set the FFmpeg path correctly
ffmpeg.setFfmpegPath(ffmpegPath);

console.log("✅ FFmpeg Path Set:", ffmpegPath);

const ffprobePath = path.join(__dirname, "ffmpeg", "bin", "ffprobe.exe");

// ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log("✅183- FFmpeg Path Set:", ffmpegPath);
console.log("✅ 184- FFprobe Path Set:", ffprobePath);

  // const { execSync } = require("child_process");
  (async () => {
    const { execSync } = await import("child_process");
    
    try {
      const result = execSync("echo Hello World").toString();
      console.log("Command Output:", result);
    } catch (error) {
      console.error("Command Error:", error);
    }
  })();
  

  try {
  


    const output = execSync(`"${ffmpegPath}" -hide_banner -encoders`).toString(); // ✅ Use correct FFmpeg path
    if (output.includes("libx264")) return "libx264"; // default cpu
  } catch (error) {
    console.log("Error detecting encoders:", error);
  }
  return "no-cpu-type"; // Default CPU fallback
}

const { downloadBinariesSync } = require("ffbinaries");
const { log } = require("console");
// const ffmpeg = require("ffmpeg");

const ffmpegDir = path.join(__dirname, "ffmpeg");
const ffmpegExePath = path.join(ffmpegDir, "bin", "ffmpeg.exe"); // FFmpeg binary path
const ffmpegZipPath = path.join(ffmpegDir, "ffmpeg.zip"); // FFmpeg ZIP file path
const binDir = path.join(ffmpegDir, "bin"); // ✅ Define binDir before using it
const ffmpegDownloadURL =
  "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"; // Official FFmpeg download URL

const { execSync } = require("child_process");
  function checkFFmpegEncoders() {
    try {
      const encoders = execSync(`"${ffmpegExePath}" -hide_banner -encoders`).toString();
      console.log(encoders);
    } catch (error) {
      console.error("🚨 FFmpeg encoder test failed:", error);
    }
  }
  
  checkFFmpegEncoders();

// Function to check if FFmpeg exists
function isFFmpegAvailable() {
  return fs.existsSync(ffmpegExePath);
}

// Function to move ffmpeg.exe into the bin folder after download
function moveFFmpegToBin() {
  const downloadedPath = path.join(ffmpegDir, "ffmpeg.exe"); // Where ffbinaries places ffmpeg.exe

  if (fs.existsSync(downloadedPath)) {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true }); // ✅ Ensure bin folder exists
    }

    fs.renameSync(downloadedPath, ffmpegExePath); // ✅ Move ffmpeg.exe into bin/
    console.log("Moved FFmpeg to bin folder successfully!");
  } else {
    console.error(
      "FFmpeg download failed: ffmpeg.exe not found in expected location."
    );
  }
}

// Function to download FFmpeg from the internet
function downloadFFmpeg() {
  return new Promise((resolve, reject) => {
    console.log("Downloading FFmpeg...");

    ffbinaries.downloadBinaries(
      ["ffmpeg"],
      { destination: ffmpegDir },
      (err, results) => {
        if (err) {
          console.error("Failed to download FFmpeg:", err);
          reject(err);
        } else {
          console.log("FFmpeg downloaded successfully!", results);
          moveFFmpegToBin(); // Move ffmpeg.exe after download
          resolve();
        }
      }
    );
  });
}

// Function to extract FFmpeg ZIP if missing
async function extractFFmpeg() {
  if (fs.existsSync(ffmpegZipPath)) {
    console.log("Extracting FFmpeg...");
    return fs
      .createReadStream(ffmpegZipPath)
      .pipe(unzipper.Extract({ path: ffmpegDir }))
      .promise()
      .then(() => {
        moveFFmpegToBin(); // ✅ Move extracted ffmpeg.exe to bin/
        console.log("FFmpeg extracted successfully!");
      })
      .catch((err) => console.error("Error extracting FFmpeg:", err));
  }
}

// Ensure FFmpeg is available
(async () => {
  if (!isFFmpegAvailable()) {
    console.log("FFmpeg not found, trying to download...");

    try {
      await downloadFFmpeg(); // Try downloading FFmpeg
    } catch (error) {
      console.log("No internet or download failed, checking local ZIP...");
      if (fs.existsSync(ffmpegZipPath)) {
        console.log("Using local FFmpeg ZIP...");
        await extractFFmpeg();
      } else {
        console.log("No internet and no local ZIP found. FFmpeg setup failed.");
      }
    }
  }

  // **✅ Fix: Set the Correct FFmpeg Path**
  ffmpeg.setFfmpegPath(ffmpegExePath);

  console.log("FFmpeg path set successfully:", ffmpegExePath);
})();


async function convertWebMToMP4(filePath) {
  return new Promise((resolve, reject) => {

    const outputFilePath = filePath.replace(".webm", ".mp4");
 
    ffmpeg(filePath)
      .output(outputFilePath)
      .outputOptions([
        // `-c:v ${encoder}`,
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 17",
        "-tune zerolatency",
        "-threads 4",
        "-movflags +faststart",
      ])
      .on("start", (cmd) => console.log(`⚡ FFmpeg Command: ${cmd}`))
      .on("error", (err) => {
        console.error("❌ FFmpeg Conversion Error:", err);
        reject(err);
      })
      .on("end", () => {
        console.log("✅ Conversion Successful:", outputFilePath);
        resolve(outputFilePath);
      })
      .run();
  });
}





ipcMain.handle("get-sources", async () => {
  return await desktopCapturer.getSources({ types: ["screen", "window"] });
});

ipcMain.handle("save-recording", async (_, buffer) => {
  // implement: when user cancel save the location then only save rec into systems video folder
  // Show Save Dialog
  const { filePath } = await dialog.showSaveDialog({
    title: "Save Recording",
    defaultPath: path.join(
      app.getPath("videos"),
      `recording-${Date.now()}.webm`
    ),
    filters: [{ name: "WebM", extensions: ["webm"] }],
  });

  let finalSavePath = filePath;

  if (!filePath) {
    // If user cancels, save automatically to Videos folder
    finalSavePath = path.join(
      app.getPath("videos"),
      `recording-${Date.now()}.webm`
    );
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