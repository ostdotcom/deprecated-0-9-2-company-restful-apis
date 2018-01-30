"use strict";

/*
  * Validate signature of Api request
  *
  * * Author: Pankaj
  * * Date: 18/01/2018
  * * Reviewed by:
*/

const coreConstants = require('../../config/core_constants')
  , responseHelper = require('./../formatter/response')
  , localCipher = require('./local_cipher')
  , kmsWrapper = require('./kms_wrapper')
  , clientModel = require('../../app/models/client')
  , clientApiCredential = require('../../app/models/client_api_credential');


// Fetch client secret key
const _clientSecret = {

  fetch: async function(apiKey) {
    var clientApiCredentialData = await clientApiCredential.getClientApi(apiKey);

    if (!clientApiCredentialData[0]) {
      return Promise.resolve(responseHelper.error("a_vs_3", "Invalid client details."));
    }

    var clientId = clientApiCredentialData[0]["client_id"],
      clientEncryptedKey = clientApiCredentialData[0]["api_secret"];

    var clientRecords = await clientModel.get(clientId);
    if (!clientRecords[0]) {
      return Promise.resolve(responseHelper.error("a_vs_4", "Invalid client details."));
    }

    var decryptedSalt = await kmsWrapper.decrypt(clientRecords[0]["info_salt"]);
    if(!decryptedSalt["Plaintext"]){
      return Promise.resolve(responseHelper.error("a_vs_5", "Client Salt invalid."));
    }
    var infoSalt = decryptedSalt["Plaintext"];

    var apiSecret = await localCipher.decrypt(infoSalt, clientEncryptedKey);

    return Promise.resolve(responseHelper.successWithData({apiSecret: apiSecret, clientId: clientId}));
  }

};

const _private = {

  // Validate Mandatory params
  mandatoryParamsPresent: function(inputParams){
    if(!inputParams["signature"] || !inputParams["request-timestamp"] || !inputParams["api-key"]){
      return Promise.resolve(responseHelper.error("a_vs_1", "Mandatory parameters missing."));
    }
    return Promise.resolve(responseHelper.successWithData());
  },

  // Validate Mandatory params
  validateRequestTime: function(requestTime){
    var currentTime = Math.floor((new Date).getTime()/1000);
    if(currentTime > (parseInt(requestTime) + 10)){
      return Promise.resolve(responseHelper.error("a_vs_2", "Request Expired."));
    }
    return Promise.resolve(responseHelper.successWithData());
  },

  sortRequestParams: function(inputParams){
    var ar = Object.keys(inputParams).sort(function(a, b)
    {
      var nA = a.toLowerCase();
      var nB = b.toLowerCase();

      if(nA < nB)
        return -1;
      else if(nA > nB)
        return 1;
      return 0;
    });

    var outputParams = {};
    for(var i=0;i<ar.length;i++){
      var key = ar[i];
      if(!["signature", "request-timestamp", "api-key"].includes(key.toLowerCase())){
        outputParams[key] = inputParams[key];
      }
    }

    return (JSON.stringify(outputParams));
  },

  validateParams: async function(inputParams, reqUrl){

    var clientData = await _clientSecret.fetch(inputParams["api-key"]);
    if(clientData.isFailure()){
      return Promise.resolve(clientData);
    }

    var inputString = (reqUrl + '::' + inputParams["request-timestamp"]);

    var stringify_params = this.sortRequestParams(inputParams);
    inputString += ("::" + stringify_params);
    var secretKey = clientData.data["apiSecret"];

    var computedSignature = localCipher.generateApiSignature(inputString, secretKey);

    if(computedSignature != inputParams["signature"]){
      return Promise.resolve(responseHelper.error("a_vs_6", "Invalid Signature."));
    }

    return Promise.resolve(responseHelper.successWithData({clientId: clientData.data["clientId"]}));
  }

};

const validateSignature = {

  // Perform validation
  perform: async function(inputParams, reqUrl){

    var result = await _private.mandatoryParamsPresent(inputParams);

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    result = await _private.validateRequestTime(inputParams["request-timestamp"]);

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    return _private.validateParams(inputParams, reqUrl);
  }

};

module.exports = validateSignature;
