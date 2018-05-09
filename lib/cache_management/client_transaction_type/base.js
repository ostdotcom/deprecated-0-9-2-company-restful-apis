"use strict";

const rootPrefix = '../../..'
  , baseCache = require(rootPrefix + '/lib/cache_management/base')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 * @constructor
 *
 * @augments BaseCacheManagementKlass
 *
 * @param {object} params - cache key generation & expiry related params
 *
 */
const ClientTransactionTypeCacheBase = module.exports = function (params) {
  const oThis = this
  ;

  params['useObject'] = true;

  baseCache.call(oThis, params);

  oThis.useObject = true;
};

ClientTransactionTypeCacheBase.prototype = Object.create(baseCache.prototype);

ClientTransactionTypeCacheBase.prototype.constructor = ClientTransactionTypeCacheBase;

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {number}
 */
ClientTransactionTypeCacheBase.prototype.setCacheExpiry = function () {
  const oThis = this
  ;

  oThis.cacheExpiry = 3600; // 1 hour

  return oThis.cacheExpiry;
};

/**
 * fetch data from source
 *
 * @return {result}
 */
ClientTransactionTypeCacheBase.prototype.fetchDataFromSource = async function () {
  const oThis = this
  ;

  let fetchDbRecordResponse = await oThis.fetchDbRecord();
  if(fetchDbRecordResponse.isFailure()) return fetchDbRecordResponse;

  let clientTransactionTypeRecord = fetchDbRecordResponse.data.record;

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