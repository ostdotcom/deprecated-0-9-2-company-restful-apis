"use strict";

var rootPrefix = '../../..'
  , clientUserModel = require(rootPrefix + '/app/models/client_user')
  , clientModel = require(rootPrefix + '/app/models/client')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , crypto = require('crypto')
  , generateEthAddress = require('../generate_ethereum_address')
;

const _private = {

  generatePassphrase: function(){
    var iv = new Buffer(crypto.randomBytes(16));
    return (iv.toString('hex').slice(0, 16));
  }

};

const AddUser = function(params){

  this.clientId = params.client_id;
  this.name = params.name;
  this.passphrase = _private.generatePassphrase();
  this.infoSalt = null;
  this.eth_address = null;
  this.hashedEthAddress = null;

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

    var r1 = await generateEthAddress.perform(oThis.passphrase);
    if(r1.isFailure()){
      return r1;
    }
    oThis.eth_address = r1.data.ethereum_address;
    oThis.hashedEthAddress = r1.data.hashed_ethereum_address;

    var result = await oThis.insertUserInDb();

    return Promise.resolve(responseHelper.successWithData(result));
  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.clientId
      , name = oThis.name
    ;

    if(!clientId || clientId==0 || !name){
      return Promise.resolve(responseHelper.error('cum_cu_1', 'Mandatory params missing'));
    }

    //TODO: check if any characters to be blocked
    if(!name){
      return Promise.resolve(responseHelper.error('cum_cu_2', 'Invalid name'));
    }

    var clientRecords = await clientModel.get(clientId);
    if (!clientRecords[0]) {
      return Promise.resolve(responseHelper.error("cum_cu_3", "Invalid client details."));
    }

    var decryptedSalt = await kmsWrapper.decrypt(clientRecords[0]["info_salt"]);
    if(!decryptedSalt["Plaintext"]){
      return Promise.resolve(responseHelper.error("cum_cu_4", "Client Salt invalid."));
    }
    oThis.infoSalt = decryptedSalt["Plaintext"];

    return Promise.resolve(responseHelper.successWithData({}));

  },

  insertUserInDb: async function(){
    var oThis = this;

    var encryptedPassphrase = await localCipher.encrypt(oThis.infoSalt, oThis.passphrase);
    var encryptedEth = await localCipher.encrypt(oThis.infoSalt, oThis.eth_address);

    return clientUserModel.create({client_id: oThis.clientId, name: oThis.name,
      passphrase: encryptedPassphrase, ethereum_address: encryptedEth,
      hashed_ethereum_address: oThis.hashedEthAddress, status: "active"});
  }

};

module.exports = AddUser;
