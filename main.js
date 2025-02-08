const ffmpeg = require("fluent-ffmpeg"); // ✅ Ensure this is at the top
const path = require("path");
const fs = require("fs");
const {
  desktopCapturer,
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
  globalShortcut,
} = require("electron");

let mainWindow;
let webcamWindow;

ipcMain.handle("get-sources", async () => {
  return await desktopCapturer.getSources({ types: ["screen", "window"] });
});

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


  const overlaySize = 250; // Webcam overlay size
  const xPos = width - overlaySize - 5; // Right-aligned
  const yPos = height - overlaySize - taskbarHeight + 145; // Positioned over system time
  // console.log("📷 Webcam Overlay Position → X:", xPos, "Y:", yPos);



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
  // webcamWindow.setAlwaysOnTop(true, "pop-up"); // More aggressive than "screen-saver"

  webcamWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); // Ensure it's visible across virtual desktops

  webcamWindow.setIgnoreMouseEvents(true, { forward: true }); // Allow clicks through window
  webcamWindow.loadFile("webcam.html");

  webcamWindow.on("closed", () => {
    webcamWindow = null; // Ensure window reference is cleared
  });

  setInterval(() => {
    if (webcamWindow) {
      webcamWindow.setAlwaysOnTop(true, "screen-saver"); // Keep forcing the window to stay on top
    }
  }, 1000); // Keep forcing the window to stay on top every 500ms
  
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

const { execSync } = require("child_process");

// ✅ Set FFmpeg Path to Local `ffmpeg/bin/ffmpeg.exe` Get from app-inside-no-need-to-set-env-variables
// ✅ Determine FFmpeg path correctly
let ffmpegPath;

// Check if running in production
if (app.isPackaged) {
  ffmpegPath = path.join(process.resourcesPath, "ffmpeg", "bin", "ffmpeg.exe"); // 🔹 Extracted location
} else {
  ffmpegPath = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe"); // 🔹 Dev mode
}

console.log("🔍 Checking FFmpeg Path:", ffmpegPath);

