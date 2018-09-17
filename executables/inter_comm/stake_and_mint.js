'use strict';
/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the stake and mint.
 *
 * It listens to the StakingIntentDeclared event emitted by stake method of openSTValue contract.
 * On getting this event, it calls confirmStakingIntent method of utilityRegistrar contract.
 *
 * Usage: node executables/inter_comm/stake_and_mint.js filePath configStrategyFilePath
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * configStrategyFilePath: path to the file which is storing the config strategy info.
 *
 * Example: node executables/inter_comm/stake_and_mint.js $HOME/openst-setup/logs/stake_and_mint.data ~/config.json
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
  logger.log('* blockNoFilePath is the file path for last ProcessedBlock and last Processed Transaction Index.');
  logger.log('* configStrategyFilePath is the path to the file which is storing the config strategy info.');
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

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
