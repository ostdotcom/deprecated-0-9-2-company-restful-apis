"use strict";

/*
  * Local Cipher to encrypt and decrypt client keys
  *
  * * Author: Pankaj
  * * Date: 18/01/2018
  * * Reviewed by:
*/

const crypto = require('crypto')
  , coreConstants = require('../../config/core_constants')
  , algorithm = "aes-256-cbc"
  , secretSplitter = "--";

const _private = {

  generateRandomIv: function(){
    var iv = new Buffer(crypto.randomBytes(16));
    return (iv.toString('hex').slice(0, 16));
  }

};

const localCipher = {

  encrypt: function(salt, string){
    var iv = _private.generateRandomIv();

    var encrypt = crypto.createCipheriv(algorithm, salt, iv);
    var theCipher = encrypt.update(string, 'utf8', 'base64');
    theCipher += encrypt.final('base64');

    theCipher += (secretSplitter + iv);
    return theCipher;

  },

  decrypt: function(salt, encryptedString){

    var ar = encryptedString.toString().split(secretSplitter),
      theCipher = ar[0],
      iv = ar[1];

    var decrypt = crypto.createDecipheriv(algorithm, salt, iv);
    var string = decrypt.update(theCipher, 'base64', 'utf8');
    string += decrypt.final('utf8');

    return string;

  },

  generateApiSignature: function(stringParams, clientSecret){
    var hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(stringParams);
    return hmac.digest('hex');
  },

  getHashedText: function(stringParams){
    return this.generateApiSignature(stringParams, coreConstants.GENERIC_SHA_KEY);
  }

};

module.exports = localCipher;