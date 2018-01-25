"use strict";

var rootPrefix = '../../..'
  , clientTransactionKind = require(rootPrefix + '/app/models/client_transaction')
  , responseHelper = require(rootPrefix + '/lib/formatter/response.js')
;

const List = function(params){

  this.params = params;

};

List.prototype = {

  constructor: List,

  perform: async function() {
    var oThis = this;

    oThis.validateAssignParams();

    await oThis.getTransactionKinds(oThis);

    return Promise.resolve(responseHelper.successWithData(oThis.apiResponse));
  },

  validateAssignParams: function(){

    var oThis = this;

    oThis.clientId = oThis.params.clientId;

    oThis.apiResponse = {
      client_id: oThis.params.clientId,
      transaction_kinds: []
    }

  },

  getTransactionKinds: async function (oThis) {
    var result = await clientTransactionKind.getAll({clientId: oThis.clientId});

    for (var i = 0; i < result.length; i++) {
      var res = result[i];

      oThis.apiResponse.transaction_kinds.push(
        {
          'name': res.name,
          'kind': res.kind,
          'value_currency_type': res.value_currency_type,
          'value_in_usd': res.value_in_usd,
          'value_in_bt': res.value_in_bt,
          'commission_percent': res.commission_percent
        }
      );

    }
    return Promise.resolve();

  }

};

module.exports = List;
