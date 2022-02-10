(function () {
  const that = {};
  const GetIPAddress = async () => {
    const endpoint = 'https://api.globaldatacompany.com/common/v1/ip-info';
    const errorMsg = 'UNAVAILABLE';
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', endpoint, true);
      xhr.responseType = 'json';
      xhr.timeout = 3000;
      xhr.ontimeout = () => {
        resolve(errorMsg);
      };
      xhr.onload = () => {
        const { status } = xhr;
        if (status === 200) {
          if (xhr.response && xhr.response.ipAddress) {
            resolve(xhr.response.ipAddress);
          } else {
            resolve(errorMsg);
          }
        } else {
          resolve(errorMsg);
        }
      };
      xhr.onerror = () => {
        resolve(errorMsg);
      };
      xhr.send();
    });
  };
  const getBrowser = () => {
    const { userAgent } = navigator;
    let tempValue;
    // try matching browser name
    let matcher = userAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    // try matching IE version name
    if (/trident/i.test(matcher[1])) {
      tempValue = /\brv[ :]+(\d+)/g.exec(userAgent) || [];
      return `IE ${tempValue[1] || ''}`;
    }
    // try matching Opera or Edge
    if (matcher[1] === 'Chrome') {
      tempValue = userAgent.match(/\b(OPR|Edge)\/(\d+)/);
      if (tempValue != null) return tempValue.slice(1).join(' ').replace('OPR', 'Opera');
    }
    matcher = matcher[2] ? [matcher[1], matcher[2]] : [navigator.appName, navigator.appVersion, '-?'];
    tempValue = userAgent.match(/version\/(\d+)/i);
    if (tempValue) matcher.splice(1, 1, tempValue[1]);
    return matcher.join(' ');
  };

  const getOS = () => {
    const { userAgent, platform } = window.navigator;
    const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
    let os = 'Unknown';

    if (macosPlatforms.indexOf(platform) !== -1) {
      os = 'Mac OS';
    } else if (iosPlatforms.indexOf(platform) !== -1) {
      os = 'iOS';
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
      os = 'Windows';
    } else if (/Android/.test(userAgent)) {
      os = 'Android';
    } else if (!os && /Linux/.test(platform)) {
      os = 'Linux';
    }
    return os;
  };
  const getLocation = async () => new Promise((resolve) => {
    const returnPosition = (position) => {
      resolve(position);
    };
    const errorHandle = (error) => {
      console.error(error);
      resolve(null);
    };
    navigator.geolocation.getCurrentPosition(returnPosition, errorHandle);
  });
  that.getMessage = async (isAuto, retries, captureType, version, collectGeo, deviceType, additionalInfo = {}) => {
    const collectGeoBool = (collectGeo === 'true') || (collectGeo === true);
    const date = new Date();
    const address = await GetIPAddress();
    const browser = getBrowser();
    const os = getOS();
    const sdkVersion = version;
    const messageObject = {
      V: '3.0.21-beta.214',
      MODE: isAuto ? 'AUTO' : 'MANUAL',
      RETRIES: retries,
      SYSTEM: 'WEB',
      CAPTURESDK: sdkVersion,
      TRULIOOSDK: captureType === 'DOCUMENT_FRONT' || captureType === 'DOCUMENT_BACK' ? 'DOCUMENT' : captureType,
      TIMESTAMP: date.toJSON(),
      IPADDRESS: address,
      DEVICETYPE: deviceType,
      OPERATINGSYSTEM: os,
      BROWSER: browser,
      GPSLATITUDE: '',
      GPSLONGITUDE: '',
      AcuantHorizontalResolution: '',
      AcuantVerticalResolution: '',
      AcuantSharpnessMetric: '',
      AcuantGlareMetric: '',
    };

    if (additionalInfo.qualityObject) {
      messageObject.AcuantGlareMetric = Math.floor(additionalInfo.qualityObject.glare);
      messageObject.AcuantSharpnessMetric = Math.floor(additionalInfo.qualityObject.sharpness);
      messageObject.AcuantVerticalResolution = Math.floor(additionalInfo.qualityObject.dpi);
      messageObject.AcuantHorizontalResolution = Math.floor(additionalInfo.qualityObject.dpi);
    }

    if (additionalInfo.liveness) {
      messageObject.Liveness = additionalInfo.liveness;
    }

    if (additionalInfo.classification) {
      messageObject.IDClassification = additionalInfo.classification;
    }

    if (collectGeoBool) {
      const position = await getLocation();
      if (position) {
        messageObject.GPSLATITUDE = position.coords.latitude;
        messageObject.GPSLONGITUDE = position.coords.longitude;
      }
    }
    const message = JSON.stringify(messageObject);
    return message;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      // eslint-disable-next-line no-multi-assign
      exports = module.exports = that;
    }
    exports.MessageFormat = that;
  } else {
    window.MessageFormat = that;
  }
}());
