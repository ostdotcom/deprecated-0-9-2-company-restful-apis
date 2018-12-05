'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  exchangeTradeDataConst = require(rootPrefix + '/lib/global_constant/exchange_trade_data');

const dbName = 'saas_analytics_' + coreConstants.ENVIRONMENT;

const ExchangeTradeDataModel = function() {
  const oThis = this;
  ModelBaseKlass.call(this, { dbName: dbName });
};

ExchangeTradeDataModel.prototype = Object.create(ModelBaseKlass.prototype);

const ExchangeTradeDataPrototype = {
  tableName: 'exchange_trade_data',

  exchanges: exchangeTradeDataConst.exchanges,

  invertedExchanges: exchangeTradeDataConst.invertedExchanges,

  tradingPairs: exchangeTradeDataConst.tradingPairs,

  invertedTradingPairs: exchangeTradeDataConst.invertedTradingPairs,

  enums: {
    exchanges: {
      val: exchangeTradeDataConst.exchanges,
      inverted: exchangeTradeDataConst.invertedExchanges
    },
    trading_pairs: {
      val: exchangeTradeDataConst.tradingPairs,
      inverted: exchangeTradeDataConst.invertedTradingPairs
    }
  }
};

Object.assign(ExchangeTradeDataModel.prototype, ExchangeTradeDataPrototype);

module.exports = ExchangeTradeDataModel;
