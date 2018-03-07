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
  , ManagedAddressSaltKlass = require(rootPrefix + '/app/models/managed_address_salt')
  , managedAddressSaltObj = new ManagedAddressSaltKlass()
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const _private = {

  /**
   * After returning response, in background create address salt etc.
   *
   * @param company_managed_address_id
   * @param clientId
   * @return {ResultBase}
   */
  processAddressInBackground: async function (company_managed_address_id, clientId) {

    // REplace with Pankaj method to generate private key
    const addrGenerator = new openStPlatform.utils.generateUnlockedAddress({chain: 'utility'})
        , generateAddrRsp = await addrGenerator.perform();

    if (generateAddrRsp.isFailure()) {
      logger.notify('s_ad_g_4', 'Something Went Wrong', generateAddrRsp.toHash);
      return Promise.resolve(responseHelper.error('s_ad_g_4', 'Something Went Wrong'));
    }

    var eth_address = generateAddrRsp.data['address'];
    var privateKey_d = generateAddrRsp.data['privateKey'];

    var generateSaltRsp = await _private.generateManagedAddressSalt(clientId);
    if (generateSaltRsp.isFailure()) {
      logger.notify('s_ad_g_5', 'Something Went Wrong', generateSaltRsp.toHash);
      return Promise.resolve(responseHelper.error('s_ad_g_5', 'Something Went Wrong'));
    }

    await _private.updateInDb(company_managed_address_id, eth_address, privateKey_d, generateSaltRsp.data['managed_address_salt_id']);

    return responseHelper.successWithData({ethereum_address: eth_address});

  },

  /**
   * Generate managed address salt
   *
   * @return {promise<result>}
   *
   */
  generateManagedAddressSalt: async function (clientId) {

    var oThis = this;

    var insertedRec = null;

    try {

      const newKey = await kmsWrapper.generateDataKey();

      const addressSalt = newKey["CiphertextBlob"];

      insertedRec = await managedAddressSaltObj.create({
        client_id: clientId,
        managed_address_salt: addressSalt
      });

      if (insertedRec.affectedRows == 0) {
        logger.notify('s_ad_g_1', 'Something Went Wrong', err);
        return Promise.resolve(responseHelper.error('s_ad_g_1', 'Something Went Wrong'));
      }

    } catch (err) {
      logger.notify('s_ad_g_2', 'Something Went Wrong', err);
      return Promise.resolve(responseHelper.error('s_ad_g_2', 'Something Went Wrong'));
    }

    return Promise.resolve(responseHelper.successWithData({managed_address_salt_id: insertedRec.insertId}));

  },

  /**
   * Update the row in database.
   *
   * @param company_managed_address_id
   * @param eth_address
   * @param privateKey
   * @param clientId
   * @return {Promise<*>}
   */
  updateInDb: async function (company_managed_address_id, eth_address, privateKeyD, managed_address_salt_id) {

    var obj = new AddressesEncryptorKlass({managedAddressSaltId: managed_address_salt_id});

    var privateKeyEncr = await obj.encrypt(privateKeyD);
    if (!privateKeyEncr) {
      return Promise.resolve(responseHelper.error("s_ad_g_3", "Error while encrypting private key."));
    }

    var updateQueryResponse = managedAddressObj.edit({
      qParams: {
        managed_address_salt_id: managed_address_salt_id,
        private_key: privateKeyEncr,
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
      errors_object['name'] = 'Only letters, numbers and spaces allowed. (Max 20 characters)';
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
      _private.processAddressInBackground(insertedRec.insertId, clientId);
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

  }

};

module.exports = generate;