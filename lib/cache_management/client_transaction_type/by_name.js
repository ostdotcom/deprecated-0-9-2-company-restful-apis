'use strict';

const rootPrefix = '../../..',
  cttBaseCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions');

const errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

/**
 * @constructor
 */
const clientTransactionTypeByNameCache = (module.exports = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.transactionKind = params['transaction_kind'];
  params['useObject'] = true;

  cttBaseCache.call(oThis, params);

  oThis.useObject = true;
});

clientTransactionTypeByNameCache.prototype = Object.create(cttBaseCache.prototype);

clientTransactionTypeByNameCache.prototype.constructor = clientTransactionTypeByNameCache;

/**
 * set cache key
 *
 * @return {string}
 */
clientTransactionTypeByNameCache.prototype.setCacheKey = function() {
  const oThis = this;

  oThis.cacheKey =
    oThis._cacheKeyPrefix() + 'ctt_by_name' + oThis.clientId + '_' + oThis.transactionKind.trim().replace(/ /g, '_');

  return oThis.cacheKey;
};

/**
 * fetch DB record
 *
 * @return {result}
 */
clientTransactionTypeByNameCache.prototype.fetchDbRecord = async function() {
  const oThis = this;

  let clientTransactionTypeRecords = await new ClientTransactionTypeModel().getTransactionByName({
    clientId: oThis.clientId,
    name: oThis.transactionKind
  });

  // error out if no record found
  if (!clientTransactionTypeRecords[0]) {
    return responseHelper.error({
      internal_error_identifier: 'cm_ctt_bn_1',
      api_error_identifier: 'invalid_transaction_type',
      debug_options: {},
      error_config: errorConfig
    });
  }

  return responseHelper.successWithData({ record: clientTransactionTypeRecords[0] });
};
