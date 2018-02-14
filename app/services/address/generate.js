"use strict";

const uuid = require('uuid')
  , crypto = require('crypto')
  , openStPlatform = require('@openstfoundation/openst-platform')
;
const rootPrefix = '../../..'
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , clientModel = require(rootPrefix + '/app/models/client')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
  , ManagedAddressSaltKlass = require(rootPrefix + '/app/models/managed_address_salt')
  , managedAddressSaltObj = new ManagedAddressSaltKlass()
;

const _private = {

  callOpenST: function(passphrase){

    const obj = new openStPlatform.services.utils.generateAddress(
        {'passphrase': passphrase, 'chain': 'utility'}
    );

    return obj.perform();

  },

  generatePassphrase: function(){
    var iv = new Buffer(crypto.randomBytes(16));
    return (iv.toString('hex').slice(0, 16));
  },

  fetchClientSalt: async function(clientId){
    var managedAddrSalts = await managedAddressSaltObj.getByClientId(clientId);
    if (!managedAddrSalts[0]) {
      return responseHelper.error("ga_fcs_1", "Invalid client details.");
    }

    var decryptedSalt = await kmsWrapper.decrypt(managedAddrSalts[0]["managed_address_salt"]);
    if(!decryptedSalt["Plaintext"]){
      return responseHelper.error("ga_fcs_2", "Client Salt invalid.");
    }

    return responseHelper.successWithData({info_salt: decryptedSalt["Plaintext"]});
  },

  updateInDb: async function(company_managed_address_id, eth_address, passphrase, salt){
    var encryptedPassphrase = await localCipher.encrypt(salt, passphrase);
    var encryptedEth = await localCipher.encrypt(salt, eth_address);
    var hashedEthAddress = await localCipher.getShaHashedText(eth_address);

    var updateQueryResponse = managedAddressObj.edit({
      qParams: {
        passphrase: encryptedPassphrase,
        ethereum_address: encryptedEth,
        hashed_ethereum_address: hashedEthAddress
      },
      whereCondition: {
        id: company_managed_address_id
      }
    });

    return updateQueryResponse;
  }

};

const generate = {

  perform: async function(clientId, addrUuid, saltPlainText){

    var oThis = this
      , addrUuid = addrUuid || uuid.v4();

    const insertedRec = await managedAddressObj.create({client_id: clientId, uuid: addrUuid, status: 'active'});

    if(insertedRec.affectedRows > 0){
      oThis.updateAddress(insertedRec.insertId, clientId, saltPlainText);
    }

    return responseHelper.successWithData(
      {
        id: insertedRec.insertId,
        uuid: addrUuid
      }
    );

  },

  updateAddress: async function(company_managed_address_id, clientId, infoSalt){

    if(!infoSalt){
      var r = await _private.fetchClientSalt(clientId);
      if(r.isFailure()){
        return r;
      }
      infoSalt = r.data.info_salt;
    }

    var passphrase = _private.generatePassphrase();

    var r1 = await _private.callOpenST(passphrase);
    if(r1.isFailure()){
      return r1;
    }
    var eth_address = r1.data.address;

    await _private.updateInDb(company_managed_address_id, eth_address, passphrase, infoSalt);

    return responseHelper.successWithData({ethereum_address: eth_address});
  }

};

module.exports = generate;