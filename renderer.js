const { ipcRenderer } = require("electron");
const path = require("path");

let mediaRecorder;
let recordedChunks = [];
let webcamStream;
let stopTimer; // Timer to automatically stop recording
let beepInterval;
let selectedDuration = 30 * 60 * 1000; // Default to 30 minutes
const pauseButton = document.getElementById("pause");
let liveCountdownInterval = null;
let isPaused = false;
let recordingPausedTime = null;
let timeRemaining = null;
let lastUpdatedTime = null; // Tracks the last time update before pausing

window.onload = () => {
  document.getElementById("stop").disabled = true;
  document.getElementById("live-timer").innerText =
    formatTime(selectedDuration);

  // ✅ Create an audio object on page load to ensure it works later
  const testAudio = new Audio();
  testAudio.muted = true;
  testAudio
    .play()
    .catch(() =>
      console.log("🔇 Audio autoplay blocked, waiting for user interaction.")
    );
};

// Function to format time in HH:MM:SS
function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  // let hours = Math.floor(totalSeconds / 60);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  return `Time Left:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

// Function to start live countdown timer
function startLiveCountdown() {
  console.log("⏳ Timer started. Remaining Time:", formatTime(timeRemaining));

  if (timeRemaining === null || timeRemaining <= 0) {
    timeRemaining = selectedDuration; // ✅ Set timeRemaining only if not already set
  }

  // ✅ Clear any previous timer interval
  if (liveCountdownInterval) {
    clearInterval(liveCountdownInterval);
    liveCountdownInterval = null; // ✅ Ensure it's fully cleared
  }
  // clearInterval(liveCountdownInterval); // ✅ Prevent multiple intervals

  lastUpdatedTime = Date.now(); // ✅ Track when the countdown started

  liveCountdownInterval = setInterval(() => {
    if (!isPaused) {
      const now = Date.now();
      const elapsed = now - lastUpdatedTime; // ✅ Calculate actual elapsed time
      timeRemaining -= elapsed; // ✅ Reduce time accurately
      lastUpdatedTime = now; // ✅ Update last time marker

      // ✅ Ensure timeRemaining does not go negative
      if (timeRemaining < 0) {
        timeRemaining = 0;
      }

      document.getElementById(
        "live-timer"
      ).innerText = `Time Left: ${formatTime(timeRemaining)}`;
      console.log(
        "⏳ Timer running. Remaining Time:",
        formatTime(timeRemaining)
      );
    }

    if (timeRemaining <= 0) {
      clearInterval(liveCountdownInterval);
      document.getElementById("live-timer").innerText = "Time Left: 00:00";
      console.log("🛑 Timer reached 00:00. Stopping recording...");

      // ✅ Stop recording immediately
      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("🎥 Stopping MediaRecorder...");
        mediaRecorder.stop();
      }

      // ✅ Play alert sound AFTER stopping the recording
      setTimeout(() => {
        playBeepSound();
      }, 500);
    }
  }, 100);
}

// Function to play a beep sound for 3 seconds
function playBeepSound() {
  console.log("🔊 Playing alert sound...");

  const audioPath = path.join(__dirname, "alert.mp3");
  const beepAudio = new Audio(audioPath);
  let beepCount = 0; // Counter to stop after 3 beeps

  beepInterval = setInterval(() => {
    if (beepCount >= 3) {
      clearInterval(beepInterval); // ✅ Stop after 3 beeps
      console.log("✅ Beep sound stopped after 3 seconds.");
      return;
    }

    beepAudio.currentTime = 0; // Reset to start
    beepAudio
      .play()
      .then(() =>
        console.log(`🔊 Playing custom beep sound (${beepCount + 1}/3)`)
      )
      .catch((err) => {
        console.error("❌ Custom beep sound failed, using system beep:", err);
        playSystemBeep(); // ✅ If custom beep fails, fallback to system beep
      });

    beepCount++; // Increment beep count
  }, 1000);
}

// setTimeout(() => {
//   clearInterval(beepInterval);
// }, 3000); // Stop beeping after 3 seconds

// Function to play the default system beep sound
function playSystemBeep() {
  const { exec } = require("child_process");

  if (process.platform === "win32") {
    exec("powershell -c [console]::beep(800, 300)");
  } else if (process.platform === "darwin") {
    exec("osascript -e 'beep'");
  } else if (process.platform === "linux") {
    exec("echo -e '\\a'"); // Linux default beep
  }
}

