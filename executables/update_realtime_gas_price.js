'use strict';
/**
 * This script will update the gas price using ost-dynamic-gas-price package.
 * This fetches an estimated gas price for which Transaction could get mined in less than 5 minutes.
 * source: 'https://ethgasstation.info/txPoolReport.php'
 *
 * Usage: node executables/update_realtime_gas_price.js processLockId
 *
 * Command Line Parameters Description:
 * processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * Example: node executables/update_realtime_gas_price.js 12345
 *
 * @module executables/update_realtime_gas_price
 */

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price'),
  BigNumber = require('bignumber.js');

const rootPrefix = '..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  valueChainGasPriceCacheKlass = require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price'),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('Usage:', 'node executables/update_realtime_gas_price.js processLockId group_id');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

// Declare variables.
const args = process.argv,
  processLockId = args[2],
  cronKind = CronProcessesConstants.updateRealtimeGasPrice;

// Validate and sanitize the command line arguments.
if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

/**
 *
 * @constructor
 */
const UpdateRealTimeGasPrice = function() {
  const oThis = this;

  SigIntHandler.call(oThis, { id: processLockId });
};

UpdateRealTimeGasPrice.prototype = Object.create(SigIntHandler.prototype);

// Prototype for UpdateRealTimeGasPrice.
const UpdateRealTimeGasPricePrototype = {
  /**
   * Main performer for this class.
   *
   * @returns {Promise<any>}
   */
  perform: async function() {
    // Fetch configStrategy.
    const strategyByGroupHelperObj = new StrategyByGroupHelper(),
      configStrategyResp = await strategyByGroupHelperObj.getForKind(configStrategyConstants.value_geth);

    let chainIdInternal,
      configStrategy = configStrategyResp.data;
    for (let strategyId in configStrategy) {
      chainIdInternal = configStrategy[strategyId].OST_VALUE_CHAIN_ID;
    }

    // Declare variables.
    let estimatedGasPriceFloat = 0,
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
      retryCount = 10;

    while (retryCount > 0 && estimatedGasPriceFloat === 0) {
      estimatedGasPriceFloat = await dynamicGasPriceProvider.dynamicGasPrice.get(chainIdInternal);
      retryCount = retryCount - 1;
    }
    // All constants will be stored in Gwei.
    if (estimatedGasPriceFloat > 0) {
      let estimatedGasPrice = Math.ceil(estimatedGasPriceFloat),
        gasPriceToBeSubmittedHex = null,
        estimatedGasPriceBN = new BigNumber(estimatedGasPrice),
        estimatedGasPriceBNInWei = estimatedGasPriceBN.mul(1000000000);

      let minGasPriceBN = new BigNumber(coreConstants.MIN_VALUE_GAS_PRICE),
        maxGasPriceBN = new BigNumber(coreConstants.MAX_VALUE_GAS_PRICE),
        bufferGasBN = new BigNumber(coreConstants.BUFFER_VALUE_GAS_PRICE),
        gasPriceToBeSubmittedBN = estimatedGasPriceBNInWei.plus(bufferGasBN);

      if (gasPriceToBeSubmittedBN.lt(minGasPriceBN)) {
        gasPriceToBeSubmittedHex = '0x' + minGasPriceBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else if (gasPriceToBeSubmittedBN.lt(maxGasPriceBN)) {
        gasPriceToBeSubmittedHex = '0x' + gasPriceToBeSubmittedBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else {
        gasPriceToBeSubmittedHex = '0x' + maxGasPriceBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      }
      logger.info('Value chain gas price cache is set to:', gasPriceToBeSubmittedHex);
      return Promise.resolve(responseHelper.successWithData(gasPriceToBeSubmittedHex));
    }
    logger.info('Value chain gas price cache is not set');
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Returns a boolean which checks whether all the pending tasks are done or not.
   *
   * @returns {boolean}
   */
  pendingTasksDone: function() {
    return true;
  }
};

Object.assign(UpdateRealTimeGasPrice.prototype, UpdateRealTimeGasPricePrototype);

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(function() {
  // Perform action if cron can be started.
  const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();

  UpdateRealTimeGasPriceObj.perform().then(async function() {
    logger.info('Cron last run at: ', Date.now());
    setTimeout(function() {
      process.exit(0);
    }, 5000); //To kill the process after 5 seconds expecting that the cache will be set by then.
  });
});
