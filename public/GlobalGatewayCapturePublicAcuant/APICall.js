(function () {
    const that = {};
    that.getLiveness = async (baseUrl, compressedImage, token) => {
        let data = { liveness: null };
        if (token) {
            const response = await fetch(`${baseUrl}/liveness-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    token: token,
                },
                body: JSON.stringify({
                    image: compressedImage,
                }),
            });

            if (!response.ok) {
                if (response.status === 400 || response.status === 401) {
                    const responseData = await response.json();
                    if (responseData && responseData.ErrorCode) {
                        const livenessError = sdkErrors.getError(responseData.ErrorCode);
                        if (livenessError) {
                            return { Error: livenessError };
                        }
                    }
                    return { Error: sdkErrors.errorTable.FAIL_TO_GET_LIVENESS_DATA };
                }
                return { Error: sdkErrors.errorTable.FAIL_TO_GET_LIVENESS_DATA };
            }
            data.liveness = await response.json();
        }
        return data;
    };

    that.getClassification = async (baseUrl, compressedImage, captureType, token) => {
        let data = { classification: null };
        if (token) {
            const response = await fetch(`${baseUrl}/classification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    token,
                },
                body: JSON.stringify({
                    isFrontImage: captureType !== 'DOCUMENT_BACK',
                    image: compressedImage,
                }),
            });

            if (!response.ok) {
                if (response.status === 400 || response.status === 401) {
                    const responseData = await response.json();
                    if (responseData && responseData.ErrorCode) {
                        const classificationError = sdkErrors.getError(responseData.ErrorCode);
                        if (classificationError) {
                            return { Error: classificationError };
                        }
                    }
                    return { Error: sdkErrors.errorTable.FAIL_TO_GET_CLASSIFICATION_DATA };
                }
                return { Error: sdkErrors.errorTable.FAIL_TO_GET_CLASSIFICATION_DATA };
            }
            data.classification = await response.json();
        }
        return data;
    };

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            // eslint-disable-next-line no-multi-assign
            exports = module.exports = that;
        }
        exports.APICall = that;
    } else {
        window.APICall = that;
    }
}());
