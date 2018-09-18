'use strict';

const rootPrefix = '..',
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy');

const ConfigStrategyByGroupId = function(groupId) {
  const oThis = this;

  oThis.groupId = groupId;
};

ConfigStrategyByGroupId.prototype = {
  // {
  //
  // }
  get: function() {
    const oThis = this,
      groupId = oThis.groupId;

    let finalHash = {};

    return finalHash;
  },

  // returns Hash
  // {
  //    1: {
  //        }
  // }
  getForKind: function(kind) {
    const oThis = this;

    oThis.groupId;
  },

  //clear cache after every update and create
  addForKind: function(kind, params) {},

  updateForKind: function(kind, params, old_data) {},

  getAllKinds: function() {
    let kindsHash = configStrategyConstants.kinds,
      kindsArray = Object.values(kindsHash);

    return kindsArray;
  }
};

module.exports = new ConfigStrategyByGroupId();
