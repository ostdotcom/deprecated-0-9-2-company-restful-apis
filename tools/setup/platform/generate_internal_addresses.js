"use strict";

/**
 * Generate Internal Addresses required for setup.
 *
 * @module tools/setup/platform/generate_internal_addresses
 */

const rootPrefix = "../../.."
  , generateAddressKlass = require(rootPrefix + '/app/services/address/generate')
  , managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , openStPlatform = require('@openstfoundation/openst-platform')
  ;

/**
 * Generate Internal addresses required for setup.
 *
 * @param {object} params -
*                  addresses_count - number of addresses to generate.
 */
const generateInternalAddressesKlass = function(params){
  const oThis = this;

  oThis.addrGenerationCount = params.addresses_count;
};

generateInternalAddressesKlass.prototype = {

  /**
   * Generate addresses.
   *
   * @return {Promise<Array>}
   */
  perform: async function(){
    const oThis = this;
    var addressesArr = [];

    for(var i=0;i<oThis.addrGenerationCount;i++){
      const addrGenerator = new openStPlatform.services.utils.generateRawKey()
        , generateAddrRsp = addrGenerator.perform();

      if (generateAddrRsp.isFailure()) {
        logger.info('Address generation failed ============ ', generateAddrRsp);
        process.exit(0);
      }

      var eth_address = generateAddrRsp.data['address'];
      var privateKey = generateAddrRsp.data['privateKey'];

      const generateEthAddress = new generateAddressKlass({
        addressType: managedAddressConst.internalChainIndenpendentAddressType,
        ethAddress: eth_address,
        privateKey: privateKey
      });
      var r = await generateEthAddress.perform();

      if (r.isFailure()) {
        logger.info('Address generation failed ============ ', r);
        process.exit(0);
      }
      addressesArr.push({address: eth_address, privateKey: privateKey});
    }

    return Promise.resolve(addressesArr);
  }
};

module.exports = generateInternalAddressesKlass;