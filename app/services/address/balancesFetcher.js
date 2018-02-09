"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ethBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ethBalance')
  , ostBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ostBalance')
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

  oThis.address = params['address'];
  oThis.erc20Address = params['erc20_address'];

};

balancesFetcherKlass.prototype = {

  /**
   * fetch data from source and return eth balance from VC in Wei
   *
   * @return {Result}
   */
  perform: async function(balanceTypes){

    const oThis = this;

    const validBalanceTypes = balanceTypes.filter(function(n) {
      return oThis._supportedBalanceTypes().indexOf(n) >= 0;
    });

    if (validBalanceTypes.length != balanceTypes.length) {
      r =  Promise.resolve(responseHelper.error(
        'bf_1', "invalid balanceTypes"
        )
      );
      logger.error(r);
      return r;
    }

    var promiseResolvers = []
        , balances = {};

    for (var i=0; i < balanceTypes.length; i++) {
      var promise = oThis["_fetch"+balanceTypes[i]+"Balance"].apply(oThis);
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

    return Promise.resolve(responseHelper.successWithData(balances));

  },

  /**
   * fetchsupported types
   *
   * @return {Array}
   */
  _supportedBalanceTypes: function() {
    return [
      'ost',
      'ostPrime',
      'brandedToken',
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
   * fetch BT balance
   *
   * @return {Promise}
   */
  _fetchbrandedTokenBalance: function(){

    const oThis = this;

    const obj = new openStPlatform.services.balance.brandedToken(
        {'address': oThis.address, 'erc20_address': oThis.erc20Address}
    );

    return obj.perform();

  }

}

module.exports = balancesFetcherKlass;