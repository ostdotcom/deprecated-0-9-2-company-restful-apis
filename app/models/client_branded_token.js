"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_client_economy_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
;

const ClientBrandedTokenModel = function () {
  const oThis = this
  ;

  ModelBaseKlass.call(oThis, {dbName: dbName});
};

ClientBrandedTokenModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientBrandedTokenModelSpecificPrototype = {
  tableName: 'client_branded_tokens',

  enums: {},

  getById: function (id) {
    const oThis = this
    ;

    return oThis.select('*').where({id: id}).fire();
  },

  getBySymbol: function (symbol) {
    const oThis = this
    ;

    return oThis.select('*').where({symbol: symbol}).fire();
  },

  getByClientId: function (clientId) {
    const oThis = this
    ;

    return oThis.select('*').where({client_id: clientId}).order_by('id DESC').fire();
  },

  getByClientIds: function (clientIds) {
    const oThis = this
    ;

    return oThis.select(['client_id', 'symbol'])
      .where(['client_id IN (?)', clientIds])
      .fire();
  }
};

Object.assign(ClientBrandedTokenModel.prototype, ClientBrandedTokenModelSpecificPrototype);

module.exports = ClientBrandedTokenModel;