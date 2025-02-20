'use strict';

const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiParamsValidator = require(rootPrefix + '/lib/validators/api_params'),
  ConfigStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const routeMethods = {
  performer: async function(req, res, next, CallerKlassGetter, errorCode, afterValidationFunc, dataFormatterFunc) {
    const oThis = this,
      errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    return oThis
      .asyncPerform(req, res, next, CallerKlassGetter, afterValidationFunc, dataFormatterFunc)
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)) {
          error.renderResponse(res, errorConfig);
        } else {
          notifier.notify(errorCode, 'Something went wrong', error);

          responseHelper
            .error({
              internal_error_identifier: errorCode,
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            })
            .renderResponse(res, errorConfig);
        }
      });
  },

  asyncPerform: async function(req, res, next, CallerKlassGetter, afterValidationFunc, dataFormatterFunc) {
    req.decodedParams = req.decodedParams || {};

    const oThis = this,
      errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    const apiParamsValidatorRsp = await new apiParamsValidator({
      api_name: req.decodedParams.apiName,
      api_version: req.decodedParams.apiVersion,
      api_params: req.decodedParams
    }).perform();

    req.serviceParams = apiParamsValidatorRsp.data.sanitisedApiParams;

    if (afterValidationFunc) {
      req.serviceParams = await afterValidationFunc(req.serviceParams);
    }

    // TODO: temp. remove in sometime
    logger.debug('req.serviceParams', req.serviceParams);
    logger.debug('req.decodedParams', req.decodedParams);

    var handleResponse = async function(response) {
      if (response.isSuccess() && dataFormatterFunc) {
        // if requires this function could reformat data as per API version requirements.
        await dataFormatterFunc(response);
      }

      response.renderResponse(res, errorConfig);
    };

    let configStrategy = await oThis._fetchConfigStrategy(req.serviceParams['client_id']);

    let instanceComposer = new InstanceComposer(configStrategy);

    let getterMethod = instanceComposer[CallerKlassGetter];
    let Klass = getterMethod.apply(instanceComposer);

    return new Klass(req.serviceParams).perform().then(handleResponse);
  },

  replaceKey: function(data, oldKey, newKey) {
    if (!data.hasOwnProperty(oldKey)) {
      return data;
    }

    const keyValue = data[oldKey];
    delete data[oldKey];
    data[newKey] = keyValue;

    return data;
  },

  _fetchConfigStrategy: async function(client_id) {
    const oThis = this;

    let configStrategyHelper = new ConfigStrategyHelper(client_id),
      configStrategyRsp = await configStrategyHelper.get();

    if (configStrategyRsp.isFailure()) {
      return Promise.reject(configStrategyRsp);
    }

    return configStrategyRsp.data;
  }
};

module.exports = routeMethods;
