"use strict";

var rootPrefix = '../../..'
  , clientTransaction = require(rootPrefix + '/app/models/client_transaction')
  , responseHelper = require(rootPrefix + '/lib/formatter/response.js')
;

const List = module.exports = function(params){

  this.params = params

};

List.prototype.perform = async function () {
  var oThis = this;
  var result = await clientTransaction.getAll({clientId: oThis.params.clientId});
  return Promise.resolve(responseHelper.successWithData(result));
};
