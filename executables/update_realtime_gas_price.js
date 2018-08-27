'use strict';

/**
 *
 * Usage: node executables/update_realtime_gas_price.js 'process_id'
 *
 *
 */
const rootPrefix = '..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

const args = process.argv,
  processId = args[2];

ProcessLocker.canStartProcess({ process_title: 'update_realtime_gasprice-' + processId });

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price'),
  BigNumber = require('bignumber.js');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  valueChainGasPriceCacheKlass = require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path);

/**
 *
 * @constructor
 */
const UpdateRealTimeGasPrice = function() {
  const oThis = this;
};

UpdateRealTimeGasPrice.prototype = {
  perform: async function() {
    const oThis = this,
      instanceComposer = new InstanceComposer(configStrategy);

    let estimatedGasPriceFloat = 0,
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
      chainIdInternal = configStrategy.OST_VALUE_CHAIN_ID;
    let retrycount = 10;

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
      logger.info('Value chain gas price is set to:', gasPriceToBeSubmittedHex);
      return Promise.resolve(responseHelper.successWithData(gasPriceToBeSubmittedHex));
    }
    return Promise.resolve(responseHelper.successWithData({}));
  }
};

// perform action
const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();
UpdateRealTimeGasPriceObj.perform().then(async function(a) {
  setTimeout(function() {
    process.exit(0);
  }, 5000); //To kill the process after 10 seconds expecting that the cache will be set by then.
});
