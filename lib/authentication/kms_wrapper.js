"use strict";
/*
 * Wrapper for AWS KMS
 *
 * * Author: Pankaj
 * * Date: 16/01/2018
 * * Reviewed by:
 */
const coreConstants = require('../../config/core_constants')
    , AWS = require('aws-sdk');

const kmsWrapper = {

  // Load AWS credentials
  loadAWSCredentials: function(){
    AWS.config.loadFromPath('./config/aws_config.json');
  },

  // Encrypt Data
  encrypt: function(data){
    this.loadAWSCredentials();
    var kms = new AWS.KMS();
    var params = {
      KeyId: coreConstants.KMS_INFO_ID,
      Plaintext: data
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.encrypt(params, function (err, encryptedData) {
          if(err){
            onReject(err);
          } else {
            onResolve(encryptedData);
          }
        })
      }
    );
  },

  // Decrypt Data
  decrypt: function(encryptedString){
    this.loadAWSCredentials();
    var kms = new AWS.KMS();
    var params = {
      CiphertextBlob: encryptedString
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.decrypt(params, function (err, decryptedData) {
          if(err){
            onReject(err);
          } else {
            onResolve(decryptedData);
          }
        })
      }
    );
  }

};

module.exports = kmsWrapper;

//
// var algorithm = "aes-256-cbc";
// var key = "3d3w6fs0983ab6b1e37d1c1fs64hm8g9";
// var pt = "Here is the string to be encrypted";
// var iv = "3d3w6fs0983ab6c2";
//
// var encrypt = crypto.createCipheriv(algorithm, key, iv);
// var theCipher = encrypt.update(pt, 'utf8', 'base64');
// theCipher += encrypt.final('base64');
//
// // var theCipher = "XAJ5pe4XLchrUIW1ZOgqVgnXmTh8T6MGh88hwy7HMzSKCPnzshHlHJ/+wEICO1e8";
// theCipher = "Rlk3V3ZRenVrWWhzSEhHSjF0ckVYV2tLSWplVUw5K1U1Y2drbENEK3lrMCtMdGd4UDFOeTVCVW1aOGJyc1NUdS0ta2Rxd2c3LzlJeXVlRUdzcS9LcG5rZz09";
// var iv = new Buffer("9dead9a917ea4d878623f6f21a68b413c68d3f0d", "base64");
// var decrypt = crypto.createDecipheriv(algorithm, key, iv);
// decrypt.setAutoPadding(false);
// var s = decrypt.update(theCipher, 'base64', 'utf8');
// s += decrypt.final('utf8');
// console.log(s);