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
  },

  // Generate Data Key
  generateDataKey: function(){
    this.loadAWSCredentials();
    var kms = new AWS.KMS();
    var params = {
      KeyId: coreConstants.KMS_INFO_ID,
      KeySpec: "AES_256"
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.generateDataKey(params, function (err, response) {
          if(err){
            onReject(err);
          } else {
            onResolve(response);
          }
        })
      }
    );
  }

};

module.exports = kmsWrapper;