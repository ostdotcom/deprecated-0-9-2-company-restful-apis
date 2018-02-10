"use strict";

  const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , utils = require(rootPrefix + '/lib/util')
  , conversionRates = require(rootPrefix + '/lib/global_constant/conversion_rates')
  ;

  const dbName = "company_big_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'currency_conversion_rates'
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

  quote_currency: {1: conversionRates.usd_currency()
  },

  // Create new record in currency conversion rates table
  create: function (params) {

    var oThis = this
      , creatableFields = ['base_currency', 'quote_currency', 'conversion_rate', 'timestamp', 'transaction_hash', 'status']
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

  }

};

module.exports = currencyConversionRate;