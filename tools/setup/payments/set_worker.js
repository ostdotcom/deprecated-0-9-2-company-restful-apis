'use strict';

/**
 * Set Worker for OpenSt Payments
 *
 * @module tools/setup/payments/set_worker
 */
const rootPrefix = '../../..';

require(rootPrefix + '/module_overrides/index');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/payments');

const args = process.argv,
  group_id = args[2];

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
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data;

    let instanceComposer = new InstanceComposer(configStrategy),
      openStPayments = instanceComposer.getPaymentsProvider().getInstance();

    const setWorkerKlass = openStPayments.services.workers.deployWorkersAndSetOps;

    let setWorkerObj = new setWorkerKlass();

    var resp = await setWorkerObj.perform({
      gasPrice: configStrategy.OST_UTILITY_GAS_PRICE,
      chainId: configStrategy.OST_UTILITY_CHAIN_ID
    });

    logger.debug(' ********* Response *****');
    logger.debug(resp);

    process.exit(0);
  }
};

const setPaymentsWorker = new SetPaymentsWorkerKlass();
setPaymentsWorker.perform();
