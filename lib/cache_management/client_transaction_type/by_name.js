'use strict';

const rootPrefix = '../../..',
  cttBaseCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 */
const ClientTransactionTypeByNameCacheKlass = (module.exports = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.transactionKind = params['transaction_kind'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  params['useObject'] = true;

  cttBaseCache.call(oThis, params);

  oThis.useObject = true;
});

ClientTransactionTypeByNameCacheKlass.prototype = Object.create(cttBaseCache.prototype);

const ClientTransactionTypeByNameCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {string}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey =
      oThis._cacheKeyPrefix() + 'ctt_by_name' + oThis.clientId + '_' + oThis.transactionKind.trim().replace(/ /g, '_');

    return oThis.cacheKey;
  },

  /**
   * fetch DB record
   *
   * @return {result}
   */
  fetchDbRecord: async function() {
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

    return Promise.resolve(responseHelper.successWithData({ record: clientTransactionTypeRecords[0] }));
  }
};

Object.assign(ClientTransactionTypeByNameCacheKlass.prototype, ClientTransactionTypeByNameCacheKlassPrototype);

InstanceComposer.registerShadowableClass(ClientTransactionTypeByNameCacheKlass, 'getClientTransactionTypeByNameCache');

module.exports = ClientTransactionTypeByNameCacheKlass;
