'use strict';
/**
 * This script will update the gas price using ost-dynamic-gas-price package.
 * This fetches an estimated gas price for which Transaction could get mined in less than 5 minutes.
 * source: 'https://ethgasstation.info/txPoolReport.php'
 *
 * Usage: node executables/update_realtime_gas_price.js processId configStrategyFilePath
 *
 * Command Line Parameters Description:
 * processId: process id to start the process
 * configStrategyFilePath: config strategy file to fetch VALUE chain_id
 *
 * Example: node executables/update_realtime_gas_price.js 12345 ~/config.js
 *
 * @module executables/update_realtime_gas_price
 */

const rootPrefix = '..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

const args = process.argv,
  processId = args[2],
  configStrategyFilePath = args[3];

ProcessLocker.canStartProcess({ process_title: 'update_realtime_gasprice-' + processId });

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price'),
  BigNumber = require('bignumber.js');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  valueChainGasPriceCacheKlass = require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price');

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log('usage:', 'node executables/update_realtime_gas_price.js processId configStrategyFilePath');
  logger.log(
    '* processId is used for ensuring that no other process with the same processId can run on a given machine.'
  );
  logger.log('* configStrategyFilePath is the path to the file which is storing the config strategy info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!processId) {
    logger.error('Process id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!configStrategyFilePath) {
    logger.error('Config strategy file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  configStrategy = require(configStrategyFilePath);
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 *
 * @constructor
 */
const UpdateRealTimeGasPrice = function() {
  const oThis = this;
};

UpdateRealTimeGasPrice.prototype = {
  perform: async function() {
    const oThis = this;

    let estimatedGasPriceFloat = 0,
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
      chainIdInternal = configStrategy.OST_VALUE_CHAIN_ID,
      retrycount = 10;

    while (retrycount > 0 && estimatedGasPriceFloat == 0) {
      estimatedGasPriceFloat = await dynamicGasPriceProvider.dynamicGasPrice.get(chainIdInternal);
      retrycount = retrycount - 1;
    }
    //All constants will be stored in gwei
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
  }
};

// perform action
const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();
UpdateRealTimeGasPriceObj.perform().then(async function(a) {
  logger.info('Cron last run at', Date.now());
  setTimeout(function() {
    process.exit(0);
  }, 5000); //To kill the process after 5 seconds expecting that the cache will be set by then.
});
