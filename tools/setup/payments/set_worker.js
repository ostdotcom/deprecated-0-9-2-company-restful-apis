'use strict';

/**
 * Set Worker for OpenSt Payments
 *
 * @module tools/setup/payments/set_worker
 */
const rootPrefix = '../../..';
require(rootPrefix + '/module_overrides/index');

const PaymentsWorkerKlass = require(rootPrefix +
    '/node_modules/@openstfoundation/openst-payments/lib/set_worker_and_ops'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  chainConstants = require(rootPrefix + '/config/chain_interaction_constants');

/**
 * Set Worker for OpenSt Payments
 *
 * @constructor
 */
const SetPaymentsWorkerKlass = function() {};

SetPaymentsWorkerKlass.prototype = {
  /**
   * Set Worker contract
   *
   * @return {Promise<void>}
   */
  perform: async function() {
    const setWorkerObj = new PaymentsWorkerKlass();
    var resp = await setWorkerObj.perform({
      gasPrice: chainConstants.UTILITY_GAS_PRICE,
      chainId: chainConstants.UTILITY_CHAIN_ID
    });

    logger.debug(' ********* Response *****');
    logger.debug(resp);
    process.exit(0);
  }
};

const setPaymentsWorker = new SetPaymentsWorkerKlass();
setPaymentsWorker.perform();
