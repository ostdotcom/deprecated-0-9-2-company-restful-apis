'use strict';

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the registering branded token.
 *
 * <br>It listens to the ProposedBrandedToken event emitted by proposeBrandedToken method of openSTUtility contract.
 * On getting this event, it calls registerBrandedToken method of utilityRegistrar contract followed
 * by calling registerUtilityToken method of valueRegistrar contract.
 *
 * @module executables/inter_comm/register_branded_token
 */

const rootPrefix = '../..';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  filePath = args[2],
  configStrategy = args[3];

const ic = new InstanceComposer(configStrategy),
  platformProvider = ic.getPlatformProvider(),
  openStPlatform = platformProvider.getInstance(),
  RegisterBrandedTokenInterComm = openStPlatform.services.interComm.registerBrandedToken;

const registerBrandedTokenInterCommObj = new RegisterBrandedTokenInterComm({ file_path: filePath });
registerBrandedTokenInterCommObj.registerInterruptSignalHandlers();
registerBrandedTokenInterCommObj.init();
logger.win('InterComm Script for Register Branded Token initiated.');

process.on('uncaughtException', function() {
  logger.error('Received uncaughtException');
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
