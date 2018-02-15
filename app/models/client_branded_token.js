"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  ;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const ClientBrandedTokenKlass = function () {};

ClientBrandedTokenKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientBrandedTokenKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_branded_tokens',

  enums: {},

  getBySymbol: function(symbol){
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      "symbol=?",
      [symbol]);
  },

  getByClientId: function(client_id){
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      ['id', 'client_id', 'symbol', 'reserve_managed_address_id', 'conversion_rate'],
      "client_id=?",
      [client_id],
      'order by id ASC'
    );
  }

};

Object.assign(ClientBrandedTokenKlass.prototype, ClientBrandedTokenKlassPrototype);

module.exports = ClientBrandedTokenKlass;