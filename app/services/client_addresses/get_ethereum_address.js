"use strict";

var rootPrefix = '../../..'
  , clientModel = require(rootPrefix + '/app/models/client')
  , companyAddressModel = require(rootPrefix + '/app/models/company_managed_address')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  ;

const GetEthereumKlass = function(params){
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.addressIds = params.company_managed_address_ids;

};

GetEthereumKlass.prototype = {

  perform: async function(){

    try {
      const oThis = this;

      // Get client record
      var clientRecords = await clientModel.get(oThis.clientId);
      if (!clientRecords[0]) {
        return Promise.resolve(responseHelper.error("ca_gea_1", "Invalid client details."));
      }

      // Decrypt client info salt
      var decryptedSalt = await kmsWrapper.decrypt(clientRecords[0]["info_salt"]);
      if(!decryptedSalt["Plaintext"]){
        return responseHelper.error("ca_gea_2", "Client Salt invalid.");
      }
      var infoSalt = decryptedSalt["Plaintext"];

      // Fetch Ethereum addresses from company managed addresses
      var companyAddresses = await companyAddressModel.getByIds(oThis.addressIds);
      if (!companyAddresses[0] || companyAddresses.length != oThis.addressIds.length) {
        return Promise.resolve(responseHelper.error("ca_gea_3", "Invalid Company address Ids."));
      }

      // Decrypt all ethereum addresses using client info salt
      var ethAddresses = {};
      for(var i=0;i<companyAddresses.length;i++){
        var encryptedEthereumAddress = companyAddresses[i]["ethereum_address"];
        ethAddresses[companyAddresses[i]["id"]] = localCipher.decrypt(infoSalt, encryptedEthereumAddress);
      }
      return Promise.resolve(responseHelper.successWithData(ethAddresses));
    } catch (err) {
      return Promise.reject('Something went wrong. ' + err.message);
    }

  }

};

module.exports = GetEthereumKlass;