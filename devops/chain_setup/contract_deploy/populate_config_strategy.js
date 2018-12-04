'use strict';
const rootPrefix = '../../../',
  kmsWrapperKlass = require(rootPrefix + 'lib/authentication/kms_wrapper'),
  ManagedAddressSaltModel = require(rootPrefix + 'app/models/managed_address_salt');

const keys = require('all-object-keys');

const ConfigStrategyOps = require('./configDbOps.js');
require(rootPrefix + 'tools/setup/platform/generate_internal_addresses.js');
var oThis;

var populateConfig = function() {
  oThis = this;
};

populateConfig.prototype = {
  //Generate managed address salt id
  init: async function() {
    const KMSObject = new kmsWrapperKlass('managedAddresses');
    const newKey2 = await KMSObject.generateDataKey();
    const addressSalt = newKey2['CiphertextBlob'];
    let insertedRec = await new ManagedAddressSaltModel().insert({ managed_address_salt: addressSalt }).fire();
    oThis.managedAddress = insertedRec.insertId;
    console.log('ManagedAddress Salt ID: ', insertedRec.insertId);
  },

  // Generate address  required for contract deployment

  generateTempAdd: async function(addresses_count) {
    var InstanceComposer = require(rootPrefix + '/instance_composer');
    var instanceComposer = new InstanceComposer({});

    var generateInternalAddressesKlass = instanceComposer.getGenerateInternalAddressesClass();
    var generateInternalAddressesObj = new generateInternalAddressesKlass({ addresses_count: addresses_count });
    let addressesArr = await generateInternalAddressesObj.perform();
    if (addressesArr) {
      return addressesArr;
    } else {
      console.log('temp address generation failed');
      process.exit(1);
    }
  },

  // Map config strategy to devops config file

  variableMapping: async function(templateConfig, devopsConfig) {
    var key_arr = await keys(templateConfig.generate_addr_template);
    if (key_arr[0] === '') {
      key_arr = [];
    }
    var generated_addr = await oThis.generateTempAdd(key_arr.length);
    var keyVal;
    for (let i = 0; i < key_arr.length; i++) {
      var generatedAddr = generated_addr[i].address;
      eval(`templateConfig.generate_addr_template.${key_arr[i]} =  generatedAddr`);
    }
    key_arr = await keys(templateConfig.replace_data_template);
    if (key_arr[0] === '') {
      key_arr = [];
    }
    for (let i = 0; i < key_arr.length; i++) {
      keyVal = eval(`templateConfig.replace_data_template.${key_arr[i]}`);
      eval(`templateConfig.replace_data_template.${key_arr[i]} = devopsConfig.${keyVal}`);
    }
    var updatedConfig = Object.assign(
      {},
      templateConfig.default_data_template,
      templateConfig.replace_data_template,
      templateConfig.generate_addr_template
    );
    return updatedConfig;
  },

  //Populate config strategy for a given kind
  populateKind: async function(templateConfig, devopsConfig, groupId) {
    var ConfigStrategyObj = new ConfigStrategyOps(groupId);
    let getRsp = await ConfigStrategyObj.getConfigStrategy(templateConfig.name);
    var rsp = true;
    if (!getRsp) {
      var updatedConfig = await oThis.variableMapping(templateConfig, devopsConfig);
      rsp = await ConfigStrategyObj.insertConfigStrategy(updatedConfig, oThis.managedAddress, templateConfig.name);
      if (templateConfig.name == 'value_constants') {
        return { OST_FOUNDATION_ADDR: updatedConfig.OST_FOUNDATION_ADDR };
      } else if (templateConfig.name == 'utility_constants') {
        return { OST_UTILITY_CHAIN_OWNER_ADDR: updatedConfig.OST_UTILITY_CHAIN_OWNER_ADDR };
      }
      return rsp;
    }

    console.log('already exists so not inserting');
    return true;
  },

  updateKind: async function(createdContractAddress, contractName, kind, group_id) {
    var ConfigStrategyObj = new ConfigStrategyOps(group_id);
    var rsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, kind);
    return rsp;
  }
};

module.exports = populateConfig;
