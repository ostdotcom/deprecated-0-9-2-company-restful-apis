'use strict';

const rootPrefix = '../../../';
require(rootPrefix + '/module_overrides/index');
require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/providers/price_oracle');
require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/formatter/response');

const byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
const oThis = this;

var ConfigStrategyOps = function(groupId) {
  oThis.groupId = groupId;
  if (oThis.groupId) {
    oThis.obj = new byGroupIdHelperKlass(oThis.groupId);
  } else {
    oThis.obj = new byGroupIdHelperKlass();
  }
};

ConfigStrategyOps.prototype = {
  updateConfigStrategy: async function(createdContractAddress, contractName, kind) {
    let configStrategyRsp = await oThis.obj.getForKind(kind);
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      let existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]],
        toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      if (existingData[contractName] == '') {
        toBeUpdatedData[contractName] = createdContractAddress;
        var updateRsp = null;
        updateRsp = await oThis.obj.updateForKind(kind, toBeUpdatedData, existingData);

        if (updateRsp.isFailure()) {
          console.error('updateRsp: ', updateRsp.toHash());
          return false;
        }
        return true;
      } else {
        console.log('Failure to update as there is already a value in config hash ');
        return false;
      }
    }
  },
  getConfigStrategy: async function(kind) {
    try {
      let configStrategyRsp = await oThis.obj.getForKind(kind);
      console.log('Value already exists in config strategy thus skipping for this kind ');
      return true;
    } catch {
      return false;
    }
  },

  insertConfigStrategy: async function(config_params, managed_address, kind) {
    console.log('inserting data');
    let insertRsp = await oThis.obj.addForKind(kind, config_params, managed_address);
    if (insertRsp.isFailure()) {
      console.error('insert failed with: ', insertRsp.toHash());
      return false;
    } else {
      console.log('inserted data in row: ');
      return true;
    }
  }
};
module.exports = ConfigStrategyOps;
