"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ethBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ethBalance')
  , ostBalanceCacheKlass = require(rootPrefix + '/lib/cache_management/ostBalance')
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
const valueChainBalancesFetcherKlass = function (params) {

  const oThis = this;

  oThis.address = params['address'];
  oThis.clientId = params['client_id'];
  oThis.balanceTypes = params['balance_types'];

};

valueChainBalancesFetcherKlass.prototype = {

  /**
   * fetch data from source and return eth balance from VC in Wei
   *
   * @return {Result}
   */
  perform: async function () {

    const oThis = this
      , balanceTypes = oThis.balanceTypes;

    var promiseResolvers = []
      , balances = {};

    for (var i = 0; i < balanceTypes.length; i++) {

      if (oThis.supportedBalanceTypes().indexOf(balanceTypes[i]) >= 0) {

        var promise = oThis["_fetch" + balanceTypes[i] + "Balance"].apply(oThis);

      } else {

        var promise = Promise.resolve(responseHelper.error('b_f1_1', "unsupported balanceType: " + balanceTypes[i]));

      }

      promiseResolvers.push(promise);

    }

    const promiseResolverResponses = await Promise.all(promiseResolvers);

    for (var i = 0; i < balanceTypes.length; i++) {

      var balanceType = balanceTypes[i]
        , response = promiseResolverResponses[i]
        , balance = null;

      if (response.isFailure()) {
        logger.notify('b_f1_2', 'Something Went Wrong', response);
      } else {
        balances[balanceType] = basicHelper.convertToNormal(response.data);
      }

    }

    return Promise.resolve(responseHelper.successWithData(balances));

  },

  /**
   * balance types other then those of BT
   *
   * @return {Array}
   */
  supportedBalanceTypes: function () {
    return [
      'ost',
      'eth'
    ]
  },

  /**
   * fetch eth balance
   *
   * @return {Promise}
   */
  _fetchethBalance: function () {

    const oThis = this;

    const obj = new ethBalanceCacheKlass({'address': oThis.address});

    return obj.fetch();

  },

  /**
   * fetch OST balance
   *
   * @return {Promise}
   */
  _fetchostBalance: function () {

    const oThis = this;

    const obj = new ostBalanceCacheKlass({'address': oThis.address});

    return obj.fetch();

  }

};

module.exports = valueChainBalancesFetcherKlass;