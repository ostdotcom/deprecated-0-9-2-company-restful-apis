'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  utils = require(rootPrefix + '/lib/util'),
  conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates');

const dbName = 'company_saas_shared_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  tableName = 'currency_conversion_rates',
  tableColumns = ['base_currency', 'quote_currency', 'conversion_rate', 'timestamp', 'transaction_hash', 'status'],
  statuses = {
    1: conversionRatesConst.active_status(),
    2: conversionRatesConst.inactive_status(),
    3: conversionRatesConst.inprocess_status()
  },
  invertedStatuses = utils.invert(statuses),
  baseCurrencies = {
    1: conversionRatesConst.ost_currency()
  },
  invertedBaseCurrencies = utils.invert(baseCurrencies),
  quoteCurrencies = {
    1: conversionRatesConst.usd_currency(),
    2: conversionRatesConst.eur_currency()
  },
  invertedQuoteCurrencies = utils.invert(quoteCurrencies);

const CurrencyConversionRateModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

CurrencyConversionRateModel.prototype = Object.create(ModelBaseKlass.prototype);

const CurrencyConversionRateModelSpecificPrototype = {
  tableName: tableName,

  // Define ENUM fields as constants
  status: statuses,

  invertedStatuses: invertedStatuses,

  base_currency: baseCurrencies,

  invertedBaseCurrencies: invertedBaseCurrencies,

  quote_currency: quoteCurrencies,

  invertedQuoteCurrencies: invertedQuoteCurrencies,

  // Update transaction hash for a record
  updateTransactionHash: function(id, transactionHash) {
    const oThis = this;

    return oThis
      .update({ transaction_hash: transactionHash })
      .where({ id: id })
      .fire();
  },

  // Update Status for a record
  updateStatus: function(id, status) {
    const oThis = this;

    // Check if inverted data is present in input then use enumValues key
    if (oThis.invertedStatuses[status]) {
      status = oThis.invertedStatuses[status];
    }

    return oThis
      .update({ status: status })
      .where({ id: id })
      .fire();
  },

  getLastActiveRates: function(currencyCode) {
    const oThis = this;

    return oThis
      .select('*')
      .where({
        quote_currency: utils.invert(oThis.quote_currency)[currencyCode],
        base_currency: utils.invert(oThis.base_currency)[conversionRatesConst.ost_currency()]
      })
      .limit(1)
      .order_by('timestamp DESC')
      .fire();
  }
};

Object.assign(CurrencyConversionRateModel.prototype, CurrencyConversionRateModelSpecificPrototype);

module.exports = CurrencyConversionRateModel;
