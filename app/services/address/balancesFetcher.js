"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ethBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ethBalance')
  , ostBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ostBalance')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_management/managedAddresses')
  , ClientBrandedTokenSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , logger = require(rootPrefix+'/lib/logger/custom_console_logger')
  , bigNumber = require('bignumber.js')
;

/**
 * constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 * @constructor
 */
const balancesFetcherKlass = function(params) {

  const oThis = this;

  oThis.addressUuid = params['addressUuid'];

  oThis.address = null;

};

balancesFetcherKlass.prototype = {

  /**
   * fetch data from source and return eth balance from VC in Wei
   *
   * @return {Result}
   */
  perform: async function(balanceTypes){

    const oThis = this;

    const setAddrRsp = await oThis._setAddress();

    if (setAddrRsp.isFailure()) {
      return setAddrRsp;
    }

    var promiseResolvers = []
        , balances = {};

    for (var i=0; i < balanceTypes.length; i++) {

      if (oThis._nonBrandedTokenBalanceTypes().indexOf(n) >= 0) {

        var promise = oThis["_fetch"+balanceTypes[i]+"Balance"].apply(oThis);

      } else {

        var promise = oThis._fetchBrandedTokenBalance(balanceTypes[i]);

      }

      promiseResolvers.push(promise);

    }

    const promiseResolverResponses = await Promise.all(promiseResolvers);

    for (var i=0; i < balanceTypes.length; i++) {

      var balanceType = balanceTypes[i]
          , response = promiseResolverResponses[i];

      if (response.isFailure()) {
        logger.error(response);
      } else {
        var data = response.data;
        if (data && data.balance) {
          balances[balanceType] = new bigNumber(data.balance);
        } else {
          balances[balanceType] = new bigNumber(data);
        }
      }

    }

    //TODO: append conversion rates here
    return Promise.resolve(responseHelper.successWithData({
      'balances': balances
    }));

  },

  /**
   * balance types other then those of BT
   *
   * @return {Array}
   */
  _nonBrandedTokenBalanceTypes: function() {
    return [
      'ost',
      'ostPrime',
      'eth'
    ]
  },

  /**
   * fetch eth balance
   *
   * @return {Promise}
   */
  _fetchethBalance: function(){

    const oThis = this;

    const obj = new ethBalanceCacheKlass({'address': oThis.address});

    return obj.fetch();

  },

  /**
   * fetch OST balance
   *
   * @return {Promise}
   */
  _fetchostBalance: function(){

    const oThis = this;

    const obj = new ostBalanceCacheKlass({'address': oThis.address});

    return obj.fetch();

  },

  /**
   * fetch OST Prime balance
   *
   * @return {Promise}
   */
  _fetchostPrimeBalance: function(){

    const oThis = this;

    const obj = new openStPlatform.services.balance.simpleTokenPrime({'address': oThis.address});

    return obj.perform();

  },

  /**
   * fetch BT balance for a given symbol
   *
   * @param {String} tokenSymbol
   *
   * @return {Promise}
   */
  _fetchBrandedTokenBalance: function(tokenSymbol){

    const oThis = this
        , clientBrandedTokenSecureCacheObj = new ClientBrandedTokenSecureCacheKlass({tokenSymbol: tokenSymbol})
        , clientBrandedTokenSecureCacheRsp = await clientBrandedTokenSecureCacheObj.fetch();

    if (clientBrandedTokenSecureCacheRsp.isFailure()) {
      return Promise.resolve(clientBrandedTokenSecureCacheRsp);
    }

    const clientBrandedTokenSecureCacheData = clientBrandedTokenSecureCacheRsp.data;

    if (!clientBrandedTokenSecureCacheData.token_erc20_address) {
      return Promise.resolve(responseHelper.error('bf_1','Token Contract Not Deployed'));
    }

    const obj = new openStPlatform.services.balance.brandedToken(
      {'address': oThis.address, 'erc20_address': clientBrandedTokenSecureCacheData.token_erc20_address}
    );

    return obj.perform();

  },

  /**
   * fetch address from uuid
   *
   * @return {Promise}
   */
  _setAddress: async function(){

    const oThis = this;

    const managedAddressCache = new ManagedAddressCacheKlass({'addressUuid': oThis.addressUuid });

    const cacheFetchResponse = await managedAddressCache.fetchDecryptedData(['ethereum_address']);

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(cacheFetchResponse);
    }

    oThis.address = cacheFetchResponse.data['ethereum_address_d'];

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

module.exports = balancesFetcherKlass;