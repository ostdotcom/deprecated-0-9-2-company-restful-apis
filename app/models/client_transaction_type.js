"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const dbName = "saas_client_economy_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , kinds = {
    '1': clientTxTypesConst.userToUserKind,
    '2': clientTxTypesConst.userToCompanyKind,
    '3': clientTxTypesConst.companyToUserKind
  }
  , invertedKinds = util.invert(kinds)
  , currencyTypes = {
    '1': clientTxTypesConst.usdCurrencyType,
    '2': clientTxTypesConst.btCurrencyType
  }
  , invertedCurrencyTypes = util.invert(currencyTypes)
  , statuses = {'1': clientTxTypesConst.activeStatus, '2': clientTxTypesConst.inactiveStatus}
  , invertedStatuses = util.invert(statuses)
;

const ClientTransactionTypeModel = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

ClientTransactionTypeModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientTransactionTypeModelSpecificPrototype = {
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
    const oThis = this
      , return_result = []
    ;

    const query = oThis.select('*').where({client_id: params['clientId']});

    if(params && params.limit) query.limit(params.limit);
    if(params && params.offset) query.offset(params.offset);

    const results = await query.fire();
    for (var i = 0; i < results.length; i++) {
      return_result.push(oThis.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);
  },

  getTransactionById: function (params) {
    const oThis = this
    ;

    return oThis.select('*').where({id: params['clientTransactionId']}).fire();
  },

  getTransactionByName: function (params) {
    const oThis = this
    ;

    return oThis.select('*').where({client_id: params['clientId'], name: params['name']}).fire();
  },

  getCount: function (params) {
    const oThis = this
    ;

    return oThis.select('count(*) as cnt').where({client_id: params['clientId']}).fire();
  },

  getValue: function (record) {
    const oThis = this;
    if (oThis.currencyTypes[record.currency_type] == clientTxTypesConst.usdCurrencyType) {
      return record.value_in_usd;
    } else {
      return basicHelper.convertToNormal(record.value_in_bt_wei).toString(10);
    }
  }
};

Object.assign(ClientTransactionTypeModel.prototype, ClientTransactionTypeModelSpecificPrototype);

module.exports = ClientTransactionTypeModel;