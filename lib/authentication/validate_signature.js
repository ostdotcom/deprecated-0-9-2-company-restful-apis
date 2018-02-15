"use strict";

/*
  * Validate signature of Api request
  *
  * * Author: Pankaj
  * * Date: 18/01/2018
  * * Reviewed by:
*/

const rootPrefix = "../.."
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientSecretsCacheKlass = require(rootPrefix + '/lib/cache_management/client_secrets')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  ;

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
    var obj = new clientSecretsCacheKlass({api_key: inputParams["api-key"], useObject: true});
    var clientKeys = await obj.fetch();
    if(clientKeys.isFailure()){
      return Promise.resolve(clientKeys);
    }

    var inputString = (reqUrl + '::' + inputParams["request-timestamp"]);

    var stringify_params = this.sortRequestParams(inputParams);
    inputString += ("::" + stringify_params);
    var secretKey = await localCipher.decrypt(coreConstants.CACHE_SHA_KEY, clientKeys.data["apiSecret"]);

    var computedSignature = localCipher.generateApiSignature(inputString, secretKey);

    if(computedSignature != inputParams["signature"]){
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

    result = await _private.validateRequestTime(inputParams["request-timestamp"]);

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    return _private.validateParams(inputParams, reqUrl);
  }

};

module.exports = validateSignature;