//to support 30 seconds
document
  .getElementById("recording-time")
  .addEventListener("change", (event) => {
    selectedDuration = parseInt(event.target.value) * 60 * 500; // Convert minutes to milliseconds(default-30-mins)

    document.getElementById("live-timer").innerText =
      formatTime(selectedDuration);
  });

async function startRecording() {
  ipcRenderer.send("start-webcam"); // Open webcam overlay
  webcamStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 200, height: 200 },
  });

  let countdown = 1;
  const startButton = document.getElementById("start");
  const stopButton = document.getElementById("stop");
  const countdownDisplay = document.getElementById("countdown");
  const videoMessage = document.getElementById("video-message");

  // ✅ Stop any previous recording (if still running)
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    console.log("Previous recording stopped before starting a new one.");
  }

  // ✅ Reset timeRemaining when starting a new recording
  timeRemaining = selectedDuration;
  document.getElementById("live-timer").innerText = formatTime(timeRemaining);

  // ✅ Stop old timers if they exist
  clearTimeout(stopTimer);
  clearInterval(liveCountdownInterval);

  // Disable start button during countdown
  startButton.disabled = true;
  stopButton.disabled = true;
  videoMessage.innerText = ""; // Clear any previous message
  pauseButton.disabled = true; // Disable pause initially

  // Start Countdown
  countdownDisplay.innerText = `Recording starts in ${countdown}...`;
  const countdownInterval = setInterval(() => {
    countdown--;
    countdownDisplay.innerText = `Recording starts in ${countdown}...`;

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      countdownDisplay.innerText = "Recording started!";
      actualStartRecording(); // Call actual recording function
    }
  }, 1000);
}



