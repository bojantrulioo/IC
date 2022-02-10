(function () {
  const that = {};
  const sizeOfMegabyteInBytes = 1024 ** 2;
  const sizeLimitForFileUploadInMB = 4; // 4 MB cap, if changing please replace all '4's in the file

  that.sizeLimitForFileUpload = sizeOfMegabyteInBytes * sizeLimitForFileUploadInMB;

  that.errorTable = {
    FAIL_TO_INITIALIZE: { code: 1000, type: 'FAIL_TO_INITIALIZE' },
    IMAGE_SMALLER_THAN_MIN_SIZE: { code: 1001, type: 'IMAGE_SMALLER_THAN_MIN_SIZE' },
    CORRUPT_IMAGE: { code: 1002, type: 'CORRUPT_IMAGE' },
    FILE_TYPE_INVALID: { code: 1003, type: 'FILE_TYPE_INVALID' },
    PDF_FILE_SIZE_OVER_4_MB: { code: 1004, type: 'PDF_FILE_SIZE_OVER_4_MB' },
    AUTO_CAPTURE_NOT_SUPPORT: { code: 1005, type: 'AUTO_CAPTURE_NOT_SUPPORT' },
    FAIL_TO_AUTO_CAPTURE: { code: 1006, type: 'FAIL_TO_AUTO_CAPTURE' },
    FAIL_TO_MANUAL_CAPTURE: { code: 1007, type: 'FAIL_TO_MANUAL_CAPTURE' },
    MISSING_TOKEN: { code: 1008, type: 'MISSING_TOKEN' },
    INVALID_TOKEN: { code: 1009, type: 'INVALID_TOKEN' },
    NO_MORE_TOKEN_ATTEMPTS: { code: 1010, type: 'NO_MORE_TOKEN_ATTEMPTS' },
    INVALID_ORIGIN_URL: { code: 1011, type: 'INVALID_ORIGIN_URL' },
    MISSING_IMAGE: { code: 1012, type: 'MISSING_IMAGE' },
    FAIL_TO_GET_LIVENESS_DATA: { code: 1013, type: 'FAIL_TO_GET_LIVENESS_DATA' },
    FAIL_TO_GET_CLASSIFICATION_DATA: { code: 1014, type: 'FAIL_TO_GET_CLASSIFICATION_DATA' },
  };

  that.getError = (errorCode) => {
    const error = Object.entries(that.errorTable).find((error) => errorCode === error[1].code);
    if (error && error.length > 1) {
      return error[1];
    }
    return;
  };

  that.isPDFFileSizeValid = (file) => {
    if (file.type === 'application/pdf' && file.size > that.sizeLimitForFileUpload) {
      return that.errorTable.PDF_FILE_SIZE_OVER_4_MB;
    }
    return null;
  };

  that.isFileTypeValid = (file) => {
    const validTypes = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

    if (!Object.values(validTypes).includes(file.type)) {
      return that.errorTable.FILE_TYPE_INVALID;
    }
    return null;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      // eslint-disable-next-line no-multi-assign
      exports = module.exports = that;
    }
    exports.sdkErrors = that;
  } else {
    window.sdkErrors = that;
  }
}());
