'use strict';

/**
 * Set Worker for OpenSt Payments
 *
 * @module tools/setup/payments/set_worker
 */
const rootPrefix = '../../..';

require(rootPrefix + '/module_overrides/index');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  configStrategyFilePath = args[2],
  configStrategy = require(configStrategyFilePath),
  instanceComposer = new InstanceComposer(configStrategy),
  openStPayments = instanceComposer.getPaymentsProvider().getInstance();

require(rootPrefix + '/lib/providers/payments');

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
    const setWorkerKlass = openStPayments.services.workers.setWorkerAndOps;
    let setWorkerObj = new setWorkerKlass();
    var resp = await setWorkerObj.perform({
      gasPrice: configStrategy.UTILITY_GAS_PRICE,
      chainId: configStrategy.UTILITY_CHAIN_ID
    });

    logger.debug(' ********* Response *****');
    logger.debug(resp);
    process.exit(0);
  }
};

const setPaymentsWorker = new SetPaymentsWorkerKlass();
setPaymentsWorker.perform();
