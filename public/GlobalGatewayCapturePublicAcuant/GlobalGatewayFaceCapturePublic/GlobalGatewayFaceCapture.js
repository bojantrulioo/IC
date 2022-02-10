(function () {
  try {
    const FC_PATH_ROOT = window.GG_CAPTURE_FOLDER || '';
    const VERSION = '1.6.1'

    const documentHead = document.getElementsByTagName('HEAD')[0];
    const faceApiScript = document.createElement('script');
    faceApiScript.src = `./${FC_PATH_ROOT}/GlobalGatewayFaceCapturePublic/GlobalGatewayFaceCaptureSDK/face-api.min.js`;
    faceApiScript.type = 'module';
    faceApiScript.async = true;
    documentHead.appendChild(faceApiScript);

    const componentsScript = document.createElement('script');
    componentsScript.src = `./${FC_PATH_ROOT}/GlobalGatewayFaceCapturePublic/GlobalGatewayFaceCaptureSDK/FaceProcessor.js`;
    componentsScript.type = 'module';
    componentsScript.async = true;
    documentHead.appendChild(componentsScript);

    const styleScript = document.createElement('link');
    styleScript.href = `./${FC_PATH_ROOT}/GlobalGatewayFaceCapturePublic/css/FaceCaptureStyles.css`;
    styleScript.rel = 'stylesheet';
    styleScript.type = 'text/css';
    documentHead.appendChild(styleScript);

    let isInitialized = false;
    let isLoading = false;
    let onSuccessCallback;
    let onFailCallback;

    let stream = null;
    let videoEl = null;
    let processor = null;
    let videoOffset = { x: 0, y: 0 };

    const CAPTURE_CONTAINER_ID = 'face-capture-container';
    const LOADING_ELEMENT_ID = 'capture-loading-indicator';

    const faceCaptureOptions = {
      centerDeadzone: 150,
      faceSize: { min: 0.2, max: 0.4 },
      scaledHeightOffset: 1.2,
      autoCaptureTime: 1000 * 20,
      scoreThreshold: 0.6,
      inputSize: 512,
      maxDetectionBias: 2,
      countDownDigits: 2,
      fontStyle: '30px Roboto sans-serif',
      containerId: CAPTURE_CONTAINER_ID,
      loadingElementId: LOADING_ELEMENT_ID,
      resolution: { width: 960, height: 1280 },
    };

    const getVideoCanvas = () => {
      return document.getElementById('video-canvas');
    };
    const getOverlayCanvas = () => {
      return document.getElementById('overlay');
    };
    const getTextElement = () => {
      return document.getElementById('hintMessage');
    };
    const getDetectionCanvas = () => {
      return document.getElementById('detection-canvas');
    };
    const getVideoPlayer = () => {
      return document.getElementById('face-capture-player');
    };

    const removeElement = () => {
      const captureDiv = document.getElementById(CAPTURE_CONTAINER_ID);
      if (captureDiv) {
        captureDiv.remove();
      }
    };

    const injectElement = () => {
      removeElement();
      const captureDiv = document.createElement('div');
      captureDiv.id = CAPTURE_CONTAINER_ID;
      captureDiv.innerHTML =
        '<div style="display:flex;height:100%;"> ' +
        '<div style="margin:auto;width:100%;"> ' +
        '<div id="hintMessage-container""> <p id="hintMessage"></p> </div>' +
        '<div> <canvas id="detection-canvas" /> </div> ' +
        '<div> <canvas id="video-canvas" /> </div> ' +
        '<div id="overlay-container"> <canvas id="overlay" /> </div> </div> ' +
        '<video id="face-capture-player" controls autoplay playsinline /> </div> ';

      const loadingElement = document.createElement('div');
      loadingElement.id = LOADING_ELEMENT_ID;
      captureDiv.appendChild(loadingElement);

      document.body.appendChild(captureDiv);
    };

    const faceCaptureError = (message, error) => {
      console.warn(error);
      if (onFailCallback) {
        onFailCallback(message);
      }
    };

    const cropImage = (cropAmount = 0.1) => {
      const videoPlayer = getVideoPlayer();

      const xChop = videoPlayer.videoWidth * (cropAmount * 0.5);
      const xChopEnd = videoPlayer.videoWidth - videoPlayer.videoWidth * cropAmount;
      const yChop = videoPlayer.videoHeight * (cropAmount * 0.5);
      const yChopEnd = videoPlayer.videoHeight - videoPlayer.videoHeight * cropAmount;

      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'cropping-canvas';
      newCanvas.width = xChopEnd - xChop;
      newCanvas.height = yChopEnd - yChop;
      newCanvas.hidden = true;
      document.body.appendChild(newCanvas);

      const context = newCanvas.getContext('2d');
      context.drawImage(videoPlayer, xChop, yChop, xChopEnd, yChopEnd, 0, 0, newCanvas.width, newCanvas.height);
      const data = newCanvas.toDataURL('image/jpeg');
      document.body.removeChild(newCanvas);

      return data;
    };

    const captureFrame = () => {
      const data = cropImage(0.2);
      stopFaceCapture();

      onSuccessCallback(data);
    };

    const cancelCapture = () => {
      stopFaceCapture();
      faceCaptureError('Auto capture timed out.', null);
    };

    const stopFaceCapture = () => {
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl = null;
      }

      if (stream) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
        stream = null;
      }
      removeElement();
    };

    const startFaceCapture = (onSuccess, onFail) => {
      if (isLoading) {
        return;
      }
      if (!isInitialized) {
        isLoading = true;
        (async () => {
          await faceapi.nets.tinyFaceDetector.loadFromUri(
            `./${FC_PATH_ROOT}/GlobalGatewayFaceCapturePublic/GlobalGatewayFaceCaptureSDK/models`
          );
          isInitialized = true;
          isLoading = false;
          start();
        })();
      } else {
        start();
      }
      onSuccessCallback = onSuccess;
      onFailCallback = onFail;
    };

    const start = async () => {
      injectElement();
      videoEl = getVideoPlayer();
      const canvas = getVideoCanvas();
      const context = canvas.getContext('2d');

      videoEl.addEventListener(
        'play',
        function () {
          draw(this, context, videoEl.videoWidth, videoEl.videoHeight);
        },
        false
      );

      try {
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: 'user',
              // width and height are reversed when initially requesting resource
              width: { ideal: faceCaptureOptions.resolution.height },
              height: { ideal: faceCaptureOptions.resolution.width },
            },
            audio: false,
          })
          .then((VideoStream) => {
            stream = VideoStream;
            videoEl.srcObject = stream;
          })
          .then(() => new Promise((resolve) => (videoEl.onloadedmetadata = resolve)));

        prepareVideoCanvas();
        startFaceAPI();
      } catch (error) {
        faceCaptureError(error);
      }
    };

    const prepareVideoCanvas = () => {
      const canvas = getVideoCanvas();
      const context = canvas.getContext('2d');
      const drawingCanvas = getOverlayCanvas();

      const [track] = stream.getTracks();
      const { width, height } = track.getSettings();
      const { innerWidth, innerHeight } = window;

      canvas.width = innerWidth;
      canvas.height = innerHeight;
      drawingCanvas.width = innerWidth * 2;
      drawingCanvas.height = innerHeight * 2;

      // zooms and centers video stream inside screen space
      if (height !== innerHeight && width !== innerWidth) {
        const scaleFactor = innerHeight / height;
        const horizontalScale = innerWidth / width;
        context.scale(scaleFactor, scaleFactor);
        const videoWidthRadius = (videoEl.videoWidth * scaleFactor) / 2;
        const videoHeightRadius = (videoEl.videoHeight * scaleFactor) / 2;
        const additionalWidthOffset = videoWidthRadius - (videoEl.videoWidth * horizontalScale) / 2;
        const screenWidthRadius = innerWidth / 2;
        const screenHeightRadius = innerHeight / 2;
        const offsetWidthRadius = screenWidthRadius - videoWidthRadius - additionalWidthOffset;
        const offsetHeightRadius = screenHeightRadius - videoHeightRadius;
        videoOffset.x = offsetWidthRadius;
        videoOffset.y = offsetHeightRadius;
      }

      window.scrollTo(0, 0);
    };

    const draw = (video, context, width, height) => {
      if (video.paused || video.ended) return false;
      context.drawImage(video, videoOffset.x, videoOffset.y, width, height);
      setTimeout(draw, 10, video, context, width, height);
    };

    const startFaceAPI = () => {
      processor = new FaceProcessor(
        captureFrame,
        cancelCapture,
        getVideoPlayer(),
        getOverlayCanvas(),
        getDetectionCanvas(),
        getTextElement(),
        faceCaptureOptions
      );
    };

    window.FACE_CAPTURE_VERSION = VERSION;
    window.startFaceCapture = startFaceCapture;
  } catch (error) {
    console.error('error in Global Gateway Face Capture: ', error);
  }
})();
