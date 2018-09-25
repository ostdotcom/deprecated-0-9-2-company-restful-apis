'use strict';

const rootPrefix = '../../..',
  cttBaseCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const ClientTransactionTypeByIdCacheKlass = function(params) {
  const oThis = this;

  oThis.id = params['id'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  params['useObject'] = true;

  cttBaseCache.call(oThis, params);

  oThis.useObject = true;
};

ClientTransactionTypeByIdCacheKlass.prototype = Object.create(cttBaseCache.prototype);

const ClientTransactionTypeByIdCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {string}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'ctt_by_id' + oThis.id;

    return oThis.cacheKey;
  },

  /**
   * fetch DB record
   *
   * @return {result}
   */
  fetchDbRecord: async function() {
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

    return Promise.resolve(responseHelper.successWithData({ record: clientTransactionTypeRecords[0] }));
  }
};

Object.assign(ClientTransactionTypeByIdCacheKlass.prototype, ClientTransactionTypeByIdCacheKlassPrototype);

InstanceComposer.registerShadowableClass(ClientTransactionTypeByIdCacheKlass, 'getClientTransactionTypeByIdCache');

module.exports = ClientTransactionTypeByIdCacheKlass;
