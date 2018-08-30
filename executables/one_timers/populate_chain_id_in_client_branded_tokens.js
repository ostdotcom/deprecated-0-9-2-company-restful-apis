'use strict';

/**
 * This file is used to populate chain_id in table - client_branded_tokens for existing clients
 *
 * Usage:  node executables/one_timers/populate_chain_id_in_client_branded_tokens.js
 *
 *
 **/
const rootPrefix = '../..',
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy'),
  configStrategyHelperObj = new configStrategyHelper(),
  ClientBrandedTokensModel = require(rootPrefix + '/app/models/client_branded_token');

const PopulateChainId = function() {
  const oThis = this;
};

PopulateChainId.prototype = {
  perform: async function() {
    const oThis = this;

    let clientBrandedTokensModelObj = new ClientBrandedTokensModel();

    let rowData = await clientBrandedTokensModelObj.select('client_id').fire();

    let allPromises = [];

    let count = 0;

    for (let i = 0; i < rowData.length; i++) {
      let clientId = rowData[i].client_id;

      let response = await configStrategyHelperObj.getConfigStrategy(clientId);

      let config = response.data;

      clientBrandedTokensModelObj = new ClientBrandedTokensModel();
      allPromises.push(
        await clientBrandedTokensModelObj
          .update(['chain_id = ?', config.OST_UTILITY_CHAIN_ID])
          .where(['client_id = ?', clientId])
          .fire()
      );

      count++;

      if (count == 25) {
        await Promise.all(allPromises);
        allPromises = [];
        count = 0;
      }
    }

    if (allPromises.length > 0) {
      await Promise.all(allPromises);
    }

    return Promise.resolve({});
  }
};

let populateChainId = new PopulateChainId();

populateChainId.perform().then(function(r) {
  console.log('====Populated chain ids====');
  process.exit(0);
});