async function actualStartRecording() {
  const sources = await ipcRenderer.invoke("get-sources");

  // 🎯 Get user-selected FPS (default: 30 FPS)
  const selectedFPS = parseInt(document.getElementById("fps").value, 10) || 30;

 // ✅ Get screen resolution from `window.screen`
 const screenWidth = window.screen.width;
 const screenHeight = window.screen.height;

 console.log(`🎥 Using Screen Resolution: ${screenWidth}x${screenHeight}, FPS: ${selectedFPS}`);


  const screenStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "desktop" } },
    video: {
      mandatory: {
         chromeMediaSource: "desktop",
        chromeMediaSourceId: sources[0].id,
        minWidth: 1280,    // ✅ Minimum width for recording
        minHeight: 720,   // ✅ Minimum height for recording
        maxWidth: 1920,   // ✅ Maximum width (Full HD) for recording
        maxHeight: 1080,  // ✅ Maximum height (Full HD) for recording
        minFrameRate: selectedFPS, // ✅ Minimum FPS (user-defined)
        maxFrameRate: selectedFPS, // ✅ Maximum FPS (user-defined)
      },
    },
  });

  // ✅ Log actual screen recording settings
  const screenVideoTrack = screenStream.getVideoTracks()[0];
  const screenSettings = screenVideoTrack.getSettings();
  console.log(
    `🎥 Screen Resolution: ${screenSettings.width}x${screenSettings.height}, FPS: ${screenSettings.frameRate}`
  );

  // ✅ Log actual webcam recording settings
  if (webcamStream) {
    const webcamVideoTrack = webcamStream.getVideoTracks()[0];
    const webcamSettings = webcamVideoTrack.getSettings();
    console.log(
      `📷 Webcam Resolution: ${webcamSettings.width}x${webcamSettings.height}, FPS: ${webcamSettings.frameRate}`
    );
  }

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const combinedStream = new MediaStream([
    ...screenStream.getVideoTracks(),
    ...micStream.getAudioTracks(),
    ...webcamStream.getVideoTracks(), // ✅ Adds the webcam feed to the recording
  ]);

  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: "video/webm; codecs=vp8,opus",
  });

  mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);

  mediaRecorder.onstop = async () => {
    ipcRenderer.send("stop-webcam"); // ✅ Close webcam when recording stops

    // ✅ Stop webcam stream
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
    }
    clearTimeout(stopTimer); // Clear the auto-stop timer when manually stopping
    clearInterval(liveCountdownInterval); // Stop live countdown timer
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const buffer = Buffer.from(await blob.arrayBuffer());
    document.getElementById("video").src = url;

    const videoMessage = document.getElementById("video-message");
    const downloadButton = document.getElementById("download-video");

    // Create a new message element for conversion status
    const conversionStatus = document.createElement("p");
    conversionStatus.id = "conversion-status";
    conversionStatus.innerText = "Converting... Please wait";
    conversionStatus.style.color = "orange";
    conversionStatus.style.fontWeight = "bold";

    // Insert the message before the download button
    downloadButton.before(conversionStatus);

    // Keep your original message
    videoMessage.innerText =
      "Oops! If you forget to save your recorded file. No problem 👉Your Video is automatically saved in your system Videos Folder. Check it. Thanks!";
    videoMessage.style.color = "green";

    // Hide download button durring conversion
    downloadButton.style.display = "none"; // Hide download button

    // Wait for MP4 conversion to complete
    const savedPath = await ipcRenderer.invoke("save-recording", buffer);
    console.log(`Recording saved at: ${savedPath}`);

    recordedChunks = [];

    // Update UI after recording stops
    document.getElementById("stop").disabled = true;
    document.getElementById("start").disabled = false;
    pauseButton.disabled = true; // Disable pause when stopped

    document.getElementById("countdown").innerText = ""; // Clear the message

    document.getElementById("live-timer").innerText = "Time Left: 00:00:00"; // Reset countdown timer UI

    // Load the MP4 file into the video player
    document.getElementById("video").src = `file://${savedPath}`;

    // Remove conversion status message
    conversionStatus.remove();

    // Show download button after conversion is complete
    downloadButton.style.display = "inline-block"; // Show the button
    downloadButton.innerText = "Download Video";

    // Set up the download functionality
    downloadButton.disabled = false;
    downloadButton.onclick = () => {
      const link = document.createElement("a");
      link.href = `file://${savedPath}`;
      link.download = savedPath.split("/").pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // Update message and enable download button
    videoMessage.innerText =
      "Conversion complete! Your video is ready for download.";
    videoMessage.style.color = "green";

    // Enable Download Button
    // const downloadButton = document.getElementById("download-video");
    downloadButton.disabled = false;
    downloadButton.onclick = () => {
      const link = document.createElement("a");
      link.href = `file://${savedPath}`;
      link.download = savedPath.split("/").pop(); // Extract filename from path
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  mediaRecorder.start();
  startLiveCountdown(); // Start updating countdown timer

  // Enable stop button and disable start button after recording starts
  document.getElementById("stop").disabled = false;
  document.getElementById("start").disabled = true;
  pauseButton.disabled = false; // Enable pause after recording starts

  // Auto-stop recording after 65 minutes
  stopTimer = setTimeout(() => {
    if (mediaRecorder.state === "recording") {
      playBeepSound();
      showRecordingStoppedNotification(); // Show system notification
      mediaRecorder.stop();
      // alert('Recording stopped automatically after 65 minutes.');
    }
  }, selectedDuration);
}

// ✅ Pause/Resume Button Logic
pauseButton.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    isPaused = true;
    clearInterval(liveCountdownInterval); // ✅ Pause countdown
    recordingPausedTime = Date.now(); // ✅ Store pause time

    // ✅ Stop webcam when pausing
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => (track.enabled = false));
    }

    console.log(
      "⏸ Recording paused. Remaining Time:",
      formatTime(timeRemaining)
    );
    pauseButton.innerText = "Resume Recording";
  } else if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    isPaused = false;

    // ✅ Adjust timeRemaining based on pause duration
    let pauseDuration = Date.now() - recordingPausedTime;
    lastUpdatedTime += pauseDuration; // ✅ Adjust last update time instead of modifying `timeRemaining`

    // ✅ Resume webcam when unpausing
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => (track.enabled = true));
    }

    console.log(
      "▶️ Recording resumed. Adjusted Time Left:",
      formatTime(timeRemaining)
    );
    startLiveCountdown(); // ✅ Restart countdown correctly
    pauseButton.innerText = "Pause Recording";
  }
});

// Function to show a system notification
function showRecordingStoppedNotification() {
  if (Notification.permission === "granted") {
    new Notification("Screen Recording Stopped", {
      body: "Recording stopped automatically after 30 minutes.",
      silent: false, // Allows sound with notification
    });
  } else {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification("Screen Recording Stopped", {
          body: "Recording stopped automatically after 30 minutes.",
          silent: false,
        });
      }
    });
  }
}

