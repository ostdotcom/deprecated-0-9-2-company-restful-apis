'use strict';

const rootPrefix = '../../..',
  cttBaseCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions');

const errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const clientTransactionTypeByIdCache = (module.exports = function(params) {
  const oThis = this;

  oThis.id = params['id'];
  params['useObject'] = true;

  cttBaseCache.call(oThis, params);

  oThis.useObject = true;
});

clientTransactionTypeByIdCache.prototype = Object.create(cttBaseCache.prototype);

clientTransactionTypeByIdCache.prototype.constructor = clientTransactionTypeByIdCache;

/**
 * set cache key
 *
 * @return {string}
 */
clientTransactionTypeByIdCache.prototype.setCacheKey = function() {
  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + 'ctt_by_id' + oThis.id;

  return oThis.cacheKey;
};

/**
 * fetch DB record
 *
 * @return {result}
 */
clientTransactionTypeByIdCache.prototype.fetchDbRecord = async function() {
  const oThis = this;

  let clientTransactionTypeRecords = await new ClientTransactionTypeModel().getTransactionById({
    clientTransactionId: oThis.id
  });

  // error out if no record found
  if (!clientTransactionTypeRecords[0]) {
    return responseHelper.error({
      internal_error_identifier: 'cm_ctt_bi_1',
      api_error_identifier: 'invalid_transaction_type',
      debug_options: {},
      error_config: errorConfig
    });
  }

  return responseHelper.successWithData({ record: clientTransactionTypeRecords[0] });
};
