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

  getById: function(id){
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      "id=?",
      [id]);
  },

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
      [],
      "client_id=?",
      [client_id],
      'order by id DESC'
    );
  }

};

Object.assign(ClientBrandedTokenKlass.prototype, ClientBrandedTokenKlassPrototype);

module.exports = ClientBrandedTokenKlass;