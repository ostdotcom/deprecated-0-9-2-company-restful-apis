"use strict";

const rootPrefix = '../..'
  , baseCache = require(rootPrefix + '/lib/cache_management/base')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

/**
 * @constructor
 * @augments Client Transaction type caching
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientTransactionTypeCache = module.exports = function (params) {

  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.transactionKind = params['transaction_kind'];
  params['useObject'] = true;

  baseCache.call(this, params);

  oThis.useObject = true;

};

clientTransactionTypeCache.prototype = Object.create(baseCache.prototype);

clientTransactionTypeCache.prototype.constructor = clientTransactionTypeCache;

/**
 * set cache key
 *
 * @return {String}
 */
clientTransactionTypeCache.prototype.setCacheKey = function () {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "ctt_" + oThis.clientId + "_" + oThis.transactionKind.trim().replace(/ /g, "_");

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
clientTransactionTypeCache.prototype.setCacheExpiry = function () {

  const oThis = this;

  oThis.cacheExpiry = 3600; // 1 hour

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
clientTransactionTypeCache.prototype.fetchDataFromSource = async function () {
  const oThis = this
  ;

  let clientTransactionTypeRecords = await new ClientTransactionTypeModel()
    .getTransactionByName({clientId: oThis.clientId, name: oThis.transactionKind});

  // error out if no record found
  if (!clientTransactionTypeRecords[0]) {
    return responseHelper.error({
      internal_error_identifier: 'cm_ctt_1',
      api_error_identifier: 'invalid_transaction_type',
      debug_options: {error: error},
      error_config: errorConfig
    });
  }

  let clientTransactionTypeRecord = clientTransactionTypeRecords[0];

  let currencyTypeStrVal = new ClientTransactionTypeModel().currencyTypes[clientTransactionTypeRecord.currency_type];

  let isArbitraryAmount = (clientTransactionTypeRecord.value_in_bt_wei == null) &&
    (clientTransactionTypeRecord.value_in_usd == null);

  var currencyValue = null;
  if (!isArbitraryAmount) {
    currencyValue = (currencyTypeStrVal == clientTxTypesConst.btCurrencyType) ?
      basicHelper.formatWeiToString(basicHelper.convertToNormal(clientTransactionTypeRecord.value_in_bt_wei)) :
      clientTransactionTypeRecord.value_in_usd;
  }

  let isArbitraryCommissionPercent = (clientTransactionTypeRecord.commission_percent == null);

  let kind = new ClientTransactionTypeModel().kinds[clientTransactionTypeRecord.kind];

  let formattedData = {
    id: clientTransactionTypeRecord.id,
    name: clientTransactionTypeRecord.name,
    kind: kind,
    currency_type: currencyTypeStrVal,
    arbitrary_amount: isArbitraryAmount,
    currency_value: currencyValue,
    arbitrary_commission_percent: isArbitraryCommissionPercent,
    commission_percent: clientTransactionTypeRecord.commission_percent,
    status: new ClientTransactionTypeModel().statuses[clientTransactionTypeRecord.status]
  };

  return responseHelper.successWithData(formattedData);
};