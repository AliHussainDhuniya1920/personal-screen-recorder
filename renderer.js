const { ipcRenderer } = require('electron');

let mediaRecorder;
let recordedChunks = [];

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

