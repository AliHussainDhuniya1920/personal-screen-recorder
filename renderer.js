const { ipcRenderer } = require('electron');



let mediaRecorder;
let recordedChunks = [];

async function startRecording() {
    let countdown = 5;
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    const countdownDisplay = document.getElementById('countdown');

    // Disable start button during countdown
    startButton.disabled = true;
    stopButton.disabled = true;

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
        document.getElementById('video').src = url;

        // Save file
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.webm';
        a.click();
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


document.getElementById('start').addEventListener('click', async () => {
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
        document.getElementById('video').src = url;

        // Save the file (optional)
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.webm';
        a.click();
    };

    mediaRecorder.start();
});

document.getElementById('stop').addEventListener('click', () => {
    if (mediaRecorder) mediaRecorder.stop();
});


document.getElementById('start').addEventListener('click', async () => {
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
});

document.getElementById('stop').addEventListener('click', () => {
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
});

