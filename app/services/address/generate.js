"use strict";

const uuid = require('uuid')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , AddressesEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , EthAddrPrivateKeyCacheKlass = require(rootPrefix + '/lib/cache_management/address_private_key')
  , managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt')
  , kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientAddressSaltMapping = require(rootPrefix + '/lib/cache_management/client_address_salt_mapping')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

/**
 * Generate address klass
 *
 * If Eth Address & Passphrase is passed insert in db else call platform to generate a fresh pair and then insert
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 * @param {number} params.address_type - type of address
 * @param {number} [params.eth_address] - address to be used
 * @param {number} [params.private_key] - private key to be used
 * @param {number} [params.name] - name to be given to this user
 *
 */
const GenerateAddressKlass = function(params){

  const oThis = this;

  if (!params) {
    params = {};
  }

  oThis.addressType = params['address_type'];
  oThis.clientId = params['client_id'];
  oThis.ethAddress = params['eth_address'];
  oThis.privateKey = params['private_key'];
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

          return responseHelper.error({
            internal_error_identifier: 's_a_g_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
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
        , errors_object = []
    ;

    // Client id is mandatory for all address types but for internalChainIndenpendentAddressType
    if ((!clientId || clientId === '') && addressType != managedAddressConst.internalChainIndenpendentAddressType) {
      errors_object.push('missing_client_id');
    }

    if (name) {
      name = name.trim();
    }

    if(name && !basicHelper.isUserNameValid(name)){
      errors_object.push('invalid_username');
    } else if (name && basicHelper.hasStopWords(name)){
      errors_object.push('inappropriate_username');
    }

    if(Object.keys(errors_object).length > 0){
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_a_g_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    const insertedRec = await new ManagedAddressModel()
      .insert({client_id: clientId, name: name, uuid: addrUuid,
        address_type: new ManagedAddressModel().invertedAddressTypes[addressType],
        status: new ManagedAddressModel().invertedStatuses['active']}).fire();

    if (insertedRec.affectedRows == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_a_g_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const updateRsp = await oThis._processAddressInBackground(insertedRec.insertId, addrUuid);

    if (updateRsp.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_a_g_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [addrUuid]});
    managedAddressCache.clear();

    var userData = {
      id: insertedRec.insertId,
      uuid: addrUuid,
      address: updateRsp.data['ethereum_address'],
      name: name || '',
      total_airdropped_tokens: 0,
      token_balance: 0
    };

    const userEntityFormatter = new UserEntityFormatterKlass(userData)
        , userEntityFormatterRsp = await userEntityFormatter.perform()
    ;

    return Promise.resolve(responseHelper.successWithData({
      result_type: "user",
      user: userEntityFormatterRsp.data
    }));

  },

  /**
   *
   * After returning response, in background create address salt etc.
   *
   * @private
   *
   * @param company_managed_address_id
   * @param addrUuid
   *
   * @return {Result}
   */
  _processAddressInBackground: async function (company_managed_address_id, addrUuid) {

    const oThis = this
        , clientId = oThis.clientId
        , addressType = oThis.addressType;

    if (!oThis.ethAddress || !oThis.privateKey) {

      const addrGenerator = new openStPlatform.services.utils.generateRawKey()
          , generateAddrRsp = addrGenerator.perform();

      if (generateAddrRsp.isFailure()) {
        logger.notify(
          's_a_g_3',
          'generate address failure',
          generateAddrRsp,
          {clientId: clientId, address_type: oThis.addressType});
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_a_g_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        }));
      }

      var eth_address = generateAddrRsp.data['address'];
      var privateKey_d = generateAddrRsp.data['privateKey'];

    } else {

      var eth_address = oThis.ethAddress;
      var privateKey_d = oThis.privateKey;

    }

    var generateSaltRsp = await oThis._generateManagedAddressSalt(clientId);
    if (generateSaltRsp.isFailure()) {
      logger.notify(
        's_a_g_4',
        'generate salt failure',
        generateSaltRsp,
        {clientId: clientId});
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_a_g_4',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    await oThis._updateInDb(
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

    return Promise.resolve(responseHelper.successWithData({ethereum_address: eth_address}));

  },

  /**
   * Generate managed address salt
   *
   * @private
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

      insertedRec = await new ManagedAddressSaltModel().insert({client_id: clientId, managed_address_salt: addressSalt}).fire();
      new ClientAddressSaltMapping({client_id: clientId}).clear();

      if (insertedRec.affectedRows == 0) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_a_g_5',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        }));
      }

    } catch (err) {
      logger.notify(
        's_a_g_6',
        'address salt generation failed',
        err,
        {clientId: clientId}
      );

      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_a_g_6',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({managed_address_salt_id: insertedRec.insertId}));

  },

  /**
   * Update the row in database.
   *
   * @private
   *
   * @param company_managed_address_id
   * @param eth_address
   * @param privateKeyD
   * @param managed_address_salt_id
   *
   * @return {Promise<*>}
   */
  _updateInDb: async function (company_managed_address_id, eth_address, privateKeyD, managed_address_salt_id) {
    const addressEncryptorObj = new AddressesEncryptorKlass({managedAddressSaltId: managed_address_salt_id});

    const privateKeyEncr = await addressEncryptorObj.encrypt(privateKeyD);
    if (!privateKeyEncr) {
      return responseHelper.error({
        internal_error_identifier: 's_a_g_7',
        api_error_identifier: 'key_encryption_failed',
        debug_options: {}
      });
    }

    return new ManagedAddressModel().update({
      managed_address_salt_id: managed_address_salt_id,
      private_key: privateKeyEncr,
      ethereum_address: eth_address
    }).where({id: company_managed_address_id}).fire();

  }

};

module.exports = GenerateAddressKlass;