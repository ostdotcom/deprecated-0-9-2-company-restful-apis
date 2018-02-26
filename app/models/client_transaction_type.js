"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  ;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , kinds = {
    '1':clientTxTypesConst.userToUserKind,
    '2':clientTxTypesConst.userToCompanyKind,
    '3':clientTxTypesConst.companyToUserKind
  }
  , invertedKinds = util.invert(kinds)
  , currencyTypes = {
    '1':clientTxTypesConst.usdCurrencyType,
    '2':clientTxTypesConst.btCurrencyType
  }
  , invertedCurrencyTypes = util.invert(currencyTypes)
  , statuses = {'1':clientTxTypesConst.activeStatus, '2':clientTxTypesConst.inactiveStatus}
  , invertedStatuses = util.invert(statuses)
;

const ClientTransactionTypeKlass = function () {};

ClientTransactionTypeKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientTransactionTypeKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_transaction_types',

  kinds: kinds,

  invertedKinds: invertedKinds,

  currencyTypes: currencyTypes,

  invertedCurrencyTypes: invertedCurrencyTypes,

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    'kind': {
      val: kinds,
      inverted: invertedKinds
    },
    'currency_type': {
      val: currencyTypes,
      inverted: invertedCurrencyTypes
    },
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getAll: async function (params) {

    var oThis = this
      , return_result = []
    ;

    var results = await oThis.QueryDB.read(
      oThis.tableName,
      [],
      'client_id=?',
      [params['clientId']]
    );

    for(var i=0; i<results.length; i++){
      return_result.push(oThis.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);

  },

  getTransactionById: function (params) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'id=?', [params['clientTransactionId']]);
  },

  getTransactionByName: function (params) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'client_id=? AND name=?', [params['clientId'], params['name']]);
  },

  getCount: function (params) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, ['count(*) as cnt'], 'client_id=?', [params['clientId']]);
  }

};

Object.assign(ClientTransactionTypeKlass.prototype, ClientTransactionTypeKlassPrototype);

module.exports = ClientTransactionTypeKlass;