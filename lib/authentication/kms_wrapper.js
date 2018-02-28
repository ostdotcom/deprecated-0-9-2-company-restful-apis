"use strict";
/*
 * Wrapper for AWS KMS
 *
 * * Author: Pankaj
 * * Date: 16/01/2018
 * * Reviewed by:
 */
const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , AWS = require('aws-sdk');

const kmsWrapper = {

  // Load AWS credentials
  loadAWSCredentials: function () {
    return {
      accessKeyId: process.env.CR_AWS_ACCESS_KEY,
      secretAccessKey: process.env.CR_AWS_SECRET_KEY,
      region: process.env.CR_AWS_REGION
    };
  },

  // Encrypt Data
  encrypt: function (data) {
    const oThis = this;

    var kms = new AWS.KMS(oThis.loadAWSCredentials());
    var params = {
      KeyId: coreConstants.KMS_API_KEY_ID,
      Plaintext: data
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.encrypt(params, function (err, encryptedData) {
          if (err) {
            onReject(err);
          } else {
            onResolve(encryptedData);
          }
        })
      }
    );
  },

  // Decrypt Data
  decrypt: function (encryptedString) {
    const oThis = this;

    var kms = new AWS.KMS(oThis.loadAWSCredentials());
    var params = {
      CiphertextBlob: encryptedString
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.decrypt(params, function (err, decryptedData) {
          if (err) {
            onReject(err);
          } else {
            onResolve(decryptedData);
          }
        })
      }
    );
  },

  // Generate Data Key
  generateDataKey: function () {
    const oThis = this;

    var kms = new AWS.KMS(oThis.loadAWSCredentials());
    var params = {
      KeyId: coreConstants.KMS_API_KEY_ID,
      KeySpec: "AES_256"
    };

    return new Promise(
      function (onResolve, onReject) {
        kms.generateDataKey(params, function (err, response) {
          if (err) {
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