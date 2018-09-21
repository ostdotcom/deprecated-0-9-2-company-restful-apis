'use strict';

/*
* This file is used to populate chain_geth_providers table.
*
* Usage: node executables/chain_geth_providers_seed.js [configFilePath]
*
* Command Line Parameters Description:
*
* configFilePath: Config strategy file path is necessary for seeding strategy in table.
*
*
* Example: node executables/chain_geth_providers_seed.js ~/config.json
*
* */

const rootPrefix = '..',
  ChainGethProviderModel = require(rootPrefix + '/app/models/chain_geth_providers'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

let env_list = process.argv[2] ? require(process.argv[2]) : process.env;

const usageDemo = function() {
  logger.log('usage:', 'node executables/chain_geth_providers_seed.js [configStrategyFilePath]');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!env_list) {
    logger.error('Config strategy file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const seedChainGethProviders = function() {};

seedChainGethProviders.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(error);
      process.exit(1);
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    await oThis.populateChainGethProviders();

    logger.log('Successfully seeded all chain geth providers parameters!! ');
    process.exit(0);
  },

  populateChainGethProviders: async function() {
    let promises = [],
      valueRpcProviders = env_list.OST_VALUE_GETH_RPC_PROVIDERS,
      valueWsProviders = env_list.OST_VALUE_GETH_WS_PROVIDERS,
      utilityRpcProviders = env_list.OST_UTILITY_GETH_RPC_PROVIDERS,
      utilityWsProviders = env_list.OST_UTILITY_GETH_WS_PROVIDERS;

    // Value Chain
    for (let i = 0; i < valueRpcProviders.length; i++) {
      promises.push(
        new ChainGethProviderModel().insertRecord({
          chain_id: parseInt(env_list.OST_VALUE_CHAIN_ID),
          chain_kind: 'value',
          ws_provider: valueWsProviders[i],
          rpc_provider: valueRpcProviders[i]
        })
      );
    }

    // Utility Chain
    for (let i = 0; i < utilityRpcProviders.length; i++) {
      promises.push(
        new ChainGethProviderModel().insertRecord({
          chain_id: parseInt(env_list.OST_UTILITY_CHAIN_ID),
          chain_kind: 'utility',
          ws_provider: utilityWsProviders[i],
          rpc_provider: utilityRpcProviders[i]
        })
      );
    }

    await Promise.all(promises);
  }
};

new seedChainGethProviders().perform().then();
