'use strict';

/*
*  Service for transferring simple token to an ethereum address
*
* */

const BigNumber = require('bignumber.js');

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic');

require(rootPrefix + '/lib/providers/platform');

/**
 * Constructor
 *
 * @constructor
 *
 * @param {String Hex} params.ethereum_address - Ethereum address
 * @param {Integer} params.amount - amount
 *
 */
const TransferSimpleToken = function(params) {
  const oThis = this;

  oThis.ethAddress = params.ethereum_address;
  oThis.amount = params.amount;
};

TransferSimpleToken.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_t_tst_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (basicHelper.isMainSubEnvironment()) {
      let response = responseHelper.error({
        internal_error_identifier: 's_t_tst_1',
        api_error_identifier: 'grant_prohibited',
        debug_options: {}
      });

      return Promise.reject(response);
    }

    const weiConversion = new BigNumber('1000000000000000000'),
      platform = oThis
        .ic()
        .getPlatformProvider()
        .getInstance();

    const obj = new platform.services.transaction.transfer.simpleToken({
      sender_name: 'foundation',
      recipient_address: oThis.ethAddress,
      amount_in_wei: new BigNumber(oThis.amount).mul(weiConversion).toNumber(),
      options: { tag: '', returnType: 'txHash' }
    });

    let response = await obj.perform();

    if (response.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_tst_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    return responseHelper.successWithData(response.data);
  }
};

InstanceComposer.registerShadowableClass(TransferSimpleToken, 'getTransferSimpleTokenClass');