document.getElementById("start").addEventListener("click", startRecording);
document.getElementById("stop").addEventListener("click", () => {
  if (mediaRecorder) {
    clearTimeout(stopTimer); // Clear the auto-stop timer if manually stopped
    clearInterval(beepInterval); // Prevent beep sound if manually stopped
    clearInterval(liveCountdownInterval); // Stop the countdown when manually stopped
    mediaRecorder.stop();
    document.getElementById("stop").disabled = true;
    document.getElementById("start").disabled = false;
    pauseButton.disabled = true; // Disable pause after stopping
    pauseButton.innerText = "Pause Recording"; // Reset button text

    document.getElementById("live-timer").innerText = "Time Left: 00:00:00"; // Reset countdown UI
  }
});

// toogle webcam for on/off default is off
const toggleWebcamButton = document.getElementById("toggle-webcam");
let isWebcamEnabled = true; // ✅ Default: Enabled

// Set initial button text
toggleWebcamButton.innerText = "Disable Webcam";

toggleWebcamButton.addEventListener("click", () => {
  if (isWebcamEnabled) {
    stopWebcam(); // ✅ Stop webcam and release camera
    toggleWebcamButton.innerText = "Enable Webcam";
  } else {
    startWebcam(); // ✅ Restart webcam
    toggleWebcamButton.innerText = "Disable Webcam";
  }
  isWebcamEnabled = !isWebcamEnabled; // Toggle state
});

// ✅ Function to Start Webcam
function startWebcam() {
  ipcRenderer.send("start-webcam");
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      webcamStream = stream; // Store webcam stream
    })
    .catch((error) => {
      console.error("❌ Failed to start webcam:", error);
    });
}

// ✅ Function to Stop Webcam Properly
function stopWebcam() {
  ipcRenderer.send("stop-webcam");

  if (webcamStream) {
    webcamStream.getTracks().forEach((track) => track.stop()); // ✅ Turn off webcam
    webcamStream = null; // Clear stream reference
  }
}

// mic default on:

const toggleMicButton = document.getElementById("toggle-mic");
let isMicEnabled = true; // Default: Enabled

toggleMicButton.addEventListener("click", () => {
  if (mediaRecorder) {
    mediaRecorder.stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled; // Toggle mic
    });

    isMicEnabled = !isMicEnabled;
    toggleMicButton.innerText = isMicEnabled
      ? "Disable Microphone"
      : "Enable Microphone";
  }
});

// shortcut keys
ipcRenderer.on("start-recording", () => {
  console.log("🎥 Start Recording Triggered from Shortcut");
  startRecording();
});

ipcRenderer.on("stop-recording", () => {
  console.log("🛑 Stop Recording Triggered from Shortcut");
  if (mediaRecorder) {
    mediaRecorder.stop();
  }
});

ipcRenderer.on("toggle-webcam", () => {
  console.log("📷 Toggle Webcam Triggered from Shortcut");
  const toggleWebcamButton = document.getElementById("toggle-webcam");
  toggleWebcamButton.click(); // ✅ Simulate button click
});

// keep below code commented because by mistake if we press shortcut key then it will pause the recording without knowing  so do it manually
// document.addEventListener("DOMContentLoaded", () => {

//   ipcRenderer.on("pause", () => {
//     console.log("⏸️ Pause/Resume Recording Triggered from Shortcut");
//     console.log("mediaRecorder:", mediaRecorder); // Debugging
//     if (mediaRecorder) {
//       if (mediaRecorder.state === "recording") {
//         mediaRecorder.pause();
//         console.log("⏸️ Recording Paused");
//       } else if (mediaRecorder.state === "paused") {
//         mediaRecorder.resume();
//         console.log("▶️ Recording Resumed");
//       }
//     } else {
//       console.error("⚠️ mediaRecorder is undefined");
//     }
//   });

// keep below code disable: mic because if we press accidently shortcut key then it will disable the mic so do it manually

//   let micStream = null; // Declare globally
//   navigator.mediaDevices.getUserMedia({ audio: true })
//     .then(stream => {
//         micStream = stream; // Assign micStream properly
//     })
//     .catch(err => console.error("⚠️ Error accessing microphone:", err));
//   ipcRenderer.on("toggle-mic", () => {
//     console.log("🎤 Toggle Microphone Triggered from Shortcut");
//     console.log("micStream:", micStream); // Debugging
//     if (micStream) {
//       micStream.getAudioTracks().forEach(track => {
//         track.enabled = !track.enabled;
//         console.log(`🎤 Microphone ${track.enabled ? "Enabled" : "Disabled"}`);
//       });
//     } else {
//       console.error("⚠️ micStream is undefined");
//     }
//   });

// });
