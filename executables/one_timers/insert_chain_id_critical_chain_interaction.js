'use strict';

/**
 * This script will enter chain ids in critical_chain_interaction_logs table.
 * Script uses VALUE and UTILITY chain ids from chain interaction constants from config
 *
 * Usage: node executables/one_timers/insert_chain_id_critical_chain_interaction.jsExample:
 *
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base');

const dbName = 'company_saas_shared_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const CriticalChainDefaultChainIdInsert = function() {
  const oThis = this;

  ModelBaseKlass.call(this, { dbName: dbName });
};

CriticalChainDefaultChainIdInsert.prototype = Object.create(ModelBaseKlass.prototype);

const CriticalChainDefaultChainIdInsertSpecificPrototype = {
  tableName: 'critical_chain_interaction_logs',

  insertHelper: async function(chainId, chainType) {
    const oThis = this;

    await oThis
      .update({ chain_id: chainId }, { touch: false })
      .where({ chain_type: chainType })
      .fire();
  },

  perform: async function() {
    let valueChainId = chainInteractionConstants.VALUE_CHAIN_ID,
      utilityChainId = chainInteractionConstants.UTILITY_CHAIN_ID,
      valueChainType = 1,
      utilityChainType = 2;

    if (valueChainId !== undefined || utilityChainId !== undefined) {
      await new CriticalChainDefaultChainIdInsert().insertHelper(valueChainId, valueChainType);

      await new CriticalChainDefaultChainIdInsert().insertHelper(utilityChainId, utilityChainType);
    } else {
      logger.error('utility chain id or value chain id is not defined.');
    }

    process.exit(0);
  }
};

Object.assign(CriticalChainDefaultChainIdInsert.prototype, CriticalChainDefaultChainIdInsertSpecificPrototype);

module.exports = CriticalChainDefaultChainIdInsert;
new CriticalChainDefaultChainIdInsert().perform();
