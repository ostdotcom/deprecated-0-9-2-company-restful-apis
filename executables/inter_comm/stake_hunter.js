'use strict';
/**
 * This executable / script is intermediate communicator between value chain and utility chain used for
 * calling process staking if NOT called before process minting is called.
 *
 * It listens to the ProcessedMint event emitted by processMinting method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openSTValue contract if not called already.
 *
 * Usage: node executables/inter_comm/stake_hunter.js filePath configStrategyFilePath
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * configStrategyFilePath: path to the file which is storing the config strategy info.
 *
 * Example: node executables/inter_comm/stake_hunter.js $HOME/openst-setup/logs/stake_hunter.data ~/config.json
 *
 * @module executables/inter_comm/stake_hunter
 */
/**
 *
 *
 * @module
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/stake_hunter.js blockNoFilePath configStrategyFilePath');
};

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  filePath = args[2],
  configStrategyFilePath = args[3];

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
  StakeHunterInterCommKlass = openStPlatform.services.interComm.stakeHunter;

const stakeHunterInterCommObj = new StakeHunterInterCommKlass({ file_path: filePath });
stakeHunterInterCommObj.registerInterruptSignalHandlers();
stakeHunterInterCommObj.init();

logger.win('InterComm Script for Stake Hunter initiated.');

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
