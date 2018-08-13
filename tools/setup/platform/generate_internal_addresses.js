'use strict';

/**
 * Generate Internal Addresses required for setup.
 *
 * @module tools/setup/platform/generate_internal_addresses
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  managedAddressConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/app/services/address/generate');
require(rootPrefix + '/lib/providers/platform');

/**
 * Generate Internal addresses required for setup.
 *
 * @param {object} params -
 *                  addresses_count - number of addresses to generate.
 */
const generateInternalAddressesKlass = function(params) {
  const oThis = this;

  oThis.addrGenerationCount = params.addresses_count;
};

generateInternalAddressesKlass.prototype = {
  /**
   * Generate addresses.
   *
   * @return {Promise<Array>}
   */
  perform: async function() {
    const oThis = this,
      generateAddressKlass = oThis.ic().getGenerateAddressClass(),
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    var addressesArr = [];

    for (var i = 0; i < oThis.addrGenerationCount; i++) {
      const addrGenerator = new openSTPlaform.services.utils.generateRawKey(),
        generateAddrRsp = addrGenerator.perform();

      if (generateAddrRsp.isFailure()) {
        logger.error('Address generation failed ============ ', generateAddrRsp);
        process.exit(0);
      }

      var eth_address = generateAddrRsp.data['address'];
      var privateKey = generateAddrRsp.data['privateKey'];

      const generateEthAddress = new generateAddressKlass({
        address_type: managedAddressConst.internalChainIndenpendentAddressType,
        eth_address: eth_address,
        private_key: privateKey
      });

      var r = await generateEthAddress.perform();

      if (r.isFailure()) {
        logger.error('Address generation failed ============ ', r);
        process.exit(0);
      }

      addressesArr.push({ address: eth_address, privateKey: privateKey });
    }

    return Promise.resolve(addressesArr);
  }
};

InstanceComposer.registerShadowableClass(generateInternalAddressesKlass, 'getGenerateInternalAddressesClass');

module.exports = generateInternalAddressesKlass;
