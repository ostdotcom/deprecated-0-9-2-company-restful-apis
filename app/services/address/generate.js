"use strict";

const uuid = require('uuid')
  , crypto = require('crypto')
  , openStPlatform = require('@openstfoundation/openst-platform')
;
const rootPrefix = '../../..'
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
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

  perform: async function(clientId, name){

    var oThis = this
      , name = name || ""
      , addrUuid = uuid.v4();

    const insertedRec = await managedAddressObj.create({client_id: clientId, name: name,
      uuid: addrUuid, status: 'active'});

    if(insertedRec.affectedRows > 0){
      oThis.updateAddress(insertedRec.insertId, clientId);
    }

    return responseHelper.successWithData(
      {
        id: insertedRec.insertId,
        uuid: addrUuid
      }
    );

  },

  updateAddress: async function(company_managed_address_id, clientId){

    var resp = await managedAddressObj.getDecryptedSalt(clientId);
    if(resp.isFailure()){
      return responseHelper.error("s_ad_g_1", "Client not setup.");
    }
    var infoSalt = resp.data.addressSalt;

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