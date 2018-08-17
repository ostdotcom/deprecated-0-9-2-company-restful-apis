/**
 * This script will enter chain ids in critical_chain_interaction_logs table.
 * Usage: node executables/one_timers/insert_chain_id_critical_chain_interaction.js
 */

'use strict';
const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants'),
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
      .update({ chain_id: chainId }, false)
      .where({ chain_type: chainType })
      .fire();
  },

  perform: async function() {
    let chainId = chainInteractionConstants.VALUE_CHAIN_ID,
      chainType = 1;

    await new CriticalChainDefaultChainIdInsert().insertHelper(chainId, chainType);

    chainId = chainInteractionConstants.UTILITY_CHAIN_ID;
    chainType = 2;

    await new CriticalChainDefaultChainIdInsert().insertHelper(chainId, chainType);

    process.exit();
  }
};

Object.assign(CriticalChainDefaultChainIdInsert.prototype, CriticalChainDefaultChainIdInsertSpecificPrototype);

module.exports = CriticalChainDefaultChainIdInsert;
new CriticalChainDefaultChainIdInsert().perform();
