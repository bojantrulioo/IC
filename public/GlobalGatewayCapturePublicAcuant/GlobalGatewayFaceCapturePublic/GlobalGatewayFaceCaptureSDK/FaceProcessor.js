const FaceCaptureText = {
  MOVE_FURTHER: 'Move further',
  MOVE_CLOSER: 'Move closer',
  HOLD_STILL: 'Hold still',
  CENTER_FACE: 'Please center your face',
  HOLD_UPRIGHT: 'Hold your phone upright',
  LOADING_CAMERA: 'Loading camera...',
};

const FaceDepthEnum = {
  FACE_TOO_CLOSE: 0,
  FACE_TOO_FAR: 1,
  FACE_IN_POSITION: 2,
};

const FaceCaptureColors = {
  good: 'rgba(0,204,82,0.5)',
  bad: 'rgba(222,54,23,0.5)',
  unknown: 'rgba(255,255,255,0.5)',
};

class FaceProcessor {
  constructor(completionCallback, failCallback, videoPlayer, overlayCanvas, detectionCanvas, textElement, options) {
    this.callback = completionCallback;
    this.failCallback = failCallback;
    this.videoPlayer = videoPlayer;
    this.overlayCanvas = overlayCanvas;
    this.detectionCanvas = detectionCanvas;
    this.textElement = textElement;
    this.options = options;
    this.faceDetector = new faceapi.TinyFaceDetectorOptions({
      INPUT_SIZE: this.options.inputSize,
      SCORE_THRESHOLD: this.options.scoreThreshold,
    });

    this.counter = 0;
    this.countDown = false;
    this.countDownInterval = null;
    this.countDownNum = this.options.countDownDigits;
    this.detections = null;
    this.lastDetection = null;
    this.detectionBias = 0;
    this.faceProcessInterval = null;
    this.faceUpdateInterval = null;
    this.captureTimer = null;

    faceapi.matchDimensions(this.detectionCanvas, { ...this.options.resolution });

    this.beginProcessing();
  }

  beginProcessing = () => {
    this.videoPlayer.addEventListener('playing', this.processFace);
    this.captureTimer = setTimeout(this.captureFail, this.options.autoCaptureTime);
  };

  getDetectionBias = (faceDetection) => {
    let newBias = 0;
    if (faceDetection) {
      this.lastDetection = faceDetection;
      newBias = this.detectionBias + 1;
    } else if (this.lastDetection && this.detectionBias > 0) {
      newBias = this.detectionBias - 1;
    } else {
      this.lastDetection = null;
    }
    this.detectionBias = this.clamp(newBias, 0, this.options.maxDetectionBias);

    return this.lastDetection;
  };

  clearDetections = () => {
    this.detectionBias = 0;
    this.setDetections(null);
  };

  clamp = (num, min, max) => {
    return Math.min(Math.max(num, min), max);
  };

  getDetections = () => {
    return this.detections;
  };

  setDetections = (newDetections) => {
    this.detections = newDetections;
  };

  prepareFaceCaptureAPI = async (delegate, ms) => {
    return new Promise((resolve) =>
      setTimeout(() => {
        delegate();
        resolve();
      }, ms)
    );
  };

  processFace = async () => {
    const video = this.videoPlayer;
    const canvas = this.detectionCanvas;
    const overlay = this.overlayCanvas;

    const COUNTER_LIMIT = 5;
    const PROCESS_TICK = 1000 / 30;
    const FACE_UPDATE_TICK = 500;
    let hintMessage = '';

    const resetCounter = () => {
      if (this.counter > 0) {
        this.counter = 0;
        this.countDown = false;
        if (this.countDownInterval) {
          clearInterval(this.countDownInterval);
          this.countDownInterval = null;
          this.countDownNum = this.options.countDownDigits;
        }
      }
    };

    const updateWorker = async () => {
      const newDetection = await faceapi.detectSingleFace(video, this.faceDetector);
      this.setDetections(this.getDetectionBias(newDetection));
    };
    const processWorker = () => {
      const currentDetections = this.getDetections();
      if (currentDetections) {
        const relativeDimensions = faceapi.matchDimensions(canvas, video, true);
        const resizedResult = faceapi.resizeResults(currentDetections, relativeDimensions);

        if (this.isFaceCentered(canvas, resizedResult)) {
          const faceDepthPosition = this.getFaceDepth(resizedResult);

          if (faceDepthPosition === FaceDepthEnum.FACE_TOO_CLOSE) {
            hintMessage = FaceCaptureText.MOVE_FURTHER;
            resetCounter();
          } else if (faceDepthPosition === FaceDepthEnum.FACE_TOO_FAR) {
            hintMessage = FaceCaptureText.MOVE_CLOSER;
            resetCounter();
          } else {
            // face is in correct position for capture
            if (this.counter < COUNTER_LIMIT) {
              hintMessage = FaceCaptureText.HOLD_STILL;
              this.counter++;
            }

            if (this.counter === COUNTER_LIMIT && !this.countDown) {
              this.countDown = true;
              this.countDownNum = 2;
              hintMessage = `${this.countDownNum}`;
              this.countDownInterval = setInterval(() => {
                this.countDownNum--;
                hintMessage = `${this.countDownNum}`;
                if (this.countDownNum === 0) {
                  clearInterval(this.countDownInterval);
                  this.completeCapture();
                }
              }, 1000);
            }
          }
        } else {
          hintMessage = FaceCaptureText.CENTER_FACE;
          resetCounter();
        }
      } else {
        hintMessage = FaceCaptureText.HOLD_UPRIGHT;
        resetCounter();
      }

      this.updateUI(overlay, hintMessage);
    };

    this.showTextHint();
    this.updateUI(overlay, FaceCaptureText.LOADING_CAMERA);
    await this.prepareFaceCaptureAPI(updateWorker, 10);
    this.clearDetections();

    this.faceUpdateInterval = setInterval(updateWorker, FACE_UPDATE_TICK);
    this.faceProcessInterval = setInterval(processWorker, PROCESS_TICK);
    this.removeLoadingIndicator();
  };

