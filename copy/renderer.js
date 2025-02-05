const { ipcRenderer } = require("electron");
const path = require("path");

let mediaRecorder;
let recordedChunks = [];
let stopTimer; // Timer to automatically stop recording
let beepInterval;
let liveCountdownInterval;
let selectedDuration = 30 * 60 * 1000; // Default to 30 minutes
const pauseButton = document.getElementById("pause");
let isPaused = false; // Track pause state
let timeRemaining; // Keep track of remaining time




window.onload = () => {
  document.getElementById("stop").disabled = true;
  document.getElementById("live-timer").innerText =
    formatTime(selectedDuration);
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
  if (!timeRemaining) {
      timeRemaining = selectedDuration; // Initialize only once
  }

  liveCountdownInterval = setInterval(() => {
      if (!isPaused) {
          timeRemaining -= 1000;
          document.getElementById('live-timer').innerText = `Time Left: ${formatTime(timeRemaining)}`;

          if (timeRemaining <= 0) {
              clearInterval(liveCountdownInterval);
              document.getElementById('live-timer').innerText = "Time Left: 00:00";
          }
      }
  }, 1000);
}


// Function to play a beep sound for 3 seconds
function playBeepSound() {
  const audioPath = path.join(__dirname, "alert.mp3"); // Ensure this file exists
  const beepAudio = new Audio(audioPath);

  beepInterval = setInterval(() => {
    beepAudio.currentTime = 0; // Reset to start
    beepAudio
      .play()
      .then(() => console.log("Playing custom beep sound"))
      .catch((err) => {
        console.error("Custom beep sound failed, using system beep:", err);
        playSystemBeep(); // If custom beep fails, fallback to system beep
      });
  }, 1000);

  setTimeout(() => {
    clearInterval(beepInterval);
  }, 3000); // Stop beeping after 3 seconds
}

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
    selectedDuration = parseInt(event.target.value) * 60 * 500; // Convert minutes to milliseconds
    document.getElementById("live-timer").innerText =
      formatTime(selectedDuration);
  });

async function startRecording() {
  let countdown = 5;
  const startButton = document.getElementById("start");
  const stopButton = document.getElementById("stop");
  const countdownDisplay = document.getElementById("countdown");
  const videoMessage = document.getElementById("video-message");

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

  const screenStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "desktop" } },
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sources[0].id,
      },
    },
  });

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const combinedStream = new MediaStream([
    ...screenStream.getVideoTracks(),
    ...micStream.getAudioTracks(),
  ]);

  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: "video/webm; codecs=vp8,opus",
  });

  mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);

  mediaRecorder.onstop = async () => {
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

// Pause/Resume Button Logic
pauseButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      isPaused = true; // Pause the timer
      clearInterval(liveCountdownInterval); // Stop the countdown
      pauseButton.innerText = "Resume Recording";
  } else if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      isPaused = false; // Resume the timer
      startLiveCountdown(); // Restart the countdown from remaining time
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