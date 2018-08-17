'use strict';

//Always Include Module overrides First
const rootPrefix = '../../..';
require(rootPrefix + '/module_overrides/index');

/**
 *
 * Set up Platform
 *
 * @module tools/setup/platform/deploy_another_utility_chain
 *
 */

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/lib/providers/platform');

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
      platformProvider = instanceComposer.getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      openStSetupPerformer = openSTPlaform.services.setup.performer;

    await openStSetupPerformer.perform('utility', {});

    process.exit(0);
  }
};

const services = new DeployPlatformKlass();
services.perform();
