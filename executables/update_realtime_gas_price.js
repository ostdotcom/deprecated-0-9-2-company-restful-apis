"use strict";

const rootPrefix = '..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

const args = process.argv
  , processId = args[2];

ProcessLocker.canStartProcess({process_title: 'update_realtime_gasprice-'+processId});

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price'),
  BigNumber = require('bignumber.js');

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
      valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
      chainIdInternal = chainInteractionConstants.VALUE_CHAIN_ID;

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
        estimatedGasPriceBNInWei = estimatedGasPriceBN.mul(1000000000)
        ;

      let minGasPriceBN = new BigNumber(chainInteractionConstants.MIN_VALUE_GAS_PRICE),
        maxGasPriceBN = new BigNumber(chainInteractionConstants.MAX_VALUE_GAS_PRICE),
        bufferGasBN = new BigNumber(chainInteractionConstants.BUFFER_VALUE_GAS_PRICE),
        gasPriceToBeSubmittedBN = estimatedGasPriceBNInWei.plus(bufferGasBN);

      if (gasPriceToBeSubmittedBN.lt(minGasPriceBN)) {
        gasPriceToBeSubmittedHex = "0x" + minGasPriceBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else if (gasPriceToBeSubmittedBN.lt(maxGasPriceBN)) {
        gasPriceToBeSubmittedHex = "0x" + gasPriceToBeSubmittedBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      } else {
        gasPriceToBeSubmittedHex = "0x" + maxGasPriceBN.toString(16);
        valueChainGasPriceCacheObj._setCache(gasPriceToBeSubmittedHex);
      }

    }

  }
};

// perform action
const UpdateRealTimeGasPriceObj = new UpdateRealTimeGasPrice();
UpdateRealTimeGasPriceObj.perform();
