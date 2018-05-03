"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ClientBrandedTokenSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 * constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 * @constructor
 */
const UtilityChainBalancesFetcherKlass = function (params) {

  const oThis = this;

  oThis.addressUuid = params['address_uuid'];
  oThis.clientId = params['client_id'];
  oThis.balanceTypes = params['balance_types'];

  oThis.address = null;

};

UtilityChainBalancesFetcherKlass.prototype = {

  /**
   * fetch data from from UC in Wei
   *
   * @return {Result}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_a_ucbf_1", 'unhandled_catch_response', {});
        }
      });
  },

  /**
   * fetch data from from UC in Wei
   *
   * @return {Result}
   */
  asyncPerform: async function () {

    const oThis = this
      , balanceTypes = oThis.balanceTypes;

    const setAddrRsp = await oThis._setAddress();

    if (setAddrRsp.isFailure()) {
      return setAddrRsp;
    }

    var promiseResolvers = []
      , balances = {};

    for (var i = 0; i < balanceTypes.length; i++) {

      if (oThis._nonBrandedTokenBalanceTypes().indexOf(balanceTypes[i]) >= 0) {

        var promise = oThis["_fetch" + balanceTypes[i] + "Balance"].apply(oThis);

      } else {

        var promise = oThis._fetchBrandedTokenBalance(balanceTypes[i]);

      }

      promiseResolvers.push(promise);

    }

    const promiseResolverResponses = await Promise.all(promiseResolvers);

    for (var i = 0; i < balanceTypes.length; i++) {

      var balanceType = balanceTypes[i]
        , response = promiseResolverResponses[i]
        , balance = null;

      if (response.isFailure()) {
        logger.notify('ub_bf_1', 'Something Went Wrong', response, {clientId: oThis.clientId});
      } else {
        var data = response.data;
        if (data && data.balance) {
          balance = data.balance;
        } else {
          balance = data;
        }
        balances[balanceType] = basicHelper.convertToNormal(balance);
      }

    }

    return Promise.resolve(responseHelper.successWithData(balances));

  },

  /**
   * balance types other then those of BT
   *
   * @return {Array}
   */
  _nonBrandedTokenBalanceTypes: function () {
    return ['ostPrime']
  },

  /**
   * fetch OST Prime balance
   *
   * @return {Promise}
   */
  _fetchostPrimeBalance: function () {

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
  _fetchBrandedTokenBalance: async function (tokenSymbol) {

    const oThis = this
      , clientBrandedTokenSecureCacheObj = new ClientBrandedTokenSecureCacheKlass({tokenSymbol: tokenSymbol})
      , clientBrandedTokenSecureCacheRsp = await clientBrandedTokenSecureCacheObj.fetch();

    if (clientBrandedTokenSecureCacheRsp.isFailure()) {
      return Promise.resolve(clientBrandedTokenSecureCacheRsp);
    }

    const clientBrandedTokenSecureCacheData = clientBrandedTokenSecureCacheRsp.data;

    if (parseInt(clientBrandedTokenSecureCacheData.client_id) != parseInt(oThis.clientId)) {
      return Promise.resolve(responseHelper.error('s_a_ucbf_2', 'unauthorized_for_other_client', {}));
    }

    if (!clientBrandedTokenSecureCacheData.token_erc20_address) {
      return Promise.resolve(responseHelper.error('s_a_ucbf_3', 'token_contract_not_deployed', {}));
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
  _setAddress: async function () {

    const oThis = this;

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [oThis.addressUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();
    var response = cacheFetchResponse.data[oThis.addressUuid];

    if (cacheFetchResponse.isFailure() || !response) {
      return Promise.resolve(cacheFetchResponse);
    }

    oThis.address = response['ethereum_address'];

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = UtilityChainBalancesFetcherKlass;