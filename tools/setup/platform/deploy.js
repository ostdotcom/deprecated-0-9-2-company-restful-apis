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

const generateInternalAddressesKlass = require(rootPrefix + '/tools/setup/platform/generate_internal_addresses'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  openStSetupPerformer = require(rootPrefix + '/node_modules/@openstfoundation/openst-platform/tools/setup/performer');

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
    var generateAddressObj = new generateInternalAddressesKlass({ addresses_count: 15 }),
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