  updateUI = (canvas, text) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw oval to screen
    ctx.fillStyle = 'rgba(39,46,54,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const MAX_OVAL_HEIGHT = 470;
    const MAX_OVAL_RATIO = 0.75;
    const ovalHeight = Math.min(canvas.height * 0.33, MAX_OVAL_HEIGHT);
    const ovalWidth = Math.min(canvas.width * 0.4, ovalHeight * MAX_OVAL_RATIO);
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, ovalWidth, ovalHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    const LINE_WIDTH = 17;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = this.getCircleColor(text);
    ctx.lineWidth = LINE_WIDTH;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, ovalWidth - LINE_WIDTH / 2, ovalHeight - LINE_WIDTH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // display text
    this.textElement.innerHTML = text;
  };

  isFaceCentered = (canvas, resizedResult) => {
    const displaySize = {
      width: canvas.width,
      height: canvas.height,
    };
    const x = resizedResult.box.topLeft.x + resizedResult.box.width / 2;
    const y = (resizedResult.box.topLeft.y + resizedResult.box.height / 2) / this.options.scaledHeightOffset;
    const canvasCenter = { x: displaySize.width / 2, y: displaySize.height / 2 };
    const offsetX = Math.abs(canvasCenter.x - x);
    const offsetY = Math.abs(canvasCenter.y - y);
    const unscaledOffset = { x: offsetX, y: offsetY };

    return unscaledOffset.x < this.options.centerDeadzone && unscaledOffset.y < this.options.centerDeadzone;
  };

  getFaceDepth = (resizedResult) => {
    const {
      box: { width, height },
    } = resizedResult;
    const faceArea = (width * height) / (this.options.resolution.width * this.options.resolution.height);

    if (faceArea > this.options.faceSize.max) {
      return FaceDepthEnum.FACE_TOO_CLOSE;
    }
    if (faceArea < this.options.faceSize.min) {
      return FaceDepthEnum.FACE_TOO_FAR;
    }
    return FaceDepthEnum.FACE_IN_POSITION;
  };

  getCircleColor = (status) => {
    switch (status) {
      case FaceCaptureText.MOVE_FURTHER:
      case FaceCaptureText.MOVE_CLOSER:
        return FaceCaptureColors.bad;
      case FaceCaptureText.HOLD_STILL:
      case '2':
      case '1':
        return FaceCaptureColors.good;
      default:
        return FaceCaptureColors.unknown;
    }
  };

  showTextHint = () => (this.textElement.style.display = 'block');
  hideTextHint = () => (this.textElement.style.display = 'none');

  removeLoadingIndicator = () => {
    const container = document.getElementById(this.options.containerId);
    const loader = document.getElementById(this.options.loadingElementId);
    container.removeChild(loader);
  };

  cleanup = () => {
    clearInterval(this.countDownInterval);
    this.countDownInterval = null;
    clearTimeout(this.captureTimer);
    this.captureTimer = null;
    this.videoPlayer.removeEventListener('playing', this.processFace);
    clearInterval(this.faceProcessInterval);
    this.faceProcessInterval = null;
    clearInterval(this.faceUpdateInterval);
    this.faceUpdateInterval = null;

    this.hideTextHint();
  };

  completeCapture = () => {
    this.cleanup();
    this.callback();
  };

  captureFail = () => {
    if (this.countDown) {
      setTimeout(this.captureFail, 1000);
    } else {
      this.cleanup();
      this.failCallback();
    }
  };
}

window.FaceProcessor = FaceProcessor;
