"use strict";

  const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , utils = require(rootPrefix + '/lib/util')
  , conversionRates = require(rootPrefix + '/lib/global_constant/conversion_rates')
  ;

  const dbName = "company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'currency_conversion_rates'
  , tableColumns = ['base_currency', 'quote_currency', 'conversion_rate', 'timestamp', 'transaction_hash', 'status']
  ;


/*
* Public methods
*/

const currencyConversionRate = {

  // Define ENUM fields as constants
  status: {1: conversionRates.active_status(),
    2: conversionRates.inactive_status(),
    3: conversionRates.inprocess_status()
  },

  base_currency: {1: conversionRates.ost_currency()
  },

  quote_currency: {1: conversionRates.usd_currency(),
    2: conversionRates.eur_currency()
  },

  // Create new record in currency conversion rates table
  create: function (params) {

    var oThis = this
      , creatableFields = tableColumns
      , createFields = []
      , setFieldsValues = []
    ;

    for(var i=0; i<creatableFields.length; i++){
      var column = creatableFields[i];
      if(params[column]){
        createFields.push(column);

        // Check if field is an enum field then get its number value to insert
        if(oThis[column]){
          var enumValues = oThis[column];
          // Check if inverted data is present in input then use enumValues key
          var invertedEnumValues = utils.invert(enumValues);
          if(invertedEnumValues[params[column]]){
            params[column] = invertedEnumValues[params[column]];
          }
        }
        setFieldsValues.push(params[column])
      }
    }

    return QueryDB.insert(
      tableName,
      createFields,
      setFieldsValues
    );

  },

  // Update transaction hash for a record
  updateTransactionHash: function(id, transactionHash){
    return QueryDB.edit(
      tableName,
      ['transaction_hash = ?'],
      [transactionHash],
      ['id=?'],
      [id]
    );
  },

  // Update Status for a record
  updateStatus: function(id, status){
    var oThis = this;
    // Check if inverted data is present in input then use enumValues key
    var invertedStatus = utils.invert(oThis.status);
    if(invertedStatus[status]){
      status = invertedStatus[status];
    }
    return QueryDB.edit(
      tableName,
      ['status = ?'],
      [status],
      ['id=?'],
      [id]
    );
  },

  getLastActiveRates: function(currencyCode){
    var oThis = this;
    return QueryDB.read(
      tableName,
      [],
      'quote_currency=? and base_currency=?',
      [utils.invert(oThis.quote_currency)[currencyCode], utils.invert(oThis.base_currency)[conversionRates.ost_currency()]],
      {limit: 1, order: 'timestamp desc'});
  }

};

module.exports = currencyConversionRate;