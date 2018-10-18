'use strict';

const rootPrefix = '../../..',
  baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const DummySubclassKlass = function(params) {
  const oThis = this;

  oThis.lockId = Math.floor(new Date().getTime());

  baseKlass.call(oThis, params);
};

DummySubclassKlass.prototype = Object.create(baseKlass.prototype);

const DummySubclassKlassPrototype = {
  execute: function() {
    //Things cron to execute
    return {};
  },

  getLockId: function() {
    const oThis = this;
    return parseFloat(oThis.lockId + '.' + oThis.processId);
  },

  getLockableModel: function() {
    return TransactionMetaModel;
  },

  getQuery: function() {
    return ['status = 1'];
  },

  getNoOfRowsToProcess: function() {
    const oThis = this;

    return oThis.noOfRowsToProcess || 10;
  }
};

Object.assign(DummySubclassKlass.prototype, DummySubclassKlassPrototype);

InstanceComposer.registerShadowableClass(DummySubclassKlass, 'getDummySubclassKlass');

module.exports = DummySubclassKlass;
