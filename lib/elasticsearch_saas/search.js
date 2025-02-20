'use strict';
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/search
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  DEFAULT_RESULT_SIZE = 50;

require(rootPrefix + '/lib/providers/es');

const EsSearchService = function(params) {
  const oThis = this;
  oThis.params = params || {};
};

EsSearchService.prototype = {
  constructor: EsSearchService,

  params: null,
  actionDescription: null,
  requestBody: null,
  requestSource: null,

  perform: function() {
    const oThis = this;
    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);

        return responseHelper.error({
          internal_error_identifier: 'l_es_s_es_s_p',
          api_error_identifier: 'unhandled_catch_response'
        });
      }
    });
  },

  asyncPerform: function() {
    const oThis = this,
      esProvider = oThis.ic().getEsProvider(),
      esClient = esProvider.getInstance();

    let actionDesc = {
      index: 'transaction_logs'
    };

    oThis.setActionDescription(actionDesc);

    if (oThis.params.queryBody) {
      oThis.setRequestBody(oThis.params.queryBody);
    }

    if (oThis.params.requestSource) {
      oThis.setRequestSource(oThis.params.requestSource);
    }

    let params;

    try {
      params = oThis.buildParams();
      return esClient
        .search(params)
        .then(function(clientResponse) {
          logger.win(`search Operation Successful and took ${clientResponse.took} ms`);
          logger.debug('params', params);
          logger.debug('search Operation clientResponse:', clientResponse);
          if (clientResponse.timed_out) {
            return responseHelper.error({
              internal_error_identifier: 'l_es_s_es_s_as_to',
              api_error_identifier: 'elasticsearch_api_timeout',
              debug_options: {
                error_details: clientResponse
              }
            });
          }
          try {
            oThis.formatSearchResponse(params, clientResponse);
          } catch (e) {
            logger.error(e);
          }
          return responseHelper.successWithData(oThis.formatSearchResponse(params, clientResponse));
        })
        .catch(function(clientError) {
          console.error('clientError', clientError);
          logger.error('search Operation Failed!');
          logger.debug('params', params);
          logger.debug('clientError', clientError);
          return responseHelper.error({
            internal_error_identifier: 'l_es_s_es_s_ap_c',
            api_error_identifier: 'elasticsearch_api_error',
            debug_options: {
              error_details: clientError
            }
          });
        });
    } catch (e) {
      console.error('error', e);
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_es_s_es_s_ap_in_p',
          api_error_identifier: ''
        })
      );
    }
  },

  buildParams: function() {
    const oThis = this,
      finalParams = Object.assign({}, oThis.actionDescription);

    oThis.requestBody.size = oThis.requestBody.size || DEFAULT_RESULT_SIZE;
    finalParams['body'] = oThis.requestBody;
    finalParams['_source'] = oThis.requestSource;

    return finalParams;
  },

  setActionDescription: function(actionDescription) {
    const oThis = this;
    // Map here.
    oThis.actionDescription = actionDescription;
  },

  setRequestSource: function(requestSource) {
    const oThis = this;
    if (requestSource instanceof Array && requestSource.length > 0) {
      oThis.requestSource = requestSource;
    }
  },

  setRequestBody: function(requestBody) {
    const oThis = this;
    oThis.requestBody = requestBody;
  },

  formatSearchResponse: function(params, response) {
    let hits1 = response.hits,
      total = hits1.total,
      hits2 = hits1.hits,
      next_page_payload = {},
      meta = {
        total_records: total,
        next_page_payload: next_page_payload,
        has_next_page: false
      },
      results = [],
      resultType = params.index,
      data = {
        meta: meta
      },
      paramsFrom = 0,
      paramsSize = hits2.length;

    if (params.body) {
      paramsFrom = params.body.from || 0;
      paramsSize = params.body.size || paramsSize;
    }

    //Format data
    data[resultType] = results;
    data['result_type'] = resultType;

    //See if we have next page.
    //E.g.
    //-- total = 25
    //-- So, last result index = 25 - 1 = 24
    //-- paramsSize = 10

    //-- if paramsFrom = 10
    //-- last search result index = 10 + 10 - 1 = 19
    // 24 > 19 = true (we have next page)

    //-- if paramsFrom = 15
    //-- last search result index = 10 + 15 - 1 = 24
    // 24 > 24 = false (we do not have next page).

    //-- if paramsFrom = 14
    //-- last search result index = 10 + 14 - 1 = 23
    // 24 > 23 = true (we have next page with 1 result)

    // So condition becomes:
    // (total - 1) > (paramsSize + paramsFrom - 1)
    // => total > paramsSize + paramsFrom

    if (total > paramsSize + paramsFrom) {
      // We have next page.
      meta.has_next_page = true;
      let query = {};
      if (params.body) {
        let requestBody = JSON.parse(JSON.stringify(params.body));
        Object.assign(next_page_payload, requestBody);
      }

      next_page_payload.from = paramsFrom + paramsSize;
      next_page_payload.size = paramsSize;
    }

    let len = hits2.length,
      cnt,
      record;

    for (cnt = 0; cnt < len; cnt++) {
      record = hits2[cnt];
      results.push(record._source);
    }

    return data;
  }
};

InstanceComposer.registerShadowableClass(EsSearchService, 'getEsSearchService');

module.exports = EsSearchService;
