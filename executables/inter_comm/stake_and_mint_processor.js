'use strict';
/**
 * This service is intermediate communicator between value chain and utility chain used for process staking and process minting.
 *
 * It listens to the StakingIntentConfirmed event emitted by confirmStakingIntent method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openStValue contract
 * followed by calling processMinting method of openStUtility contract
 * followed by calling claim of branded token contract / simple token prime contract.
 *
 * Usage: node executables/inter_comm/stake_and_mint_processor.js filePath configStrategyFilePath
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * configStrategyFilePath: path to the file which is storing the config strategy info.
 *
 * Example: node executables/inter_comm/stake_and_mint_processor.js $HOME/openst-setup/logs/stake_and_mint_processor.data ~/config.json
 *
 * @module executables/inter_comm/stake_and_mint_processor
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/inter_comm/stake_and_mint_processor.js blockNoFilePath configStrategyFilePath'
  );
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
  StakeAndMintProcessorInterCommKlass = openStPlatform.services.interComm.stakeAndMintProcessor;

const stakeAndMintProcessorInterCommObj = new StakeAndMintProcessorInterCommKlass({ file_path: filePath });
stakeAndMintProcessorInterCommObj.registerInterruptSignalHandlers();
stakeAndMintProcessorInterCommObj.init();

logger.win('InterComm Script for Stake and Mint Processor initiated.');

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
