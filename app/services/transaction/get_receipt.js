'use strict';

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/lib/providers/platform');

/**
 * Fetch Transaction Receipt from Transaction Hash
 *
 * @module services/transaction/get_receipt
 */
const GetReceiptKlass = function(params) {
  const oThis = this;

  oThis.transactionHash = params.transaction_hash;
  oThis.chain = params.chain;
  oThis.addressToNameMap = params.address_to_name_map || {};
};

/**
 * Fetch Transaction Receipt for the given transaction Hash
 *
 * @param {object} params - this is object with keys.
 *                  transaction_hash - Transaction Hash to fetch data for.
 *                  chain - Chain name to look at (eg: utility or value)
 *
 * @constructor
 */
GetReceiptKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);

        return responseHelper.error({
          internal_error_identifier: 's_t_gr_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this,
      openStPlatformProvider = oThis.ic().getPlatformProvider(),
      openStPlatform = openStPlatformProvider.getInstance(),
      GetReceiptKlass = openStPlatform.services.transaction.getReceipt;

    const obj = new GetReceiptKlass({
      transaction_hash: oThis.transactionHash,
      chain: oThis.chain,
      address_to_name_map: oThis.addressToNameMap
    });

    const response = await obj.perform();
    if (response.isSuccess()) {
      return Promise.resolve(responseHelper.successWithData(response.data));
    } else {
      return Promise.resolve(response);
    }
  }
};

InstanceComposer.registerShadowableClass(GetReceiptKlass, 'getGetReceiptKlass');
module.exports = GetReceiptKlass;
