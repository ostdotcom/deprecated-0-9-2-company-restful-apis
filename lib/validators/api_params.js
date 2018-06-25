"use strict";

/**
 * This class is for validating the api params.
 *
 * @module lib/validators/api_params
 *
 */

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , v0Config = require(rootPrefix + '/config/api_params/v0/signature')
  , v1Config = require(rootPrefix + '/config/api_params/v1/signature')
  , v1Dot1Config = require(rootPrefix + '/config/api_params/v1.1/signature')
  , internalConfig = require(rootPrefix + '/config/api_params/internal/signature')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
;

/**
 *
 * @constructor
 *
 * @param {object} params
 * @param {boolean} params.api_name - human readable name of API Fired - used for finding the mandatory and optional params
 * @param {boolean} params.api_version - API Version
 * @param {object} params.api_params - object containing Params sent in request
 */
const ApiParamsValidator = function (params) {

  const oThis = this
  ;

  oThis.apiName = params.api_name;
  oThis.apiVersion = params.api_version;
  oThis.apiParams = params.api_params;

  oThis.paramsConfig = null;
  oThis.sanitisedApiParams = {};

};

ApiParamsValidator.prototype = {

  constructor: ApiParamsValidator,

  /**
   * v0
   * @constant
   */
  v0ApiVersion: apiVersions.v0,

  /**
   * v1
   * @constant
   */
  v1ApiVersion: apiVersions.v1,

  /**
   * v1.1
   * @constant
   */
  v1Dot1ApiVersion: apiVersions.v1Dot1,

  /**
   * internal
   * @constant
   */
  internalApiVersion: apiVersions.internal,

  /**
   * supported api versions
   *
   * @constant
   */
  supportedApiVersions: [
    this.v0ApiVersion,
    this.v1ApiVersion,
    this.v1Dot1ApiVersion,
    this.internalApiVersion
  ],
  
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {
    const oThis = this
    ;

    await oThis._fetchParamsConfig();

    await oThis._validateMandatoryParams();

    await oThis._checkOptionalParams();

    return responseHelper.successWithData({sanitisedApiParams: oThis.sanitisedApiParams});
  },

  /**
   * Fetch Params Config for an API
   *
   * @private
   *
   * Sets oThis.paramsConfig
   *
   * @return {promise<result>}
   */
  _fetchParamsConfig: async function () {
    const oThis = this
    ;

    var versionConfig = {};

    if (oThis.apiVersion === oThis.v0ApiVersion) {
      versionConfig = v0Config;
    } else if (oThis.apiVersion === oThis.v1ApiVersion) {
      versionConfig = v1Config;
    } else if (oThis.apiVersion === oThis.v1Dot1ApiVersion) {
      versionConfig = v1Dot1Config;
    } else if (oThis.apiVersion === oThis.internalApiVersion) {
      versionConfig = internalConfig;
    } else {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_v_ap_2',
        api_error_identifier: 'invalid_api_version',
        debug_options: {}
      }));
    }

    oThis.paramsConfig = versionConfig[oThis.apiName];

    if (!oThis.paramsConfig) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_v_ap_3',
        api_error_identifier: 'invalid_api_name',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});

  },

  /**
   * Fetch Config for an API
   *
   * @private
   *
   * @return {result}
   */
  _validateMandatoryParams: async function () {
    const oThis = this
      , mandatoryKeys = oThis.paramsConfig.mandatory || []
      , paramErrors = []
    ;

    let hasError = false;

    for (let i = 0; i < mandatoryKeys.length; i++) {
      let whiteListedKeyData = mandatoryKeys[i]
          , whiteListedKey = whiteListedKeyData.parameter;

      if (oThis.apiParams.hasOwnProperty(whiteListedKey) && oThis.apiParams[whiteListedKey] !== undefined
        && oThis.apiParams[whiteListedKey] !== null) {

        oThis.sanitisedApiParams[whiteListedKey] = oThis.apiParams[whiteListedKey];
      } else {
        paramErrors.push(whiteListedKeyData.error_identifier);
        hasError = true;
      }
    }

    if (hasError) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'v_ap_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: paramErrors,
        error_config: basicHelper.fetchErrorConfig(oThis.apiVersion),
        debug_options: {}
      }));
    } else {
      return Promise.resolve(responseHelper.successWithData({}));
    }
  },

  /**
   * Check optional params
   *
   * @private
   *
   * @return {result}
   */
  _checkOptionalParams: async function () {

    const oThis = this
      , optionalKeys = oThis.paramsConfig.optional || []
    ;

    for (let i = 0; i < optionalKeys.length; i++) {
      let whiteListedKey = optionalKeys[i];
      if (oThis.apiParams.hasOwnProperty(whiteListedKey)) {
        oThis.sanitisedApiParams[whiteListedKey] = oThis.apiParams[whiteListedKey];
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = ApiParamsValidator;