"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , crypto = require('crypto')
  , openStPlatform = require(coreConstants.OST_PLATFORM_PATH)
  , clientModel = require(rootPrefix + '/app/models/client')
  , companyAddressModel = require(rootPrefix + '/app/models/company_managed_address');

const _private = {

  callOpenST: function(passphrase){
    // handle final response
    const handleOpenStPlatformSuccess = function (ethereum_address) {
      return responseHelper.successWithData({ethereum_address: ethereum_address});
    };

    return openStPlatform.services.address.create("utility", passphrase).then(handleOpenStPlatformSuccess);
  },

  generatePassphrase: function(){
    var iv = new Buffer(crypto.randomBytes(16));
    return (iv.toString('hex').slice(0, 16));
  },

  fetchClientSalt: async function(clientId){
    var clientRecords = await clientModel.get(clientId);
    if (!clientRecords[0]) {
      return responseHelper.error("ga_fcs_1", "Invalid client details.");
    }

    var decryptedSalt = await kmsWrapper.decrypt(clientRecords[0]["info_salt"]);
    if(!decryptedSalt["Plaintext"]){
      return responseHelper.error("ga_fcs_2", "Client Salt invalid.");
    }

    return responseHelper.successWithData({info_salt: decryptedSalt["Plaintext"]});
  },

  insertInDb: async function(eth_address, passphrase, salt){
    var encryptedPassphrase = await localCipher.encrypt(salt, passphrase);
    var encryptedEth = await localCipher.encrypt(salt, eth_address);
    var hashedEthAddress = await localCipher.getShaHashedText(eth_address);

    var insertQueryResponse = companyAddressModel.create({passphrase: encryptedPassphrase, ethereum_address: encryptedEth,
      hashed_ethereum_address: hashedEthAddress});

    return Promise.resolve(insertQueryResponse);
  }

};

const generateAddress = {

  perform: async function(clientId){
    var r = await _private.fetchClientSalt(clientId);
    if(r.isFailure()){
      return r;
    }
    var infoSalt = r.data.info_salt;

    var passphrase = _private.generatePassphrase();

    var r1 = await _private.callOpenST(passphrase);
    if(r1.isFailure()){
      return r1;
    }
    var eth_address = r1.data.ethereum_address;

    await _private.insertInDb(eth_address, passphrase, infoSalt);

    return responseHelper.successWithData({ethereum_address: eth_address});
  }

};

module.exports = generateAddress;