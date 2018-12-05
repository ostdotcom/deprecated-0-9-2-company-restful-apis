'use strict';

/**
 * This script will populate entries for existing clients for nonce_memcached config stratey
 *
 * node executables/one_timers/associate_shared_strategy_for_existing_clients.js [1]
 */

const rootPrefix = '../..',
  clientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  configStrategyId = args[2];

function AssociateSharedStrategyForClients() {
  const oThis = this;
}

AssociateSharedStrategyForClients.prototype = {
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
          internal_error_identifier: 'e_ot_psna_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this,
      batchSize = 100,
      currentDateTime = new Date(),
      fields = ['client_id', 'config_strategy_id', 'created_at', 'updated_at'];

    let batchNo = 1;

    let _fetchClientIdsRsp = await oThis._fetchClientIds(),
      clientIds = _fetchClientIdsRsp.data;

    logger.debug('====allclientIds', clientIds);

    while (true) {
      const offset = (batchNo - 1) * batchSize,
        batchedClientIds = clientIds.slice(offset, batchSize + offset);

      batchNo = batchNo + 1;

      if (batchedClientIds.length === 0) {
        break;
      }

      logger.debug(`batch: ${batchNo}`, '====clientIds', batchedClientIds);

      let insertData = [],
        clientConfigStrategyObject = new ClientConfigStrategiesModel();

      for (let i = 0; i < batchedClientIds.length; i++) {
        insertData.push([batchedClientIds[i], configStrategyId, currentDateTime, currentDateTime]);
      }

      logger.win('insertMultiple Data', insertData);

      let r = await clientConfigStrategyObject.insertMultiple(fields, insertData).fire();

      logger.win('insertMultiple rsp', r);
    }
  },

  /**
   * Fetches distinct client ids
   *
   * @returns {Promise<any>}
   * @private
   */
  _fetchClientIds: async function() {
    const oThis = this;

    let dbRows = await new clientBrandedTokenModel().select('client_id').fire(),
      clientIds = [];

    for (let index in dbRows) {
      let dbRow = dbRows[index];
      clientIds.push(dbRow.client_id);
    }

    return Promise.resolve(responseHelper.successWithData(clientIds));
  }
};

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/one_timers/associate_shared_strategy_for_existing_clients.js 12');
};

const object = new AssociateSharedStrategyForClients();
object
  .perform()
  .then(function(a) {
    logger.log(JSON.stringify(a.toHash()));
    process.exit(0);
  })
  .catch(function(a) {
    logger.error(JSON.stringify(a));
    process.exit(1);
  });
