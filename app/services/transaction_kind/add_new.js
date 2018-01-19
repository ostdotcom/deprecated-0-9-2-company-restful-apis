"use strict";

var rootPrefix = '../../..'
  , clientTransaction = require(rootPrefix + '/app/models/client_transaction')
  , responseHelper = require(rootPrefix + '/lib/formatter/response.js')
  , util = require(rootPrefix + '/lib/util')
;

const AddNew = function(params){

  this.params = params

};

AddNew.prototype = {

  constructor: AddNew,

  perform: async function () {
    var oThis = this
      , currentDateTime = util.formatDbDate(new Date())
      , client_id = oThis.params['client_id']
      , name = oThis.params['name']
      , kind = oThis.params['kind']
      , value_currency_type = oThis.params['value_currency_type']
      , value_in_usd = oThis.params['value_in_usd'] || -1
      , value_in_bt = oThis.params['value_in_bt'] || -1
      , commission_percent = oThis.params['commission_percent'] || 0
      , created_at = currentDateTime
      , updated_at = currentDateTime
    ;

    var result = await clientTransaction.create(
        {
          "fields": "client_id, name, kind, value_currency_type, value_in_usd, value_in_bt, commission_percent, created_at, updated_at",
          "values": [[client_id, name, kind, value_currency_type, value_in_usd, value_in_bt, commission_percent, created_at, updated_at]]
        }
        );
    return Promise.resolve(responseHelper.successWithData(result));
  }

};

module.exports = AddNew;
