"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  ;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const ClientBrandedTokenKlass = function () {
  const oThis = this;

  ModelBaseKlass.call(this, {dbName: dbName});
};

ClientBrandedTokenKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientBrandedTokenKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_branded_tokens',

  enums: {},

  getById: function(id){
    const oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      "id=?",
      [id]);
  },

  getBySymbol: function(symbol){
    const oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      "symbol=?",
      [symbol]);
  },

  getByClientId: function(client_id){
    const oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      "client_id=?",
      [client_id],
      {
        order: 'id DESC'
      }
    );
  },

  getByClientIds: function(client_ids){
    const oThis = this;
    return oThis.QueryDB.readByInQuery(
        oThis.tableName,
        ['client_id','symbol'],
        client_ids,
        'client_id'
    );
  }

};

Object.assign(ClientBrandedTokenKlass.prototype, ClientBrandedTokenKlassPrototype);

module.exports = ClientBrandedTokenKlass;