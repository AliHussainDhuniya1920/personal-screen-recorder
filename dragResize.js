const webcamOverlay = document.getElementById('webcam-overlay');

webcamOverlay.onmousedown = function (event) {
    event.preventDefault();
    
    let startX = event.clientX;
    let startY = event.clientY;
    let startWidth = webcamOverlay.offsetWidth;
    let startHeight = webcamOverlay.offsetHeight;

    function onMouseMove(event) {
        const width = startWidth + (event.clientX - startX);
        const height = startHeight + (event.clientY - startY);
        webcamOverlay.style.width = width + 'px';
        webcamOverlay.style.height = height + 'px';
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};
