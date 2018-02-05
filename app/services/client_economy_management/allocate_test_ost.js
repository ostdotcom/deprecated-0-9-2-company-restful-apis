"use strict";

/*
 * Allocate Test Ost For clients after sign-up
 * Test Ost would be granted only in ropsten env.
 *
 * * Author: Pankaj
 * * Date: 05/02/2018
 * * Reviewed by:
 */

var rootPrefix = '../../..'
  , clientToken = require(rootPrefix + '/app/models/client_token')
  , clientModel = require(rootPrefix + '/app/models/client')
  , clientChainInteraction = require(rootPrefix + '/app/models/client_chain_interaction')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const AllocateOst = function(params){

  this.clientId = params.client_id;
  this.clientTokenId = params.client_token_id;

};

AllocateOst.prototype = {

  constructor: AllocateOst,

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()){
      return r;
    }

    r = await oThis.validateLastOstGranted();
    if(r.isFailure()){
      return r;
    }

    var result = oThis.insertInDb();

    return responseHelper.successWithData({id: result.insertId, ethereum_address: oThis.eth_address});
  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.clientId
      , clientTokenId = oThis.clientTokenId
    ;

    if(!clientId || clientId==0 || !clientTokenId || clientTokenId == 0){
      return Promise.resolve(responseHelper.error('cem_ato_1', 'Mandatory params missing'));
    }

    var clientRecords = await clientModel.get(clientId);
    if (!clientRecords[0]) {
      return Promise.resolve(responseHelper.error("cem_ato_2", "Invalid client details."));
    }

    var clientTokenRecords = await clientToken.get(clientTokenId);
    if (!clientTokenRecords[0] || clientTokenRecords[0]["client_id"] != clientRecords[0]["id"]) {
      return Promise.resolve(responseHelper.error("cem_ato_3", "Invalid client token."));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  validateLastOstGranted: async function(){
    var oThis = this;

    var records = await clientChainInteraction.getClientInteractions(oThis.clientId);
    // If no records present then test ost can be given
    if (!records[0]) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    var ostGiven = 0;
    for(var i=0;i<records.length;i++){
      var record = records[i];
      // For a given client token, check whether test ost already given.
      if(record["client_token_id"] == oThis.clientTokenId && record["activity_type"] == clientChainInteraction.getRequestOstActivity()){
        // TODO:: Can put validation on ost granted within some duration.
        ostGiven = 1;
      }
    }

    if(ostGiven == 1){
      return Promise.resolve(responseHelper.error("cem_ato_4", "OST already granted."));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  insertInDb: async function(){
    var oThis = this;

    var record = await clientChainInteraction.create({client_id: oThis.clientId, client_token_id: oThis.clientTokenId,
            status: 'pending', chain_type: 'value', activity_type: 'request_ost'});
    return record;
  }

};

module.exports = AllocateOst;
