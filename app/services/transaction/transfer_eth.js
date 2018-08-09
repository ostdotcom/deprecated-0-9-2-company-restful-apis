'use strict';

/*
*  Service for transferring eth to an ethereum address
*
* */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  BigNumber = require('bignumber.js');

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
const TransferEth = function(params) {
  const oThis = this;

  oThis.ethAddress = params.ethereum_address;
  oThis.amount = params.amount;
};

TransferEth.prototype = {
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
          internal_error_identifier: 's_t_te_1',
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
    const oThis = this,
      weiConversion = new BigNumber('1000000000000000000'),
      platform = oThis
        .ic()
        .getPlatformProvider()
        .getInstance();

    const obj = new platform.services.transaction.transfer.eth({
      sender_name: 'foundation',
      recipient_address: oThis.ethAddress,
      amount_in_wei: new BigNumber(oThis.amount).mul(weiConversion).toNumber(),
      options: { tag: '', returnType: 'txHash' }
    });

    let response = await obj.perform();

    if (response.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_te_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    return responseHelper.successWithData(response.data);
  }
};

InstanceComposer.registerShadowableClass(TransferEth, 'getTransferEthClass');
