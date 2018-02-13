"use strict";

const uuid = require('uuid')
;

const rootPrefix = '../../..'
  , clientUserModel = require(rootPrefix + '/app/models/client_user')
  , clientModel = require(rootPrefix + '/app/models/client')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , generateEthAddress = require('../address/generate')
;

const AddUser = function(params){

  this.clientId = params.client_id;
  this.name = params.name;

};

AddUser.prototype = {

  constructor: AddUser,

  perform: async function () {
    const oThis = this
    ;

    oThis.addrUuid = uuid.v4();

    var r = null;

    r = await oThis.validateParams();
    if(r.isFailure()){
      return r;
    }

    var r1 = await generateEthAddress.saveUuid(oThis.clientId, oThis.addrUuid);
    if(r1.isFailure()){
      return r1;
    }
    oThis.company_managed_address_id = r1.data.id;

    var result = await oThis.insertUserInDb();

    return responseHelper.successWithData({
      'result_type': 'client_users',
      'client_users': [{
        id: result.insertId,
        uuid: oThis.addrUuid,
        name: oThis.name,
        client_id: oThis.clientId
      }]
    });

  },

  perform2: async function () {
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

  insertUserInDb: function(){
    var oThis = this;

    return clientUserModel.create({client_id: oThis.clientId, name: oThis.name,
      company_managed_address_id: oThis.company_managed_address_id, status: "active"});
  }

};

module.exports = AddUser;
