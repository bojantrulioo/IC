/* eslint-disable no-console */
/* global piexif */
/* global MessageFormat */
/* global APICall */
/* global common */
/* global sdkErrors */
/* global imageCompression */
/* global AcuantJavascriptWebSdk */

const baseProxyUrl = 'https://gg-ic-sdk-server-proxy.globalgateway.io';
const sdkEndpoint = `${baseProxyUrl}/acuant-html`;
const acuantVersion = 'AcuantV11.4.6';
// face capture version available after script asynchronously executes
const getFaceCaptureVersion = () => window.FACE_CAPTURE_VERSION || 'sdk-not-found';

const captureContainerID = 'capture-canvas-container';
const defualtCompressionOption = {
  maxSizeMB: 4,
  maxWidthOrHeight: 4096,
  useWebWorker: true,
};

const EncodeJPG = (imageData, msg, fn) => {
  try {
    const zeroth = {};
    zeroth[piexif.ImageIFD.Software] = msg;
    const exifObj = { '0th': zeroth };
    const exifbytes = piexif.dump(exifObj);
    fn(piexif.insert(exifbytes, imageData));
  } catch (error) {
    console.error(error);
    fn(imageData);
  }
};

const EncodeMsg = (imageData, msg, fn) => {
  const imageType = imageData.substring('data:image/'.length, imageData.indexOf(';base64')).toLowerCase();
  if (imageType === 'jpeg') {
    EncodeJPG(imageData, msg, fn);
  } else {
    // image not support, just calling the success callback
    fn(imageData);
  }
};

