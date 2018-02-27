"use strict";

/**
 *
 * Pre generate managed addresses, because of geth memory issues in real time address generation.
 *
 * @module executables/generate_managed_addresses
 *
 */

// Include Process Locker File
const rootPrefix = '..'
  , ProcessLockerKlass = require(rootPrefix + '/lib/process_locker')
  , ProcessLocker = new ProcessLockerKlass()
;

ProcessLocker.canStartProcess({process_title: 'cra_generate_managed_addresses'});

// Load Shell Library
var shell = require('shelljs');
shell.config.silent = true;

const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , PreGeneratedManagedAddressKlass = require(rootPrefix + '/app/models/pre_generated_managed_address')
  , PreGeneratedEncryptionSaltKlass = require(rootPrefix + '/app/models/pre_generated_encryption_salt')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , utils = require(rootPrefix + '/lib/util')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const bufferUnusedAddresses = 1000
  , rotateSaltAfter = 1000
  , refillUnusedAddresses = 5000
;

/**
 * Update price oracle price points constructor
 *
 * @constructor
 */
const GenerateManagedAddressesKlass = function () {
  const oThis = this;

  oThis.unusedAddresesCount = 0;
};

GenerateManagedAddressesKlass.prototype = {
  perform: async function () {

    const oThis = this;

    // Get all available addresses that are still unused.
    await oThis._getUnusedAddressesCount();

    //Dont generate more addressed unless min threshold not crossed.
    if (oThis.unusedAddresesCount >= bufferUnusedAddresses) {
      logger.info("Already enough addresses available present in table", oThis.unusedAddresesCount);
      process.exit(0);
    }

    // Start address generation (shell code)
    await oThis._startAddressGeneration();
    process.exit(0);
  },

  /**
   * Get unused addresses count.
   *
   * @return {Promise.<void>}
   * @Sets unusedAddresesCount
   * @private
   */
  _getUnusedAddressesCount: async function () {
    const oThis = this;

    const preGeneratedManagedAddressObj = new PreGeneratedManagedAddressKlass();
    oThis.unusedAddresesCount = await preGeneratedManagedAddressObj.getUnusedAddressCount();
  },

  /**
   * Generate more addresses one at a time
   *
   * @private
   */
  _startAddressGeneration: async function() {
    const oThis = this;

    var addressesData = []
      , addressSaltDetails = {}
    ;

    for (var i=0; i < refillUnusedAddresses; i++) {

      // get new salt from KMS
      if (i % rotateSaltAfter === 0) {
        addressSaltDetails = await oThis._getAddressesSalt();
      }

      var passphrase_d = utils.generatePassphrase()
        , passphrase_e = localCipher.encrypt(addressSaltDetails.kmsPlainText, passphrase_d);

      // Generate address
      var address = (shell.exec("geth attach "+chainInteractionConstants.UTILITY_GETH_RPC_PROVIDER+" --exec \"personal.newAccount('"+passphrase_d+"')\"") || {}).stdout;

      address = address.replace(/["|\n]/g, "");

      console.log('address---'+address+'--');
      if (basicHelper.isAddressValid(address)) {
        addressesData.push([address, passphrase_e, addressSaltDetails.id]);
      } else {
        logger.notify('e_gma_1', 'Pre generate addresses script failed', address);
        process.exit(1);
      }

      // bulk insert addresses
      if (addressesData.length === 100) {
        const preGeneratedManagedAddressObj = new PreGeneratedManagedAddressKlass();
        await preGeneratedManagedAddressObj.bulkInsert(
          ['ethereum_address', 'passphrase', 'pre_generated_encryption_salt_id'],
          utils.clone(addressesData)
        );
        addressesData = [];
      }
    }

    // bulk insert remaining addresses
    if (addressesData.length > 0) {
      const preGeneratedManagedAddressObj = new PreGeneratedManagedAddressKlass();
      await preGeneratedManagedAddressObj.bulkInsert(
        ['ethereum_address', 'passphrase', 'pre_generated_encryption_salt_id'],
        utils.clone(addressesData)
      );
      addressesData = [];
    }

    Promise.resolve();
  },

  /**
   * Generate new KMS salt.
   *
   * @private
   */
  _getAddressesSalt: async function () {
    const oThis = this;

    // Get new key from KMS
    var addressSaltKMSObj = await kmsWrapper.generateDataKey()
      , kmsCipherBlob = addressSaltKMSObj["CiphertextBlob"]
      , kmsPlainText = addressSaltKMSObj["Plaintext"];

    // Insert kms cipher in addresses salts table
    const preGeneratedEncryptionSaltObj = new PreGeneratedEncryptionSaltKlass();
    const createResult = await preGeneratedEncryptionSaltObj.create({encryption_salt: kmsCipherBlob});

    return {id: createResult.insertId, kmsPlainText: kmsPlainText};
  }

};

// perform action
const GenerateManagedAddressesKlassObj = new GenerateManagedAddressesKlass();
GenerateManagedAddressesKlassObj.perform();

var temp = async function () {
  var rootPrefix = '.';
  var PreGeneratedEncryptionSaltKlass = require(rootPrefix + '/app/models/pre_generated_encryption_salt')
  var PreGeneratedManagedAddressKlass = require(rootPrefix + '/app/models/pre_generated_managed_address');
  var localCipher = require(rootPrefix + '/lib/encryptors/local_cipher');
  var kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper');

  var preGeneratedManagedAddressObj = new PreGeneratedManagedAddressKlass();
  var prefetchedAddress = await preGeneratedManagedAddressObj.findById(1);
  var pregeneratedAddress = prefetchedAddress[0];

  var preGeneratedEncryptionSaltObj = new PreGeneratedEncryptionSaltKlass();
  var saltResult = await preGeneratedEncryptionSaltObj.findById(pregeneratedAddress.pre_generated_encryption_salt_id);
  var saltDetail = saltResult[0];

  var addressSaltKMSObj = await kmsWrapper.decrypt(saltDetail.encryption_salt);

  var kmsPlainText = addressSaltKMSObj["Plaintext"];

  var passphrase_d = localCipher.decrypt(kmsPlainText, pregeneratedAddress.passphrase);

  console.log("address-->", pregeneratedAddress.ethereum_address, "------passphrase---->", passphrase_d);
};