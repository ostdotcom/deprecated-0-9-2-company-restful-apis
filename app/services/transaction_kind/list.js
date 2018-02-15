"use strict";

var rootPrefix = '../../..'
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTransactionTypeObj = new ClientTransactionTypeKlass()
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

    var oThis = this
        , clientId = oThis.params.client_id;

    oThis.clientId = clientId;

    //TODO: handle pagination here
    oThis.apiResponse = {
      client_id: clientId,
      transaction_types: [],
      meta: {next_page_payload: {}},
      result_type: 'transaction_types'
      fiat_conversion_pankaj: 'pankaj se pucho', //TODO:
      client_token: 'cache karo' //TODO:
    }

  },

  getTransactionKinds: async function (oThis) {

    var result = await clientTransactionTypeObj.getAll({clientId: oThis.clientId});

    for (var i = 0; i < result.length; i++) {
      var res = result[i];

      oThis.apiResponse.transaction_types.push(
          {
            'id': res.id,
            'name': res.name,
            'kind': res.kind,
            'currency_type': res.currency_type,
            'value_in_usd': res.value_in_usd,
            'value_in_bt': res.value_in_bt,
            'value_in_bt_wei': res.value_in_bt,
            'commission_percent': res.commission_percent
          }
      );


    }
    return Promise.resolve();

  }

};

module.exports = List;
