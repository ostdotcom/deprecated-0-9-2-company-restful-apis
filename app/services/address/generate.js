"use strict";

const uuid = require('uuid')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
  , AddressesEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , EthAddrPrivateKeyCacheKlass = require(rootPrefix + '/lib/cache_management/address_private_key')
  , managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ManagedAddressSaltKlass = require(rootPrefix + '/app/models/managed_address_salt')
  , managedAddressSaltObj = new ManagedAddressSaltKlass()
  , kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientAddressSaltMapping = require(rootPrefix + '/lib/cache_management/client_address_salt_mapping')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

/**
 * If Eth Address & Passphrase is passed insert in db else call platform to generate a fresh pair and then insert
 *
 * @param {object} params -
 *                  addressType - type of address
 *                  clientId - client id for which address is to be generated
 *                  ethAddress - address to be used
 *                  privateKey - private key to be used
 *                  name - user name
 * @constructor
 */
const GenerateAddressKlass = function(params){

  const oThis = this;

  if (!params) {
    params = {};
  }


  oThis.addressType = params['addressType'];
  oThis.clientId = params['clientId'];
  oThis.ethAddress = params['ethAddress'];
  oThis.privateKey = params['privateKey'];
  oThis.name = params['name'];

};

GenerateAddressKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult((error))){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_a_g_2", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   *
   * Perform operation of generating new address
   * @return {Promise<*>}
   */
  asyncPerform: async function () {

    var oThis = this
        , name = oThis.name
        , clientId = oThis.clientId
        , addressType = oThis.addressType
        , addrUuid = uuid.v4()
        , errors_object = {}
    ;

    // Client id is mandatory for all address types but for internalChainIndenpendentAddressType
    if ((!clientId || clientId === '') && addressType != managedAddressConst.internalChainIndenpendentAddressType) {
      errors_object['client_id'] = 'Mandatory client missing';
    }

    if (name) {
      name = name.trim();
    }

    if(name && !basicHelper.isUserNameValid(name)){
      errors_object['name'] = 'Only letters, numbers and spaces allowed. (3 to 20 characters)';
    }
    if(name && basicHelper.hasStopWords(name)){
      errors_object['name'] = 'Come on, the ' + name + ' you entered is inappropriate. Please choose a nicer word.';
    }

    if(Object.keys(errors_object).length > 0){
      return responseHelper.error('s_a_g_1', 'invalid params', '', [errors_object]);
    }

    const insertedRec = await managedAddressObj.create(
        {
          client_id: clientId,
          name: name,
          uuid: addrUuid,
          address_type: addressType,
          status: 'active'
        });

    if (insertedRec.affectedRows > 0) {
      oThis._processAddressInBackground(insertedRec.insertId, addrUuid);
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
          name: name || '',
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
   * After returning response, in background create address salt etc.
   *
   * @param company_managed_address_id
   * @param clientId
   * @param addrUuid
   * @param addressType
   * @return {ResultBase}
   */
  _processAddressInBackground: async function (company_managed_address_id, addrUuid) {

    const OThis = this
        , clientId = OThis.clientId
        , addressType = OThis.addressType;

    if (!OThis.ethAddress || !OThis.privateKey) {

      const addrGenerator = new openStPlatform.services.utils.generateRawKey()
          , generateAddrRsp = addrGenerator.perform();

      if (generateAddrRsp.isFailure()) {
        logger.notify('s_ad_g_4', 'Something Went Wrong', generateAddrRsp.toHash);
        return Promise.resolve(responseHelper.error('s_ad_g_4', 'Something Went Wrong'));
      }

      var eth_address = generateAddrRsp.data['address'];
      var privateKey_d = generateAddrRsp.data['privateKey'];

    } else {

      var eth_address = OThis.ethAddress;
      var privateKey_d = OThis.privateKey;

    }

    var generateSaltRsp = await OThis._generateManagedAddressSalt(clientId);
    if (generateSaltRsp.isFailure()) {
      logger.notify('s_ad_g_5', 'Something Went Wrong', generateSaltRsp.toHash);
      return Promise.resolve(responseHelper.error('s_ad_g_5', 'Something Went Wrong'));
    }

    await OThis._updateInDb(
        company_managed_address_id,
        eth_address, privateKey_d,
        generateSaltRsp.data['managed_address_salt_id']
    );

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [addrUuid]});
    managedAddressCache.clear();

    if (addressType == managedAddressConst.internalChainIndenpendentAddressType) {
      const ethAddrPrivateKeyCache = new EthAddrPrivateKeyCacheKlass({'address': eth_address});
      ethAddrPrivateKeyCache.clear();
    }

    return responseHelper.successWithData({ethereum_address: eth_address});

  },

  /**
   * Generate managed address salt
   *
   * @return {promise<result>}
   *
   */
  _generateManagedAddressSalt: async function (clientId) {

    var oThis = this;

    var insertedRec = null;

    try {

      // Check if address salt is already generated for a client
      if(clientId) {
        var resp = await new ClientAddressSaltMapping({client_id: clientId}).fetch();
        if(resp.isSuccess() && parseInt(resp.data.clientAddrSalt) > 0){
          return Promise.resolve(responseHelper.successWithData({managed_address_salt_id: resp.data.clientAddrSalt}));
        }
      }

      var KMSObject = new kmsWrapperKlass('managedAddresses');
      const newKey = await KMSObject.generateDataKey();

      const addressSalt = newKey["CiphertextBlob"];

      insertedRec = await managedAddressSaltObj.create({
        client_id: clientId,
        managed_address_salt: addressSalt
      });
      new ClientAddressSaltMapping({client_id: clientId}).clear();

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
  _updateInDb: async function (company_managed_address_id, eth_address, privateKeyD, managed_address_salt_id) {

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

}
module.exports = GenerateAddressKlass;