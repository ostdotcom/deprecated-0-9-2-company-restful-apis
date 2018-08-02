"use strict";

/**
 * Fetch OST Current price in given currency from coin market cap and set in price oracle.
 *
 * @module services/conversion_rates/fetch_current_ost_price
 */

const request = require('request-promise')
  , OSTPriceOracle = require('@ostdotcom/ost-price-oracle')
  , BigNumber = require('bignumber.js')
;

const rootPrefix = "../../.."
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
  , CurrencyConversionRateModel = require(rootPrefix + "/app/models/currency_conversion_rate")
  , conversionRateConstants = require(rootPrefix + "/lib/global_constant/conversion_rates")
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
;

const priceOracle = OSTPriceOracle.priceOracle
  , exchangeUrl = "https://api.coinmarketcap.com/v1/ticker/simple-token"
  , gasPrice = chainInteractionConstants.UTILITY_GAS_PRICE
  , chainId = chainInteractionConstants.UTILITY_CHAIN_ID
;

/**
 * Fetch OST Current price
 *
 * @param {object} params -
 * @param {string} params.currency_code - Currency code to fetch price in. eg: (USD or EUR)
 *
 * @constructor
 */
const FetchCurrentOSTPriceKlass = function (params) {
  const oThis = this;

  oThis.quoteCurrency = params.currency_code || conversionRateConstants.usd_currency();
  oThis.currentTime = Math.floor((new Date).getTime() / 1000);
  oThis.currentOstValue = null;
};

FetchCurrentOSTPriceKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'f_c_o_p_7',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of kind Result
   */
  asyncPerform: async function () {
    const oThis = this;
    var url = exchangeUrl + "?convert=" + oThis.quoteCurrency;

    // Make Coinmarketcap api call
    var response = await request(url);

    // Parse Coinmarketcap api response
    oThis.parseResponse(response);

    if (!oThis.currentOstValue) {
      logger.notify(
        'f_c_o_p_1',
        'Invalid Response from CoinMarket',
        response
      );
      return;
    }

    // Insert current ost value in database
    const insertResponse = await new CurrencyConversionRateModel().insert({
      base_currency: new CurrencyConversionRateModel().invertedBaseCurrencies[oThis.currentOstValue.base_currency],
      quote_currency: new CurrencyConversionRateModel().invertedQuoteCurrencies[oThis.currentOstValue.quote_currency],
      conversion_rate: oThis.currentOstValue.conversion_rate,
      timestamp: oThis.currentTime,
      status: new CurrencyConversionRateModel().invertedStatuses[oThis.currentOstValue.status]
    }).fire();

    oThis.dbRowId = insertResponse.insertId;

    // Set current price in contract
    var contractResponse = await oThis.setPriceInContract();
    if (contractResponse.isFailure()) {
      logger.notify(
        'f_c_o_p_2',
        'Error while setting price in contract.',
        response
      );

      return;
    }
    var transactionHash = contractResponse.data.transactionHash;

    // Update transaction hash
    var updateTransactionResponse = await new CurrencyConversionRateModel().updateTransactionHash(oThis.dbRowId, transactionHash);
    logger.debug(updateTransactionResponse);

    //Keep on checking for a price in contract whether its set to new value.
    return oThis.compareContractPrice();

  },

  /**
   * Parse Response from coinmarketcap.<br><br>
   *
   * Sets currentOstValue
   */
  parseResponse: function (response) {
    const oThis = this;
    try {
      var ostValue = JSON.parse(response)[0];
      logger.debug("OST Value From CoinMarketCap:", ostValue);
      if (!ostValue || ostValue.symbol != conversionRateConstants.ost_currency()) {
        logger.notify(
          'f_c_o_p_3',
          'Invalid OST Value',
          response
        );

        return;
      }
      var pricePoint = ostValue["price_" + oThis.quoteCurrency.toLowerCase()];
      if (!pricePoint || pricePoint < 0) {
        logger.notify(
          'f_c_o_p_4',
          'Invalid OST Price',
          response
        );

        return;
      }
      oThis.currentOstValue = {
        base_currency: conversionRateConstants.ost_currency(),
        quote_currency: oThis.quoteCurrency,
        conversion_rate: pricePoint,
        timestamp: oThis.currentTime,
        status: conversionRateConstants.inprocess_status()
      };

      return;
    }
    catch (err) {
      logger.notify(
        'f_c_o_p_5',
        'Invalid Response from CoinMarket',
        response
      );

      return;
    }
  },


  /**
   * Set current price in Price oracle contract
   *
   * @return {Promise<Result>}
   */
  setPriceInContract: function () {
    const oThis = this;

    logger.debug("Price Input for contract:" + oThis.currentOstValue.conversion_rate);
    var num = new BigNumber(oThis.currentOstValue.conversion_rate);
    logger.debug("Quote Currency for contract:" + oThis.quoteCurrency);
    var priceResponse = priceOracle.fixedPointIntegerPrice(num.toNumber());
    if (priceResponse.isFailure()) {
      return Promise.resolve(priceResponse);
    }
    var amountInWei = priceResponse.data.price.toNumber();
    logger.debug("Price Point in Wei for contract:" + amountInWei);
    return priceOracle.setPrice(chainId, conversionRateConstants.ost_currency(), oThis.quoteCurrency,
      amountInWei, gasPrice);
  },


  /**
   * Compare price from coin market cap with contract price.
   *
   * @return {Promise<any>}
   */
  compareContractPrice: function () {
    const oThis = this
      , quoteCurrency = oThis.quoteCurrency
      , conversionRate = oThis.currentOstValue.conversion_rate
      , dbRowId = oThis.dbRowId;

    return new Promise(function (onResolve, onReject) {
      var loopCompareContractPrice = async function () {
        var priceInDecimal = await priceOracle.decimalPrice(chainId, conversionRateConstants.ost_currency(), quoteCurrency);
        if (priceInDecimal.isFailure()) {
          logger.notify(
            'f_c_o_p_6',
            'Error while getting price from contract.',
            priceInDecimal
          );

          return onResolve('error');
        } else if (priceInDecimal.isSuccess() && priceInDecimal.data.price == conversionRate) {
          await new CurrencyConversionRateModel().updateStatus(dbRowId, conversionRateConstants.active_status());
          new ostPriceCacheKlass().clear();
          logger.win("Price point updated in contract.");
          return onResolve('success');
        } else {
          logger.step(`dbRowId: ${dbRowId} price received from contract: ${priceInDecimal.data.price} but expected was: ${conversionRate}. Waiting for it to match.`);
          return setTimeout(loopCompareContractPrice, 10000);
        }
      };

      loopCompareContractPrice();
    });
  }

};

module.exports = FetchCurrentOSTPriceKlass;
