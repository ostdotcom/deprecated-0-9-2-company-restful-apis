"use strict";

const uuid = require('uuid')
  , crypto = require('crypto')
  , openStPlatform = require('@openstfoundation/openst-platform')
;
const rootPrefix = '../../..'
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
  , AddressesEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
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

  updateInDb: async function(company_managed_address_id, eth_address, passphrase, clientId){
    var obj = new AddressesEncryptorKlass(clientId);
    var passPhraseEncr = await obj.encrypt(passphrase);
    if(!passPhraseEncr){
      return Promise.resolve(responseHelper.error("s_ad_g_1", "Error while generating user address."));
    }

    var updateQueryResponse = managedAddressObj.edit({
      qParams: {
        passphrase: passPhraseEncr,
        ethereum_address: eth_address
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

    return responseHelper.successWithData({
      result_type: "economy_users",
      'economy_users': [
        {
          id: insertedRec.insertId,
          uuid: addrUuid,
          name: name,
          total_airdropped_tokens: 0,
          token_balance: 0
        }
      ],
      meta: {
        next_page_payload: {}
      }
    });

  },

  updateAddress: async function(company_managed_address_id, clientId){

    var passphrase = _private.generatePassphrase();

    var r1 = await _private.callOpenST(passphrase);
    if(r1.isFailure()){
      return r1;
    }
    var eth_address = r1.data.address;

    await _private.updateInDb(company_managed_address_id, eth_address, passphrase, clientId);

    return responseHelper.successWithData({ethereum_address: eth_address});
  }

};

module.exports = generate;