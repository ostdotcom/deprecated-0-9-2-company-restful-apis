"use strict";

const rootPrefix = '../..'
    , v0Config = require(rootPrefix + '/config/api_params/v0.json')
    , v1Config = require(rootPrefix + '/config/api_params/v1.json')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 *
 * @constructor
 *
 * @param {object} params -
 * @param {boolean} params.api_name - human readable name of API Fired
 * @param {boolean} params.api_version - API Version
 * @param {object} params.api_params - object containing Params sent in request
 *
 * @return {result}
 */
const ApiParamsValidator = function (params) {

  const oThis = this;

  oThis.apiName = params.api_name;
  oThis.apiVersion = params.api_version;
  oThis.apiParams = params.api_params;

};

ApiParamsValidator.prototype = {

  constructor: ApiParamsValidator,

  v0ApiVersion: 'v0',

  v1ApiVersion: 'v1',

  supportedApiVersions: [
    this.v0ApiVersion,
    this.v1ApiVersion
  ],

  /**
   * Perform
   *
   * @return {result}
   */
  perform: function () {

    const oThis = this
        , apiConfigRsp = oThis._fetchApiConfig()
        , sanitisedApiParams = {}
    ;

    if (apiConfigRsp.isFailure()) {return apiConfigRsp};

    const apiConfig = apiConfigRsp.data.apiConfig
        , mandatoryKeys = apiConfig.mandatory || []
        , optionalKeys = apiConfig.optional || []
    ;

    var paramErrors = []
        , hasError = false;

    mandatoryKeys.forEach(function(whiteListedKey) {

      if (oThis.apiParams[whiteListedKey]) {
        sanitisedApiParams[whiteListedKey] = oThis.apiParams[whiteListedKey];
      } else {
        paramErrors.push({
          name: whiteListedKey,
          code: '', // TODO: To add code & msg here from OST Core ?
          msg: ''
        });
        hasError = true;
      }

    });

    if (hasError) {
      return responseHelper.paramValidationError('v_ap_3', paramErrors);
    }

    optionalKeys.forEach(function(whiteListedKey) {
      if (oThis.apiParams[whiteListedKey]) {
        sanitisedApiParams[whiteListedKey] = oThis.apiParams[whiteListedKey];
      }
    });

    return responseHelper.successWithData({sanitisedApiParams: sanitisedApiParams});

  },

  /**
   * Fetch Config for an API
   *
   * @private
   *
   * @return {result}
   */
  _fetchApiConfig: function () {

    const oThis = this;
    var versionConfig = {};

    if (oThis.apiVersion === oThis.v0ApiVersion) {
      versionConfig = v0Config;
    } else if (oThis.apiVersion === oThis.v1ApiVersion) {
      versionConfig = v1Config;
    } else {
      return responseHelper.error('v_ap_1', 'Invalid API Version');
    }

    const apiConfig = versionConfig[oThis.apiName];

    if (!apiConfig) {
      return responseHelper.error('v_ap_2', 'Invalid API Name');
    }

    return responseHelper.successWithData({apiConfig: apiConfig});

  }

}

module.exports = ApiParamsValidator;