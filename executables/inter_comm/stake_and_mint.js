'use strict';

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the stake and mint.
 *
 * <br>It listens to the StakingIntentDeclared event emitted by stake method of openSTValue contract.
 * On getting this event, it calls confirmStakingIntent method of utilityRegistrar contract.
 *
 * @module executables/inter_comm/stake_and_mint
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/stake_and_mint.js blockNoFilePath configStrategyFilePath');
};

const args = process.argv,
  filePath = args[2].trim(),
  configStrategyFilePath = args[3].trim();

let configStrategy = {};

const validateAndSanitize = function() {
  if (args.length < 4) {
    logger.error('Invalid arguments !!!');
    usageDemo();
    process.exit(1);
  }

  if (!filePath) {
    logger.error('filePath Not Found!!');
    process.exit(1);
  }

  if (!configStrategyFilePath) {
    logger.error('configStrategyFilePath Not Found!!');
    process.exit(1);
  }

  configStrategy = require(configStrategyFilePath);
};

// validate and sanitize the input params
validateAndSanitize();

const ic = new InstanceComposer(configStrategy),
  platformProvider = ic.getPlatformProvider(),
  openStPlatform = platformProvider.getInstance(),
  StakeAndMintInterCommKlass = openStPlatform.services.interComm.stakeAndMint;

const stakeAndMintInterCommObj = new StakeAndMintInterCommKlass({ file_path: filePath });
stakeAndMintInterCommObj.registerInterruptSignalHandlers();
stakeAndMintInterCommObj.init();

logger.win('InterComm Script for Stake and Mint initiated.');

process.on('uncaughtException', function() {
  logger.error('Received uncaughtException');
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
