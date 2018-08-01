'use strict';

const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiParamsValidator = require(rootPrefix + '/lib/validators/api_params'),
  ClientConfigStrategiesCache = require(rootPrefix + '/lib/cache_management/client_config_strategies'),
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
          logger.notify(errorCode, 'Something went wrong', error);

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

    let Klass = CallerKlassGetter.apply(instanceComposer);

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

    let configStrategy = {};

    let clientConfigStrategiesCache = new ClientConfigStrategiesCache({ client_id: client_id });

    let clientConfigStrategiesResponse = await clientConfigStrategiesCache.fetch();

    let strategy_ids = clientConfigStrategiesResponse.data;

    //TODO: Get strategy using ids from in-memory cache

    return {};
  }
};

module.exports = routeMethods;
