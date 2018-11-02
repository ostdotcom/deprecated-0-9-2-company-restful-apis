'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  exchangeTradeDataConst = require(rootPrefix + '/lib/global_constant/exchange_trade_data');

const dbName = 'saas_analytics_' + coreConstants.ENVIRONMENT,
  exchanges = { '1': exchangeTradeDataConst.binanceExchange },
  invertedExchanges = util.invert(exchanges),
  tradingPairs = {
    '1': exchangeTradeDataConst.OstEthTradingPair,
    '2': exchangeTradeDataConst.OstBtcTradingPair
  },
  invertedTradingPairs = util.invert(tradingPairs);

const ExchangeTradeDataModel = function() {
  const oThis = this;
  ModelBaseKlass.call(this, { dbName: dbName });
};

ExchangeTradeDataModel.prototype = Object.create(ModelBaseKlass.prototype);

const ExchangeTradeDataPrototype = {
  tableName: 'exchange_trade_data',

  exchanges: exchanges,

  invertedStatuses: invertedExchanges,

  addressTypes: tradingPairs,

  invertedAddressTypes: invertedTradingPairs,

  enums: {
    exchanges: {
      val: exchanges,
      inverted: invertedExchanges
    },
    trading_pairs: {
      val: tradingPairs,
      inverted: invertedTradingPairs
    }
  }
};

Object.assign(ExchangeTradeDataModel.prototype, ExchangeTradeDataPrototype);

module.exports = ExchangeTradeDataModel;
