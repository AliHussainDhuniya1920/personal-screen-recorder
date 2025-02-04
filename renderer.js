const { ipcRenderer } = require('electron');
const path = require('path');


let mediaRecorder;
let recordedChunks = [];
let stopTimer; // Timer to automatically stop recording
let beepInterval;
let liveCountdownInterval;
let selectedDuration = 30 * 60 * 1000; // Default to 30 minutes


window.onload = () => {
    document.getElementById('stop').disabled = true;
    document.getElementById('live-timer').innerText = formatTime(selectedDuration);
};



// const RECORDING_LIMIT = 30 * 60 * 1000; // 65 minutes in milliseconds
// const RECORDING_LIMIT = 5000; // TESTING in seconds


// Function to format time in HH:MM:SS
function formatTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    // let hours = Math.floor(totalSeconds / 60);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    return `Time Left:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Function to start live countdown timer
function startLiveCountdown() {
    // let timeRemaining = RECORDING_LIMIT; // Start at 65 minutes

    let timeRemaining = selectedDuration;

    liveCountdownInterval = setInterval(() => {
        timeRemaining -= 1000; // Reduce by 1 second
        document.getElementById('live-timer').innerText = `Time Left: ${formatTime(timeRemaining)}`;

        if (timeRemaining <= 0) {
            clearInterval(liveCountdownInterval);
            document.getElementById('live-timer').innerText = "Time Left: 00:00";
        }
    }, 1000);
}



// Function to play a beep sound for 3 seconds
function playBeepSound() {
    const audioPath = path.join(__dirname, 'alert.mp3'); // Ensure this file exists
    const beepAudio = new Audio(audioPath); 

    beepInterval = setInterval(() => {
        beepAudio.currentTime = 0; // Reset to start
        beepAudio.play()
            .then(() => console.log("Playing custom beep sound"))
            .catch(err => {
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
    const { exec } = require('child_process');

    if (process.platform === "win32") {
        exec("powershell -c [console]::beep(800, 300)");
    } else if (process.platform === "darwin") {
        exec("osascript -e 'beep'");
    } else if (process.platform === "linux") {
        exec("echo -e '\\a'"); // Linux default beep
    }
}

// Get selected recording duration

// document.getElementById('recording-time').addEventListener('change', (event) => {
//     selectedDuration = parseInt(event.target.value) * 60 * 1000; // Convert minutes to milliseconds
//     document.getElementById('live-timer').innerText = formatTime(selectedDuration);
// });

//to support 30 seconds
document.getElementById('recording-time').addEventListener('change', (event) => {
    selectedDuration = parseInt(event.target.value) * 60 * 500; // Convert minutes to milliseconds
    document.getElementById('live-timer').innerText = formatTime(selectedDuration);
});



async function startRecording() {
    let countdown = 5;
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    const countdownDisplay = document.getElementById('countdown');
    const videoMessage = document.getElementById('video-message');


    // Disable start button during countdown
    startButton.disabled = true;
    stopButton.disabled = true;
    videoMessage.innerText = ''; // Clear any previous message


    // Start Countdown
    countdownDisplay.innerText = `Recording starts in ${countdown}...`;
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownDisplay.innerText = `Recording starts in ${countdown}...`;

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.innerText = 'Recording started!';
            actualStartRecording(); // Call actual recording function
        }
    }, 1000);
}

async function actualStartRecording() {
    const sources = await ipcRenderer.invoke('get-sources');

    const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'desktop' } },
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[0].id
            }
        }
    });

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...micStream.getAudioTracks()
    ]);

    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp8,opus' });

    mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);

    mediaRecorder.onstop = async () => {
        clearTimeout(stopTimer); // Clear the auto-stop timer when manually stopping
        clearInterval(liveCountdownInterval); // Stop live countdown timer
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const buffer = Buffer.from(await blob.arrayBuffer());
        document.getElementById('video').src = url;

     
         // Attempt to manually save, or auto-save if canceled
         const savedPath = await ipcRenderer.invoke('save-recording', buffer);
         console.log(`Recording saved at: ${savedPath}`);
  
          recordedChunks = [];

            // Update UI after recording stops
        document.getElementById('stop').disabled = true;
        document.getElementById('start').disabled = false;
        document.getElementById('countdown').innerText = ''; // Clear the message
        document.getElementById('video-message').innerText = 'Oops! If you forget to save your recorded file. No problem 👉Your Video is automatically saved in your system Videos Folder.check it.Thanks';
        document.getElementById('live-timer').innerText = "Time Left: 00:00:00"; // Reset countdown timer UI

    };

    mediaRecorder.start();
    startLiveCountdown(); // Start updating countdown timer


    // Enable stop button and disable start button after recording starts
    document.getElementById('stop').disabled = false;
    document.getElementById('start').disabled = true;
    
    // Auto-stop recording after 65 minutes
    stopTimer = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
            playBeepSound();
            showRecordingStoppedNotification(); // Show system notification
            mediaRecorder.stop();
            // alert('Recording stopped automatically after 65 minutes.');
        }
    }, selectedDuration);
}

// Function to show a system notification
function showRecordingStoppedNotification() {
    if (Notification.permission === "granted") {
        new Notification("Screen Recording Stopped", {
            body: "Recording stopped automatically after 30 minutes.",
            silent: false, // Allows sound with notification
        });
    } else {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("Screen Recording Stopped", {
                    body: "Recording stopped automatically after 30 minutes.",
                    silent: false,
                });
            }
        });
    }
}

document.getElementById('start').addEventListener('click', startRecording);
document.getElementById('stop').addEventListener('click', () => {
    if (mediaRecorder) {
        clearTimeout(stopTimer); // Clear the auto-stop timer if manually stopped
        clearInterval(beepInterval); // Prevent beep sound if manually stopped
        clearInterval(liveCountdownInterval); // Stop the countdown when manually stopped
        mediaRecorder.stop();
        document.getElementById('stop').disabled = true;
        document.getElementById('start').disabled = false;
        document.getElementById('live-timer').innerText = "Time Left: 00:00:00"; // Reset countdown UI

    }
});


