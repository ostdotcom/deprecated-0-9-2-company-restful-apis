"use strict";

/**
 * Given files containing private keys of internal addresses (chain independednt)
 *
 * @module lib/key_management/import_internal_chain_independent_keys
 */

const rootPrefix = "../.."
    , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
    , managedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , internalEthAddrUuidMapCacheKlass = require(rootPrefix + '/lib/cache_management/internal_eth_address_uuid_map')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , basicHelper = require(rootPrefix + '/helpers/basic')
    , GenerateEthAddressKlass = require(rootPrefix + '/app/services/address/generate')
    , managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
    , fs = require('fs');
;

/**
 * Fetch private key for a given address
 *
 * @param {object} params -
 *                  address - address for which key is to be fetched
 *
 * @constructor
 */
const importInternalKeysKlass = function(params){

  const oThis = this;

  oThis.folderPath = params['path'];

};

importInternalKeysKlass.prototype = {

  /**
   * Perform<br><br>
   *
   * @return {Promise<Result>} - returns a Promise with decrypted private key.
   *
   */
  perform: async function(){

    const oThis = this;

    if(!oThis.folderPath || oThis.folderPath === ''){
      return Promise.resolve(responseHelper.error('km_iicik_1', 'Blank Folder Path'));
    }

    if(oThis.folderPath[oThis.folderPath.length - 1] != '/'){
      return Promise.resolve(responseHelper.error('km_iicik_2', 'Folder Path should end with /'));
    }

    var files = fs.readdirSync(oThis.folderPath)
        , fileList = [];

    files.forEach(function(file) {
      if (!fs.statSync(oThis.folderPath + file).isDirectory()) {
        fileList.push(file);
      }
    });

    var addrToKeyMap = {}
        , ethAddresses = [];

    for (i=0; i<fileList.length; i++) {

      var fileName = fileList[i]
          , filePath = oThis.folderPath+fileList[i]
          , fileData = fs.readFileSync(filePath, {encoding: 'utf8'});

      var ethAddress = fileName.split('.')[0]
          , privateKey = fileData;

      if (!ethAddress || !privateKey || privateKey === '' || !basicHelper.isEthAddressValid(ethAddress)) {
        return Promise.resolve(responseHelper.error('km_iicik_3', 'Invalid File' + filePath));
      }

      addrToKeyMap[ethAddress] = privateKey;
      ethAddresses.push(ethAddress);

    }

    if (ethAddresses.length == 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    const managedAddressObj = new managedAddressKlass()
        , managedAddressRsp = await managedAddressObj.getByEthAddresses(ethAddresses);

    for(var i=0; i<managedAddressRsp.length; i++) {
      var key = managedAddressRsp[i].ethereum_address;
      delete addrToKeyMap[key];
    }

    var addrsToInsert = Object.keys(addrToKeyMap);

    for(var i=0; i<addrsToInsert.length; i++) {

      const generateEthAddress = new GenerateEthAddressKlass({
        addressType: managedAddressConst.internalChainIndenpendentAddressType,
        ethAddress: addrsToInsert[i],
        privateKey: addrToKeyMap[addrsToInsert[i]]
      });

      var r = await generateEthAddress.perform();

      if (r.isFailure()) {
        logger.error('km_iicik_4', 'Add GenrationFailed'. r);
      }

    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = importInternalKeysKlass

