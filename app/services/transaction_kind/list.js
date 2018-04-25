"use strict";

/**
 *
 * Return existing ransaction kind list.
 *
 * @module app/services/transaction_kind/edit
 */


var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
;

const List = function(params){

  var oThis = this;

  oThis.params = params;
  oThis.transactionTypes = [];
  oThis.clientTokens = [];

  oThis.allPromises = [];

};

List.prototype = {

  constructor: List,

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_tk_l_1", "Unhandled result", {}, {});
        }
      })
  },

  asyncPerform: async function() {
    var oThis = this;

    oThis.validateAssignParams();

    oThis.allPromises.push(oThis.getTransactionKinds());

    oThis.allPromises.push(oThis.getClientTokens());

    return await oThis.prepareApiResponse();

  },

  validateAssignParams: function(){

    var oThis = this;

    oThis.clientId = oThis.params.client_id;

  },

  getTransactionKinds: function () {

    var oThis = this;

    //TODO: Support pagination
    return new Promise(async function (onResolve, onReject) {

      const result = await new ClientTransactionTypeModel().getAll({clientId: oThis.clientId});

      var currency_value = null;

      for (var i = 0; i < result.length; i++) {
        var res = result[i];
        if(res.currency_type == clientTxTypesConst.btCurrencyType){
          currency_value = basicHelper.formatWeiToString(basicHelper.convertToNormal(res.value_in_bt_wei));
        }else{
          currency_value = res.value_in_usd;
        }
        oThis.transactionTypes.push(
          {
            id: res.id,
            client_transaction_id: res.id,
            name: res.name,
            kind: res.kind,
            currency_type: res.currency_type,
            currency_value: currency_value,
            commission_percent: res.commission_percent.toString(10),
            status: res.status
          }
        );
      }
      onResolve();

    });

  },

  getClientTokens: function(){

    const oThis = this;

    return new Promise(async function (onResolve, onReject) {

      const clientBrandedTokenCacheObj = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId});

      const clientBrandedTokenCacheResp = await clientBrandedTokenCacheObj.fetch();

      oThis.clientTokens = clientBrandedTokenCacheResp.data;

      onResolve();

    });

  },

  prepareApiResponse: async function () {

    const oThis = this;

    await Promise.all(oThis.allPromises);

    const ostPrices = await new ostPriceCacheKlass().fetch();

    return Promise.resolve(responseHelper.successWithData(
      {
        client_id: oThis.clientId,
        result_type: 'transaction_types',
        transaction_types: oThis.transactionTypes,
        meta: {next_page_payload: {}},
        price_points: ostPrices.data,
        client_tokens: oThis.clientTokens
      }
    ));
  }
};

module.exports = List;
