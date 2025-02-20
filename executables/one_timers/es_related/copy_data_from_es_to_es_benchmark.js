'use strict';

const BigNumber = require('bignumber.js');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  elasticSearchLibManifest = require(rootPrefix + '/lib/elasticsearch/manifest'),
  esSearchServiceObject = elasticSearchLibManifest.services.transactionLog,
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  transactionLogModel = require(rootPrefix + '/app/models/transaction_log');

function CopyDataFromEsToEsBenchmark(params) {
  const oThis = this;

  oThis.startTimestamp = params['start_timestamp'];
  oThis.batchNumber = 1;
  oThis.lastProcessedCreatedAt = null;
}

CopyDataFromEsToEsBenchmark.prototype = {
  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'es_r_cdfeteb_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._fetchRecordsFromEs();

    return Promise.resolve(
      responseHelper.successWithData({
        lastProcessedCreatedAt: oThis.lastProcessedCreatedAt
      })
    );
  },

  _fetchRecordsFromEs: async function(query) {
    const oThis = this;

    logger.step('starting batchNo: ', oThis.batchNumber);

    query = query || oThis._getQueryParams();

    logger.debug('search query', query);

    let searchRsp = await esSearchServiceObject.search(query);

    let searchRspData = searchRsp.data;

    logger.win('search response received for batchNo: ', oThis.batchNumber);
    logger.debug(searchRspData);

    await oThis._processBatchOfItems(searchRspData[searchRspData.result_type]);

    if (searchRsp.success && searchRsp.data.meta.has_next_page) {
      oThis.batchNumber += 1;

      query['query'] = {
        range: {
          created_at: {
            gte: oThis.lastProcessedCreatedAt
          }
        }
      };

      return oThis._fetchRecordsFromEs(query);
    }
  },

  /**
   * process batch of items returned by DDB
   *
   * @returns {promise}
   */
  _processBatchOfItems: async function(items) {
    const oThis = this;

    let dataToInsert = [],
      localLastProcessedCreatedAt = null;

    logger.step('Preparing Data for ES');

    for (let i = 0; i < items.length; i++) {
      let esData = items[i];
      if (esData['status'] === new transactionLogModel().invertedStatuses[transactionLogConst.waitingForMiningStatus]) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'es_r_cdfeteb_2',
            api_error_identifier: 'data_not_found',
            debug_options: esData
          })
        );
      }
      localLastProcessedCreatedAt = esData['created_at'];
      dataToInsert.push(oThis._convertEsDataToDdbData(esData));
    }

    logger.step('Inserting Data in ES');

    let insertRsp = await esSearchServiceObject.bulk('INSERT', dataToInsert);

    if (insertRsp.isFailure()) {
      return Promise.reject(insertRsp);
    }

    oThis.lastProcessedCreatedAt = localLastProcessedCreatedAt;

    logger.step('oThis.lastProcessedCreatedAt', oThis.lastProcessedCreatedAt);
  },

  _convertEsDataToDdbData: function(esData) {
    const oThis = this;

    logger.debug(esData);

    let ddbData = {
      tt: { N: esData['type'] },
      txu: { S: esData['id'] },
      ci: { N: esData['client_id'] },
      ua: { N: esData['updated_at'] },
      s: { N: esData['status'] },
      ca: { N: esData['created_at'] }
    };

    if (esData['action_id']) {
      ddbData['ai'] = { N: esData['action_id'] };
    }

    if (esData['transaction_hash']) {
      ddbData['txh'] = { S: esData['transaction_hash'] };
    }

    if (esData['from_uuid']) {
      ddbData['fu'] = { S: esData['from_uuid'] };
    }

    if (esData['to_uuid']) {
      ddbData['tu'] = { S: esData['to_uuid'] };
    }

    if (esData['from_address']) {
      ddbData['fa'] = { S: esData['from_address'] };
    }

    if (esData['to_address']) {
      ddbData['ta'] = { S: esData['to_address'] };
    }

    if (esData['commission_amount_in_base_currency']) {
      ddbData['caiw'] = { N: basicHelper.convertToWei(esData['commission_amount_in_base_currency']) };
    }

    if (esData['amount_in_base_currency']) {
      ddbData['aiw'] = { N: basicHelper.convertToWei(esData['amount_in_base_currency']) };
    }

    logger.debug(ddbData);

    return ddbData;
  },

  _getQueryParams: function() {
    const oThis = this;

    let queryParams = {
      from: 0,
      size: 5000,
      sort: [{ created_at: 'asc' }]
    };

    if (commonValidator.isVarInteger(oThis.startTimestamp)) {
      queryParams['query'] = {
        range: {
          created_at: {
            gte: oThis.startTimestamp
          }
        }
      };
    } else {
      queryParams['query'] = {
        match_all: {}
      };
    }

    return queryParams;
  }
};

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/es_related/copy_data_from_es_to_es_benchmark.js startTimestamp');
};

const args = process.argv,
  startTimestamp = parseInt(args[2]);

const object = new CopyDataFromEsToEsBenchmark({ start_timestamp: startTimestamp });
object
  .perform()
  .then(function(a) {
    logger.debug(JSON.stringify(a.toHash()));
    process.exit(0);
  })
  .catch(function(a) {
    console.error(JSON.stringify(a));
    process.exit(1);
  });
