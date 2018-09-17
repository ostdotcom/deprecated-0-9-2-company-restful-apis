'use strict';

/**
 * This file is used to populate client_config_strategies table for old clients.
 *
 * Usage:  node executables/one_timers/old_clients_seed.js
 *
 **/
const rootPrefix = '../..',
  clientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  clientConfigStrategy = require(rootPrefix + '/app/models/client_config_strategies'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

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

    await oThis.fetchAllClientIds();
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
    let configStrategyIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    let clientIds = await oThis.fetchAllClientIds();
    for (let i = 0; i < clientIds.length; i++) {
      for (let j = 0; j < configStrategyIds.length; j++) {
        const clientConfigStrategyObject = new clientConfigStrategy();
        let insertParams = { client_id: clientIds[i], config_strategy_id: parseInt(configStrategyIds[j]) };
        await clientConfigStrategyObject.insertRecord(insertParams);
      }
    }
  }
};

new seedOldClients().perform().then();
