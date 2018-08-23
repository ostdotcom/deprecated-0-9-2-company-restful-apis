"use strict";

const rootPrefix = '..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

const args = process.argv
  , processId = args[2];

ProcessLocker.canStartProcess({process_title: 'update_realtime_gasprice-'+processId});

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price');

const chainInteractionConstants = require(rootPrefix+'/config/chain_interaction_constants'),
  valueChainGasPriceCacheKlass= require(rootPrefix + '/lib/cache_management/estimate_value_chain_gas_price');

/**
 *
 * @constructor
 */
const UpdateRealTimeGasPrice = function () {
  const oThis = this;
};

UpdateRealTimeGasPrice.prototype = {
  perform: async function() {
    const oThis = this;
    let estimatedGasPriceFloat = 0,
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass();

    let retrycount = 10;
    while (retrycount > 0 && estimatedGasPriceFloat == 0) {
      estimatedGasPriceFloat = await dynamicGasPriceProvider.dynamicGasPrice.get(1);
      retrycount = retrycount - 1;
    }

    if (estimatedGasPriceFloat > 0) {

      let estimatedGasPrice = Math.ceil(estimatedGasPriceFloat),
        gasPriceToBeSubmittedHex = null;


      let minGasPrice = parseInt(chainInteractionConstants.MIN_VALUE_GAS_PRICE),
        maxGasPrice = parseInt(chainInteractionConstants.MAX_VALUE_GAS_PRICE),
        bufferGas = parseInt(chainInteractionConstants.BUFFER_VALUE_GAS_PRICE),
        gasPriceToBeSubmittedInt = estimatedGasPrice + bufferGas;
      if (gasPriceToBeSubmittedInt < minGasPrice) {
        gasPriceToBeSubmittedHex = "0x" + minGasPrice.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else if (gasPriceToBeSubmittedInt < maxGasPrice) {
        gasPriceToBeSubmittedHex = "0x" + gasPriceToBeSubmittedInt.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else {
        gasPriceToBeSubmittedHex = "0x" + maxGasPrice.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      }
    }
  }
};

// perform action
const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();
UpdateRealTimeGasPriceObj.perform();
