"use strict";

var rootPrefix = '../../..'
  , clientUserModel = require(rootPrefix + '/app/models/client_user')
  , clientModel = require(rootPrefix + '/app/models/client')
  , companyAddressModel = require(rootPrefix + '/app/models/company_managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , generateEthAddress = require('../generate_address')
;

const AddUser = function(params){

  this.clientId = params.client_id;
  this.name = params.name;

};

AddUser.prototype = {

  constructor: AddUser,

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()){
      return r;
    }

    var r1 = await generateEthAddress.perform(oThis.clientId);
    if(r1.isFailure()){
      return r1;
    }
    oThis.eth_address = r1.data.ethereum_address;

    var result = await oThis.insertUserInDb();

    return responseHelper.successWithData({id: result.insertId, ethereum_address: oThis.eth_address});
  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.clientId
      , name = oThis.name
    ;

    if(!clientId || clientId==0){
      return Promise.resolve(responseHelper.error('cum_cu_1', 'Mandatory params missing'));
    }

    var clientRecords = await clientModel.get(clientId);
    if (!clientRecords[0]) {
      return Promise.resolve(responseHelper.error("cum_cu_2", "Invalid client details."));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  insertUserInDb: async function(){
    var oThis = this;

    var records = await companyAddressModel.get(oThis.eth_address);
    if (!records[0]) {
      return Promise.resolve(responseHelper.error("cum_cu_3", "Ethereum address issue."));
    }
    var company_addr_id = records[0]["id"];

    return clientUserModel.create({client_id: oThis.clientId, name: oThis.name,
      company_managed_address_id: company_addr_id, status: "active"});
  }

};

module.exports = AddUser;
