const { ipcRenderer } = require('electron');



let mediaRecorder;
let recordedChunks = [];
window.onload = () => {
    document.getElementById('stop').disabled = true; // Disable stop button when app loads
};

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
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const buffer = Buffer.from(await blob.arrayBuffer());
        document.getElementById('video').src = url;

          // Auto-save the recording
        //   const savedPath = await ipcRenderer.invoke('save-recording', buffer);
        //   if (savedPath) {
        //       console.log(`Recording saved at: ${savedPath}`);
        //   } else {
        //       console.log("Recording was not saved.");
        //   }

         // Attempt to manually save, or auto-save if canceled
         const savedPath = await ipcRenderer.invoke('save-recording', buffer);
         console.log(`Recording saved at: ${savedPath}`);
  
          recordedChunks = [];

            // Update UI after recording stops
        document.getElementById('stop').disabled = true;
        document.getElementById('start').disabled = false;
        document.getElementById('countdown').innerText = ''; // Clear the message
        document.getElementById('video-message').innerText = 'Oops! If you forget to save your recorded file. No problem 👉Your Video is automatically saved in your system Videos Folder.check it.Thanks';

        // Save file
        // const a = document.createElement('a');
        // a.href = url;
        // a.download = 'recording.webm';
        // a.click();
    };

    mediaRecorder.start();

    // Enable stop button and disable start button after recording starts
    document.getElementById('stop').disabled = false;
    document.getElementById('start').disabled = true;
    
}

document.getElementById('start').addEventListener('click', startRecording);
document.getElementById('stop').addEventListener('click', () => {
    if (mediaRecorder) {
        mediaRecorder.stop();
        document.getElementById('stop').disabled = true;
        document.getElementById('start').disabled = false;
    }
});


