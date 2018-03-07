"use strict";

/**
 * given eth address, returns private key
 *
 * @module lib/key_management/fetch_private_key
 */

const rootPrefix = "../.."
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , internalEthAddrUuidMapCacheKlass = require(rootPrefix + '/lib/cache_management/internal_eth_address_uuid_map')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * Fetch private key for a given address
 *
 * @param {object} params -
 *                  address - address for which key is to be fetched
 *
 * @constructor
 */
const PrivateKeyFetcherKlass = function(params){
  
  const oThis = this;

  oThis.address = params['address'];

};

PrivateKeyFetcherKlass.prototype = {

  /**
   * Perform<br><br>
   *
   * @return {Promise<Result>} - returns a Promise with decrypted private key.
   *
   */
  perform: async function(){
    
    const oThis = this;

    const internalEthAddrUuidMapCache = new internalEthAddrUuidMapCacheKlass({'address': oThis.address})
        , uuidFetchRsp = await internalEthAddrUuidMapCache.fetch();

    if(uuidFetchRsp.isFailure()){
      return Promise.resolve(responseHelper.error('km_fpk_1', 'Cache Fetch Failed'));
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [uuidFetchRsp.data]})
        , cacheFetchResponse = await managedAddressCache.fetchDecryptedData(['private_key'])
        , response = cacheFetchResponse.data[uuidFetchRsp.data];

    if (cacheFetchResponse.isFailure() || !response) {
      return Promise.resolve(cacheFetchResponse);
    }

    return Promise.resolve(responseHelper.successWithData(response));
    
  }

};

module.exports = PrivateKeyFetcherKlass

