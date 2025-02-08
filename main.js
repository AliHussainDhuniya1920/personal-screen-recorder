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
  globalShortcut
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





const { execSync } = require("child_process");



let ffmpegPath = "ffmpeg"; // Assume it's in the system PATH

try {
  // ✅ Find the full system path of FFmpeg
  const detectedFFmpegPath = execSync("where ffmpeg").toString().trim(); // Windows (for Mac/Linux use `which ffmpeg`)
  ffmpegPath = detectedFFmpegPath.split("\n")[0]; // Get first path in case multiple are listed

  console.log("🚀 FFmpeg Found at:", ffmpegPath);
} catch (error) {
  console.error("❌ FFmpeg Not Found in System PATH. Please install FFmpeg.");
}

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

// ✅ Function to convert WebM to MP4 using system FFmpeg
async function convertWebMToMP4(filePath) {
  return new Promise((resolve, reject) => {
    if (!isFFmpegAvailable()) {
      console.error("❌ FFmpeg is not installed! Please install it and set it in your system PATH.");
      return reject("FFmpeg is missing. Please install FFmpeg and try again.");
    }

    const outputFilePath = filePath.replace(".webm", ".mp4");
    const encoder = getAvailableEncoders(); // Detect best encoder

    console.log(`🎥 Starting conversion: ${filePath} → ${outputFilePath}`);
    console.log(`🔥 Using Encoder: ${encoder}`);

// Delay conversion to avoid file lock issues
setTimeout(() => {
  ffmpeg(filePath)
    .output(outputFilePath)
    .outputOptions([
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
}, 1000); // ✅ Delay FFmpeg conversion to avoid file-lock issues
});
}

ipcMain.handle("save-recording", async (_, buffer) => {
  const defaultSavePath = path.join(app.getPath("videos"), `recording-${Date.now()}.webm`);

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

    // Delete original WebM file
    fs.unlinkSync(finalSavePath);
    console.log("🗑 Deleted WebM File:", finalSavePath);

    return mp4FilePath; // Return final MP4 path
  } catch (err) {
    console.error("⚠️ FFmpeg Conversion Failed, Keeping WebM File:", err);
    return finalSavePath; // Return WebM if conversion fails
  }
});
