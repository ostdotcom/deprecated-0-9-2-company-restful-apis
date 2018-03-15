"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
    , clientTransactionTypeObj = new ClientTransactionTypeKlass()
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
    , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 * @constructor
 * @augments Client Transaction type caching
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientTransactionTypeCache = module.exports = function(params) {

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
clientTransactionTypeCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "ctt_" + oThis.clientId + "_" + oThis.transactionKind.trim().replace(/ /g, "_");

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
clientTransactionTypeCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 3600 // 1 hour ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
clientTransactionTypeCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  var dbRecord = await clientTransactionTypeObj.getTransactionByName({clientId: oThis.clientId, name: oThis.transactionKind});

  if(!dbRecord[0]) {
    return responseHelper.error("cm_ctt_1", "Not found");
  }

  var res = dbRecord[0];
  var currency_value = null;
  if(res.currency_type == clientTransactionTypeObj.invertedCurrencyTypes[clientTxTypesConst.btCurrencyType]){
    currency_value = basicHelper.formatWeiToString(basicHelper.convertToNormal(res.value_in_bt_wei));
  }else{
    currency_value = res.value_in_usd;
  }
  var data = {
    id: res.id,
    name: res.name,
    kind: clientTransactionTypeObj.kinds[res.kind],
    currency_type: clientTransactionTypeObj.currencyTypes[res.currency_type],
    currency_value: currency_value,
    commission_percent: res.commission_percent,
    status: clientTransactionTypeObj.statuses[res.status]
  };
  return responseHelper.successWithData(data);

};