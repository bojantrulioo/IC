(function () {
  const that = {};

  that.getLocationPermission = async () => new Promise((resolve) => {
    const returnPosition = () => {
      resolve();
    };
    const errorHandle = () => {
      resolve();
    };
    navigator.geolocation.getCurrentPosition(returnPosition, errorHandle);
  });

  that.getDeviceType = () => {
    const { userAgent } = navigator;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'Tablet';
    }
    if (/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
      return 'Mobile';
    }
    return 'Desktop';
  };

  that.isiOSVersion15orAbove = () => {
    if (/iP(hone|od|ad)/.test(navigator.platform)) {
      // sample iOS appVersion string: OS 14_7_1,14,7,1
      const appVersion = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
      // checks only the major version of the iOS
      const majorVersion = parseInt(appVersion[1], 10);
      if (majorVersion >= 15) {
        return true;
      }
      return false;
    }
    return false;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      // eslint-disable-next-line no-multi-assign
      exports = module.exports = that;
    }
    exports.common = that;
  } else {
    window.common = that;
  }
}());
