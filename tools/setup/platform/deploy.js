'use strict';

//Always Include Module overrides First
const rootPrefix = '../../..';
require(rootPrefix + '/module_overrides/index');

/**
 *
 * Set up Platform
 *
 * @module tools/setup/platform/deploy
 *
 */

const logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/tools/setup/platform/generate_internal_addresses');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path);

/**
 * Set up platform
 *
 * @constructor
 */
const DeployPlatformKlass = function() {};

DeployPlatformKlass.prototype = {
  /**
   * Set up platform
   *
   * @return {Promise<void>}
   */
  perform: async function() {
    const oThis = this,
      instanceComposer = new InstanceComposer(configStrategy),
      generateInternalAddressesKlass = instanceComposer.getGenerateInternalAddressesClass(),
      platformProvider = instanceComposer.getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      openStSetupPerformer = openSTPlaform.services.setup.performer;

    let generateAddressObj = new generateInternalAddressesKlass({ addresses_count: 15 }),
      addressesArr = await generateAddressObj.perform();

    if (!addressesArr || addressesArr.length <= 0) {
      logger.info('* Address generation failed *');
      process.exit(0);
    }

    await openStSetupPerformer.perform('all', { pre_generated_addresses: addressesArr });

    process.exit(0);
  }
};

const services = new DeployPlatformKlass();
services.perform();