(function () {
  try {
    const acuantScript = document.createElement('script');
    acuantScript.src = './GlobalGatewayCapturePublicAcuant/GlobalGatewayImageCaptureSDK/AcuantJavascriptWebSdk.min.js';
    acuantScript.async = true;
    document.body.appendChild(acuantScript);

    const piexifScript = document.createElement('script');
    piexifScript.src = './GlobalGatewayCapturePublicAcuant/piexif.js';
    piexifScript.type = 'module';
    piexifScript.async = true;
    document.body.appendChild(piexifScript);

    const messageFormatScript = document.createElement('script');
    messageFormatScript.src = './GlobalGatewayCapturePublicAcuant/MessageFormat.js';
    messageFormatScript.type = 'module';
    messageFormatScript.async = true;
    document.body.appendChild(messageFormatScript);

    const apiCallScript = document.createElement('script');
    apiCallScript.src = './GlobalGatewayCapturePublicAcuant/APICall.js';
    apiCallScript.type = 'module';
    apiCallScript.async = true;
    document.body.appendChild(apiCallScript);

    const commonScript = document.createElement('script');
    commonScript.src = './GlobalGatewayCapturePublicAcuant/common.js';
    commonScript.type = 'module';
    commonScript.async = true;
    document.body.appendChild(commonScript);

    const errorScript = document.createElement('script');
    errorScript.src = './GlobalGatewayCapturePublicAcuant/sdk-errors.js';
    errorScript.type = 'module';
    errorScript.async = true;
    document.body.appendChild(errorScript);

    const compressionScript = document.createElement('script');
    compressionScript.src = './GlobalGatewayCapturePublicAcuant/browser-image-compression.mjs';
    compressionScript.type = 'module';
    compressionScript.async = true;
    document.body.appendChild(compressionScript);

    window.GG_CAPTURE_FOLDER = 'GlobalGatewayCapturePublicAcuant';
    const faceCaptureScript = document.createElement('script');
    faceCaptureScript.src = './GlobalGatewayCapturePublicAcuant/GlobalGatewayFaceCapturePublic/GlobalGatewayFaceCapture.js';
    faceCaptureScript.type = 'module';
    faceCaptureScript.async = true;
    document.body.appendChild(faceCaptureScript);

    let captureType = null;
    let shouldCollectGeo = false;

    const compressImage = async (img) => {
      const imageSize = img.length * 3 / 4 / 1024 / 1024;
      if (imageSize < sdkErrors.sizeLimitForFileUpload) {
        return img;
      }
      const option = window.windowGlobalGatewayImageCompressionOption || defualtCompressionOption;
      const image = await imageCompression.getFilefromDataUrl(img, 'temp');
      const compressedImageFile = await imageCompression(image, option);
      const compressedImage = await imageCompression.getDataUrlFromFile(compressedImageFile);
      return compressedImage;
    };

    const removeElement = () => {
      const captureDiv = document.getElementById(captureContainerID);
      if (captureDiv) {
        captureDiv.remove();
      }
    };

    const injectElement = () => {
      removeElement();
      const captureDiv = document.createElement('div');
      captureDiv.id = captureContainerID;
      captureDiv.style = 'position:absolute;left:0;top:0;right:0;bottom:0;background-color:black;';
      captureDiv.innerHTML = `
        <div id="camera" style="display:flex;height:100%;">
        <video id="acuant-player" style="display:none" controls autoplay playsinline></video>
        <div style="margin:auto;width:100%;">
          <div>
            <canvas id="acuant-video-canvas" style="width:100%;height:100%;"></canvas>
          </div>
        </div>
      `;
      document.body.appendChild(captureDiv);
    };

    const processCrop = async (isAuto, res, onSuccess, onCaptureFail, token) => {
      if (res.image && res.image.data) {
        try {
          const img = res.image.data;
          const compressedImage = await compressImage(img);
          const qualityObject = { glare: res.glare, dpi: res.dpi, sharpness: res.sharpness };

          let imageClassification = {};
          if (captureType !== 'DOCUMENT_BACK' && captureType !== 'BARCODE') {
            imageClassification = await APICall.getClassification(baseProxyUrl, compressedImage, captureType, token);
          }
          if (imageClassification.Error) {
            return onCaptureFail([imageClassification.Error]);
          }

          const message = await MessageFormat.getMessage(
            isAuto,
            0,
            captureType,
            acuantVersion,
            shouldCollectGeo,
            common.getDeviceType(),
            { qualityObject, classification: imageClassification.classification }
          );
          const successWrapper = (resultImage) => {
            onSuccess({ image: resultImage, quality: qualityObject, classification: imageClassification.classification });
          };
          EncodeMsg(compressedImage, message, successWrapper);
        } catch (error) {
          console.error(error);
          onCaptureFail([sdkErrors.errorTable.FAIL_TO_AUTO_CAPTURE]);
        }
      } else {
        onCaptureFail([sdkErrors.errorTable.FAIL_TO_AUTO_CAPTURE]);
      }
    };

    const startAcuantCamera = (isAuto, onFrameCaptured, onSuccess, onCaptureFail, token) => {
      try {
        if (isAuto) {
          if (window.AcuantCamera.isCameraSupported) {
            injectElement();
            window.AcuantCameraUI.start({
              onCaptured: () => {
                removeElement();
                onFrameCaptured();
              },
              onCropped: async (res) => {
                processCrop(isAuto, res, onSuccess, onCaptureFail, token);
              },
              onFrameAvailable: () => { },
            },
              () => {
                removeElement();
                onCaptureFail([sdkErrors.errorTable.FAIL_TO_AUTO_CAPTURE]);
              });
          } else {
            onCaptureFail([sdkErrors.errorTable.AUTO_CAPTURE_NOT_SUPPORT]);
          }
        } else {
          window.AcuantCamera.startManualCapture({
            onCaptured: () => {
              removeElement();
              onFrameCaptured();
            },
            onCropped: async (res) => {
              processCrop(isAuto, res, onSuccess, onCaptureFail, token);
            },
          },
            () => {
              onCaptureFail([sdkErrors.errorTable.FAIL_TO_MANUAL_CAPTURE]);
            });
        }
      } catch (error) {
        console.error(error);
      }
    };

    const startCapture = (targetCaptureType) => (
      isAuto = true,
      shouldEnableGeoInfo = false,
      onFrameCaptured = () => { },
      onSuccess = () => { },
      onCaptureFail = () => { },
      token,
    ) => {
      let isAutoParam = isAuto;
      if (isAutoParam && common.isiOSVersion15orAbove()) {
        isAutoParam = false;
      }
      captureType = targetCaptureType;
      shouldCollectGeo = shouldEnableGeoInfo;
      startAcuantCamera(isAutoParam, onFrameCaptured, onSuccess, onCaptureFail, token);
    };

    const InitSDK = (username, password, onInitSuccess, onInitFail) => {
      const base64Token = btoa(`${username}:${password}`);
      AcuantJavascriptWebSdk.initialize(base64Token, sdkEndpoint, {
        onSuccess: onInitSuccess,
        onFail: (code, description) => {
          console.error(`SDK intialize failed ${code}: ${description}`);
          onInitFail([sdkErrors.errorTable.FAIL_TO_INITIALIZE]);
        },
      });
    };

    const StartFrontDocumentCapture = startCapture('DOCUMENT_FRONT');

    const StartBackDocumentCapture = startCapture('DOCUMENT_BACK');

    const StartBarcodeCapture = startCapture('BARCODE');

    const StartPassportCapture = startCapture('PASSPORT');

    const StartSelfieCapture = (isAuto, shouldEnableGeoInfo, onFrameCaptured, onSuccess, onCaptureFail, token) => {
      captureType = 'SELFIE';
      shouldCollectGeo = shouldEnableGeoInfo;
      try {
        if (isAuto) {
          window.startFaceCapture(async (image) => {
            onFrameCaptured();
            const compressedImage = await compressImage(image);
            let data = await APICall.getLiveness(baseProxyUrl, compressedImage, token);
            if (data.Error) {
              return onCaptureFail([data.Error]);
            }

            const message = await MessageFormat.getMessage(
              true,
              0,
              captureType,
              getFaceCaptureVersion(),
              shouldCollectGeo,
              common.getDeviceType(),
              { liveness: data.liveness }
            );
            const successWrapper = (resultImage) => {
              onSuccess({ image: resultImage, liveness: data.liveness });
            };
            EncodeMsg(compressedImage, message, successWrapper);
          }, onCaptureFail);
        } else {
          window.AcuantPassiveLiveness.startSelfieCapture(async (image) => {
            onFrameCaptured();
            const compressedImage = await compressImage('data:image/jpeg;base64,' + image);
            let data = await APICall.getLiveness(baseProxyUrl, compressedImage, token);
            if (data.Error) {
              return onCaptureFail([data.Error]);
            }

            const message = await MessageFormat.getMessage(
              false,
              0,
              captureType,
              getFaceCaptureVersion(),
              shouldCollectGeo,
              common.getDeviceType(),
              { liveness: data.liveness }
            );
            const successWrapper = (resultImage) => {
              onSuccess({ image: resultImage, liveness: data.liveness });
            };
            EncodeMsg(compressedImage, message, successWrapper);
          });
        }
      } catch (error) {
        console.error(error);
        onCaptureFail([sdkErrors.errorTable.FAIL_TO_AUTO_CAPTURE]);
      }
    };

    window.acuantConfig = {
      path: './GlobalGatewayCapturePublicAcuant/GlobalGatewayImageCaptureSDK/',
    };

    window.GlobalGatewayImageCompressionOption = defualtCompressionOption;
    window.StartAcuantFrontDocumentCapture = StartFrontDocumentCapture;
    window.StartAcuantBackDocumentCapture = StartBackDocumentCapture;
    window.StartAcuantBarcodeCapture = StartBarcodeCapture;
    window.StartAcuantPassportCapture = StartPassportCapture;
    window.StartAcuantSelfieCapture = StartSelfieCapture;
    window.InitSDK = InitSDK;
  } catch (e) {
    console.error(e);
  }
}());
