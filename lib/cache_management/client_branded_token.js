'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientBrandedTokenCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['clientId'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(this, params);

  oThis.useObject = true;
};

ClientBrandedTokenCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientBrandedTokenCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'cbt_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours ;

    return oThis.cacheExpiry;
  },
  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      response = await new ClientBrandedTokenModel().getByClientId(oThis.clientId),
      tokenDetails = response[0];

    const formattedTokenDetails = {
      client_id: tokenDetails.client_id,
      name: tokenDetails.name,
      symbol: tokenDetails.symbol,
      symbol_icon: tokenDetails.symbol_icon,
      conversion_factor: tokenDetails.conversion_factor,
      token_erc20_address: tokenDetails.token_erc20_address,
      airdrop_contract_addr: tokenDetails.airdrop_contract_addr,
      simple_stake_contract_addr: tokenDetails.simple_stake_contract_addr,
      token_uuid: tokenDetails.token_uuid,
      reserve_managed_address_id: tokenDetails.reserve_managed_address_id,
      airdrop_holder_managed_address_id: tokenDetails.airdrop_holder_managed_address_id
    };

    return Promise.resolve(responseHelper.successWithData(formattedTokenDetails));
  }
};

Object.assign(ClientBrandedTokenCacheKlass.prototype, ClientBrandedTokenCacheKlassPrototype);

InstanceComposer.registerShadowableClass(ClientBrandedTokenCacheKlass, 'getClientBrandedTokenCache');

module.exports = ClientBrandedTokenCacheKlass;
