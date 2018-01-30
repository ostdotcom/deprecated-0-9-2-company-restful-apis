"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , openStPlatform = require(coreConstants.OST_PLATFORM_PATH);

const generateEthAddress = {

  callOpenST: function(passphrase){
    // handle final response
    const handleOpenStPlatformSuccess = function (ethereum_address) {
      return responseHelper.successWithData({ethereum_address: ethereum_address});
    };

    return openStPlatform.services.address.create("utility", passphrase).then(handleOpenStPlatformSuccess);
  },

  perform: async function(passphrase){
    var r1 = await this.callOpenST(passphrase);
    if(r1.isFailure()){
      return r1;
    }
    var eth_address = r1.data.ethereum_address;
    var hashedEthAddress = await localCipher.getHashedText(eth_address.toLowerCase());

    return responseHelper.successWithData({ethereum_address: eth_address,
      hashed_ethereum_address: hashedEthAddress});
  }

};

module.exports = generateEthAddress;