"use strict";

const uuid = require('uuid')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
  , AddressesEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , preGeneratedAddressesKlass = require(rootPrefix + '/app/models/pre_generated_managed_address')
  , PreGeneratedEncryptionSaltKlass = require(rootPrefix + '/app/models/pre_generated_encryption_salt')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const _private = {

  /**
   * Update the row in database.
   *
   * @param company_managed_address_id
   * @param eth_address
   * @param passphrase
   * @param clientId
   * @return {Promise<*>}
   */
  updateInDb: async function (company_managed_address_id, eth_address, passphrase, clientId) {
    var obj = new AddressesEncryptorKlass(clientId);
    var passPhraseEncr = await obj.encrypt(passphrase);
    if (!passPhraseEncr) {
      return Promise.resolve(responseHelper.error("s_ad_g_1", "Error while generating user address."));
    }

    var updateQueryResponse = managedAddressObj.edit({
      qParams: {
        passphrase: passPhraseEncr,
        ethereum_address: eth_address
      },
      whereCondition: {
        id: company_managed_address_id
      }
    });

    return updateQueryResponse;
  }

};

const generate = {

  /**
   *
   * Perform operation of generating new address
   *
   * @param clientId
   * @param addressType
   * @param name
   * @return {Promise<*>}
   */
  perform: async function (clientId, addressType, name) {

    var oThis = this
      , name = name
      , addrUuid = uuid.v4()
      , errors_object = {}
    ;

    if (name) {
      name = name.trim();
    }

    if((name || name === '') && !basicHelper.isUserNameValid(name)){
      errors_object['name'] = 'Only letters, numbers and spaces allowed. (3 to 20 characters)';
    }
    if((name || name === '') && basicHelper.hasStopWords(name)){
      errors_object['name'] = 'Come on, the ' + name + ' you entered is inappropriate. Please choose a nicer word.';
    }

    if(Object.keys(errors_object).length > 0){
      return responseHelper.error('s_a_g_1', 'invalid params', '', [errors_object]);
    }

    name = name || '';

    const insertedRec = await managedAddressObj.create(
      {
        client_id: clientId,
        name: name,
        uuid: addrUuid,
        address_type: addressType,
        status: 'active'
      });

    if (insertedRec.affectedRows > 0) {
      oThis.updateAddress(insertedRec.insertId, clientId);
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [addrUuid]});
    managedAddressCache.clear();

    var userData = {};
    if(addressType != managedAddressConst.userAddressType){
      userData['id'] = insertedRec.insertId;
    } else {
      userData['id'] = addrUuid;
    }

    return responseHelper.successWithData({
      result_type: "economy_users",
      'economy_users': [
        Object.assign(userData, {
          uuid: addrUuid,
          name: name,
          total_airdropped_tokens: 0,
          token_balance: 0
        })
      ],
      meta: {
        next_page_payload: {}
      }
    });

  },

  /**
   * Update the record in db, after generating an address.
   *
   * @param company_managed_address_id
   * @param clientId
   * @return {ResultBase}
   */
  updateAddress: async function (company_managed_address_id, clientId) {
    var obj = new preGeneratedAddressesKlass();
    var resp = await obj.getUnusedAddresses(1);

    if(!resp[0]){
      return responseHelper.error("s_ad_g_2", "Address not fetched from db");
    }
    var pregeneratedAddress = resp[0];

    var eth_address = pregeneratedAddress.ethereum_address;

    var preGeneratedEncryptionSaltObj = new PreGeneratedEncryptionSaltKlass();
    var saltResult = await preGeneratedEncryptionSaltObj.findById(pregeneratedAddress.pre_generated_encryption_salt_id);
    var saltDetail = saltResult[0];

    var addressSaltKMSObj = await kmsWrapper.decrypt(saltDetail.encryption_salt);

    var kmsPlainText = addressSaltKMSObj["Plaintext"];

    var passphrase_d = localCipher.decrypt(kmsPlainText, pregeneratedAddress.passphrase);

    await _private.updateInDb(company_managed_address_id, eth_address, passphrase_d, clientId);

    return responseHelper.successWithData({ethereum_address: eth_address});
  }

};

module.exports = generate;