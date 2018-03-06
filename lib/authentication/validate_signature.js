"use strict";

/*
  * Validate signature of Api request
  *
  * * Author: Pankaj
  * * Date: 18/01/2018
  * * Reviewed by:
*/

const queryString = require('query-string');

const rootPrefix = "../.."
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientSecretsCacheKlass = require(rootPrefix + '/lib/cache_management/client_secrets')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  ;

const _private = {

  // Validate Mandatory params
  mandatoryParamsPresent: function(inputParams){
    if(!inputParams["signature"] || !inputParams["request_timestamp"] || !inputParams["api_key"]){
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

  validateParams: async function(inputParams, reqUrl){
    var obj = new clientSecretsCacheKlass({api_key: inputParams["api_key"], useObject: true});
    var clientKeys = await obj.fetch();
    if(clientKeys.isFailure()){
      return Promise.resolve(clientKeys);
    }

    const signature = inputParams["signature"];
    delete inputParams.signature;

    var queryParamsString = queryString.stringify(inputParams, {arrayFormat: 'bracket'}).replace(/%20/g, '+');
    var inputString = reqUrl + '?' + queryParamsString;

    var secretKey = await localCipher.decrypt(coreConstants.CACHE_SHA_KEY, clientKeys.data["apiSecret"]);
    var computedSignature = localCipher.generateApiSignature(inputString, secretKey);

    if(computedSignature != signature){
      return Promise.resolve(responseHelper.error("a_vs_6", "Invalid Signature."));
    }

    return Promise.resolve(responseHelper.successWithData({clientId: clientKeys.data["clientId"]}));
  }

};

const validateSignature = {

  // Perform validation
  perform: async function(inputParams, reqUrl){

    var result = await _private.mandatoryParamsPresent(inputParams);

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    result = await _private.validateRequestTime(inputParams["request_timestamp"]);

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    return _private.validateParams(inputParams, reqUrl);
  }

};

module.exports = validateSignature;
