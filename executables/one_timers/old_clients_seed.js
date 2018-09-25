'use strict';

/**
 * This file is used to populate client_config_strategies table for old clients.
 *
 * Usage:  node executables/one_timers/old_clients_seed.js group_id
 *
 **/
const rootPrefix = '../..',
  clientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  clientConfigStrategy = require(rootPrefix + '/app/models/client_config_strategies'),
  configStartegyhelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  groupId = args[2];

const seedOldClients = function() {};

seedOldClients.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(error);
      process.exit(1);
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    await oThis.insertConfigMapping();
    logger.win('Success');
    process.exit(0);
  },

  /**
   * Fetches all the clientIds from Client Branded Token model.
   *
   * @returns {Promise<Array>}
   */
  fetchAllClientIds: async function() {
    let clientIds = [];
    const clientBrandedTokenModelObject = new clientBrandedTokenModel();
    let rawClientIds = await clientBrandedTokenModelObject.getAllClientIds();
    for (let i = 0; i < rawClientIds.length; i++) {
      clientIds.push(rawClientIds[i].client_id);
    }
    return clientIds;
  },

  /**
   * Inserts records for every client in client_config_strategies table.
   *
   * @returns {Promise<Array>}
   */
  insertConfigMapping: async function() {
    const oThis = this;

    let configStartegyHelper = new configStartegyhelperKlass(groupId),
      configStrategyIdsFetchRsp = await configStartegyHelper.getStrategyIds(),
      currentDateTime = new Date();

    logger.win('configStrategyIds', configStrategyIdsFetchRsp.toHash());

    let clientIds = await oThis.fetchAllClientIds(),
      fields = ['client_id', 'config_strategy_id', 'created_at', 'updated_at'];

    for (let i = 0; i < clientIds.length; i++) {
      let insertData = [],
        clientConfigStrategyObject = new clientConfigStrategy();

      for (let j = 0; j < configStrategyIdsFetchRsp.data.length; j++) {
        insertData.push([clientIds[i], configStrategyIdsFetchRsp.data[j], currentDateTime, currentDateTime]);
      }

      logger.win('insertMultiple Data', insertData);

      let r = await clientConfigStrategyObject.insertMultiple(fields, insertData).fire();

      logger.win('insertMultiple rsp', r);
    }
  }
};

new seedOldClients().perform().then();
