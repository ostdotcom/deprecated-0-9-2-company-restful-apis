'use strict';

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  basicHelper = require(rootPrefix + '/helpers/basic');

require(rootPrefix + '/lib/providers/platform');

/**
 * constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 * @constructor
 */
const valueChainBalancesFetcherKlass = function(params) {
  const oThis = this;

  oThis.address = params['address'];
  oThis.clientId = params['client_id'];
  oThis.balanceTypes = params['balance_types'];
};

valueChainBalancesFetcherKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);

        return responseHelper.error({
          internal_error_identifier: 's_a_vcbf_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * fetch data from source and return eth balance from VC in Wei
   *
   * @return {Result}
   */
  asyncPerform: async function() {
    const oThis = this,
      balanceTypes = oThis.balanceTypes;

    var promiseResolvers = [],
      balances = {};

    for (var i = 0; i < balanceTypes.length; i++) {
      if (oThis.supportedBalanceTypes().indexOf(balanceTypes[i]) >= 0) {
        var promise = oThis['_fetch' + balanceTypes[i] + 'Balance'].apply(oThis);
      } else {
        var promise = Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 's_a_vcbf_2',
            api_error_identifier: 'unsupported_balance_type',
            debug_options: {}
          })
        );
      }

      promiseResolvers.push(promise);
    }

    const promiseResolverResponses = await Promise.all(promiseResolvers);

    for (var i = 0; i < balanceTypes.length; i++) {
      var balanceType = balanceTypes[i],
        response = promiseResolverResponses[i],
        balance = null;

      if (response.isFailure()) {
        notifier.notify('b_f1_2', 'Something Went Wrong', response, { clientId: oThis.clientId });
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
  supportedBalanceTypes: function() {
    return ['OST', 'eth'];
  },

  /**
   * fetch eth balance
   *
   * @return {Promise}
   */
  _fetchethBalance: function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    const obj = new openSTPlaform.services.balance.eth({ address: oThis.address });

    return obj.perform();
  },

  /**
   * fetch OST balance
   *
   * @return {Promise}
   */
  _fetchOSTBalance: function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    const obj = new openSTPlaform.services.balance.simpleToken({ address: oThis.address });

    return obj.perform();
  }
};

InstanceComposer.registerShadowableClass(valueChainBalancesFetcherKlass, 'getValueChainBalancesFetcherClass');

module.exports = valueChainBalancesFetcherKlass;
