'use strict';
/**
 * This script will update the gas price using ost-dynamic-gas-price package.
 * This fetches an estimated gas price for which Transaction could get mined in less than 5 minutes.
 * source: 'https://ethgasstation.info/txPoolReport.php'
 *
 * Usage: node executables/update_realtime_gas_price.js processId group_id
 *
 * Command Line Parameters Description:
 * processId: process id to start the process
 * group_id: group id for fetching config strategy
 *
 * Example: node executables/update_realtime_gas_price.js 12345 1000
 *
 * @module executables/update_realtime_gas_price
 */

const rootPrefix = '..',
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  CronProcessHandlerObject = new CronProcessesHandler();

const args = process.argv,
  processId = args[2],
  group_id = args[3];

// Usage demo.
const usageDemo = function() {
  logger.log('usage:', 'node executables/update_realtime_gas_price.js processId group_id');
  logger.log(
    '* processId is used for ensuring that no other process with the same processId can run on a given machine.'
  );
  logger.log('* group_id is needed for fetching config strategy');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!processId) {
    logger.error('Process id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

// Declare variables.
const cronKind = CronProcessesConstants.updateRealtimeGasPrice;

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processId, // Implicit string to int conversion.
  cron_kind: cronKind
});

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price'),
  BigNumber = require('bignumber.js');

const coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  valueChainGasPriceCacheKlass = require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price');

let configStrategy = {};

/**
 *
 * @constructor
 */
const UpdateRealTimeGasPrice = function() {
  const oThis = this;

  SigIntHandler.call(oThis, { id: processId });
};

UpdateRealTimeGasPrice.prototype = Object.create(SigIntHandler.prototype);

UpdateRealTimeGasPrice.prototype = {
  /**
   * Main performer for this class.
   *
   * @returns {Promise<any>}
   */
  perform: async function() {
    // Fetch configStrategy.
    const strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash();

    configStrategy = configStrategyResp.data;

    // Declare variables.
    let estimatedGasPriceFloat = 0,
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
      chainIdInternal = configStrategy.OST_VALUE_CHAIN_ID,
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

// Perform action.
const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();
UpdateRealTimeGasPriceObj.perform().then(async function() {
  logger.info('Cron last run at', Date.now());
  setTimeout(function() {
    process.exit(0);
  }, 5000); //To kill the process after 5 seconds expecting that the cache will be set by then.
});
