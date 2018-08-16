'use strict';

/*
*
*
* Usage :  node executables/one_timers/insert_managed_address_salt_id.js
*
* This script will insert a new salt id in managed_addresses_salt.
*
*
* */

const rootPrefix = '../..',
  kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt');

const InsertSaltID = {
  perform: async function() {
    const KMSObject = new kmsWrapperKlass('managedAddresses');

    const newKey2 = KMSObject.generateDataKey().then(async function(a) {
      const addressSalt = a['CiphertextBlob'];
      console.log(addressSalt);

      let insertedRec = await new ManagedAddressSaltModel().insert({ managed_address_salt: addressSalt }).fire();

      console.log('ManagedAddress Salt ID: ', insertedRec.insertId);
      process.exit(0);
    });
  }
};

module.exports = InsertSaltID;
InsertSaltID.perform();