// ✅ Ensure FFmpeg Exists
if (!fs.existsSync(ffmpegPath)) {
  console.error(
    "❌ FFmpeg not found! Please make sure ffmpeg.exe is in the correct location."
  );
} else {
  console.log("🚀 Using local FFmpeg:", ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// this is for those who have ffmpeg.exe file installed on c folder c://ffmpeg/bin/ffmpeg.exe & user manually need to see environment variables
// try {
//   // ✅ Find the full system path of FFmpeg
//   const detectedFFmpegPath = execSync("where ffmpeg").toString().trim(); // Windows (for Mac/Linux use `which ffmpeg`)
//   ffmpegPath = detectedFFmpegPath.split("\n")[0]; // Get first path in case multiple are listed

//   console.log("🚀 FFmpeg Found at:", ffmpegPath);
// } catch (error) {
//   console.error("❌ FFmpeg Not Found in System PATH. Please install FFmpeg.");
// }

// ✅ Set FFmpeg Path for Fluent-FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// ✅ Function to check if FFmpeg is available
function isFFmpegAvailable() {
  try {
    execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

// ✅ Function to get available encoders
function getAvailableEncoders() {
  try {
    const output = execSync(`${ffmpegPath} -hide_banner -encoders`).toString();
    if (output.includes("h264_nvenc")) return "h264_nvenc"; // NVIDIA
    if (output.includes("h264_qsv")) return "h264_qsv"; // Intel Quick Sync
    if (output.includes("h264_amf")) return "h264_amf"; // AMD AMF
  } catch (error) {
    console.error("Error detecting encoders:", error);
  }
  return "libx264"; // Default CPU fallback
}


const os = require("os");
// ✅ Function to convert WebM to MP4 using system FFmpeg
async function convertWebMToMP4(filePath) {
  return new Promise((resolve, reject) => {
    const outputFolder = path.dirname(filePath); // 🔹 Save in the same location as WebM
    let outputFileName = path.basename(filePath).replace(/\.webm$/, ".mp4");
    outputFileName = outputFileName.replace(/[^a-zA-Z0-9.-]/g, "_"); // Sanitize filename
    let outputFilePath = path.resolve(outputFolder, outputFileName); // ✅ MP4 will be saved in the same location as WebM

    console.log(`🎥 Converting: ${filePath} → ${outputFilePath}`);

    if (!fs.existsSync(filePath)) {
      console.error("❌ Input file does not exist:", filePath);
      return reject("Input file missing.");
    }

    let encoder = getAvailableEncoders();
    console.log("🛠 Selected Encoder:", encoder);

    function runFFmpeg(selectedEncoder) {
      console.log(`🚀 Trying conversion with: ${selectedEncoder}`);

      

 // 🔹 Detect user system CPU threads dynamically
 const cpuThreads = os.cpus().length;
 const optimalThreads = Math.max(2, Math.floor(cpuThreads / 2)); // Prevent setting 1 thread

 console.log(`🖥️ Detected CPU Threads: ${cpuThreads} | Using ${optimalThreads} for FFmpeg`);

      ffmpeg(filePath)
        .output(outputFilePath)
        .outputOptions([
          "-y",
          `-c:v ${selectedEncoder}`,
          "-preset ultrafast",
          // ultrafast → Maximum speed but slightly larger file size.
          //        superfast → Still very fast, but smaller file size than ultrafast.
          "-crf 17",
          "-tune zerolatency",
          // "-threads 4",
          `-threads ${optimalThreads}`, // ✅ Use detected threads dynamically
          "-movflags +faststart",
          "-c:a aac", // ✅ Convert audio to AAC (faster than default Opus)
          "-b:a 192k", // ✅ Increase audio bitrate for better quality
          "-af aresample=async=1", // ✅ Ensure audio & video are processed in parallel
        ])
        .on("start", (cmd) => console.log(`⚡ FFmpeg Command: ${cmd} | 🚀 Using ${optimalThreads} Threads`))

        .on("error", (err) => {
          console.error(
            `❌ FFmpeg Error with ${selectedEncoder}:`,
            err.message
          );

          if (selectedEncoder !== "libx264") {
            console.log("⚠️ Falling back to libx264...");
            runFFmpeg("libx264");
          } else {
            reject(err);
          }
        })
        .on("end", () => {
          console.log("✅ Conversion Successful:", outputFilePath);
          resolve(outputFilePath);
        })
        .run();
    }

    runFFmpeg(encoder);
  });
}

// const desktopPath = app.getPath("desktop");

ipcMain.handle("save-recording", async (_, buffer) => {
  const defaultSavePath = path.join(
    app.getPath("videos"),
    `recording-${Date.now()}.webm`
  );

  // Show Save Dialog
  const { filePath } = await dialog.showSaveDialog({
    title: "Save Recording",
    defaultPath: defaultSavePath,
    filters: [{ name: "WebM", extensions: ["webm"] }],
  });

  let finalSavePath = filePath || defaultSavePath; // Use default if user cancels

  console.log(`📁 Saving Recording To: ${finalSavePath}`);

  // Save WebM file
  try {
    fs.writeFileSync(finalSavePath, buffer);
    console.log("✅ Recording saved:", finalSavePath);
  } catch (err) {
    console.error("❌ Error saving file:", err);
    return null;
  }

  // Convert WebM to MP4
  try {
    const mp4FilePath = await convertWebMToMP4(finalSavePath);
    console.log("✅ MP4 File Path:", mp4FilePath);

    // If you don’t want to delete the WebM file after conversion, just remove this line in save-recording:fs.unlinkSync(finalSavePath); // 🛑 Remove this line if you want to keep the
    // Delete original WebM file
    fs.unlinkSync(finalSavePath);
    console.log("🗑 Deleted WebM File:", finalSavePath);

    return mp4FilePath; // Return final MP4 path
  } catch (err) {
    console.error("⚠️ FFmpeg Conversion Failed, Keeping WebM File:", err);
    return finalSavePath; // Return WebM if conversion fails
  }
});
