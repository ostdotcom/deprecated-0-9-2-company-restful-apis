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
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
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
   * supported api versions
   *
   * @constant
   */
  supportedApiVersions: [
    this.v0ApiVersion,
    this.v1ApiVersion
  ],

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error('l_v_ap_1', 'Unhandled result - inside catch block.', {}, {});
        }
      });
  },

  /**
   * Perform
   *
   * @return {result}
   */
  asyncPerform: async function () {
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
    } else {
      return Promise.reject(responseHelper.error('v_ap_1', 'Invalid API Version. API params config not found.'));
    }

    oThis.paramsConfig = versionConfig[oThis.apiName];

    if (!oThis.paramsConfig) {
      return Promise.reject(responseHelper.error('v_ap_2', 'Invalid API Name. Not found in the API params config.'));
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
      let whiteListedKey = mandatoryKeys[i];

      if (oThis.apiParams.hasOwnProperty(whiteListedKey)) {
        oThis.sanitisedApiParams[whiteListedKey] = oThis.apiParams[whiteListedKey];
      } else {
        paramErrors.push({
          name: whiteListedKey,
          code: '', // TODO: To add code & msg here from OST Core ?
          msg: ''
        });
        hasError = true;
      }
    }

    if (hasError) {
      return Promise.reject(responseHelper.paramValidationError('v_ap_3', paramErrors));
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