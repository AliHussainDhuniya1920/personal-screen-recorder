const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  dialog,
  screen,
} = require("electron");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const unzipper = require("unzipper");
const https = require("https");
const ffbinaries = require("ffbinaries");

ffmpeg.setFfmpegPath(ffmpegStatic);

let mainWindow;
let webcamWindow;

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

function getAvailableEncoders() {
  try {
    const output = execSync(`${ffmpegPath} -hide_banner -encoders`).toString();
    if (output.includes("h264_nvenc")) return "h264_nvenc"; // NVIDIA
    if (output.includes("h264_qsv")) return "h264_qsv"; // Intel Quick Sync
    if (output.includes("h264_amf")) return "h264_amf"; // AMD AMF
  } catch (error) {
    console.log("Error detecting encoders:", error);
  }
  return "libx264"; // Default CPU fallback
}

const { downloadBinariesSync } = require("ffbinaries");

const ffmpegDir = path.join(__dirname, "ffmpeg");
const ffmpegExePath = path.join(ffmpegDir, "bin", "ffmpeg.exe"); // FFmpeg binary path
const ffmpegZipPath = path.join(ffmpegDir, "ffmpeg.zip"); // FFmpeg ZIP file path
const binDir = path.join(ffmpegDir, "bin"); // ✅ Define binDir before using it
const ffmpegDownloadURL =
  "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"; // Official FFmpeg download URL

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

// Function to convert WebM to MP4
async function convertWebMToMP4(filePath) {
  return new Promise((resolve, reject) => {
    const outputFilePath = filePath.replace(".webm", ".mp4");
    const encoder = getAvailableEncoders(); // Detect best encoder

    ffmpeg(filePath)
      .output(outputFilePath)
      .outputOptions([
        `-c:v ${encoder}`, // Use the best available encoder
        "-preset ultrafast", // Max speed
        "-crf 19", // Adjust quality (lower number = better quality)
        "-tune zerolatency", // Skip extra processing
        "-threads 4", // Use all CPU cores
        "-movflags +faststart", // Optimize MP4 playback
      ])
      .on("end", () => {
        console.log("Converted WebM to MP4:", outputFilePath);
        resolve(outputFilePath);
      })
      .on("error", (err) => {
        console.error("Error converting WebM to MP4:", err);
        reject(err);
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
