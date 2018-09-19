'use strict';
/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the stake and mint.
 *
 * It listens to the StakingIntentDeclared event emitted by stake method of openSTValue contract.
 * On getting this event, it calls confirmStakingIntent method of utilityRegistrar contract.
 *
 * Usage: node executables/inter_comm/stake_and_mint.js filePath group_id
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * group_id: group id for fetching config strategy
 *
 * Example: node executables/inter_comm/stake_and_mint.js $HOME/openst-setup/logs/stake_and_mint.data group_id
 *
 * @module executables/inter_comm/stake_and_mint
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/stake_and_mint.js blockNoFilePath group_id');
  logger.log('* blockNoFilePath is the file path for last ProcessedBlock and last Processed Transaction Index.');
  logger.log('* group_id should be sent to fetch config strategy.');
};

const args = process.argv,
  filePath = args[2].trim(),
  group_id = args[3];

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

  if (!group_id) {
    logger.error('group_id Not Found!!');
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});

const StartIntercomm = function() {
  const oThis = this;
};

StartIntercomm.prototype = {
  perform: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data,
      ic = new InstanceComposer(configStrategy),
      platformProvider = ic.getPlatformProvider(),
      openStPlatform = platformProvider.getInstance(),
      StakeAndMintInterCommKlass = openStPlatform.services.interComm.stakeAndMint;

    const stakeAndMintInterCommObj = new StakeAndMintInterCommKlass({ file_path: filePath });
    stakeAndMintInterCommObj.registerInterruptSignalHandlers();
    stakeAndMintInterCommObj.init();

    logger.win('InterComm Script for Stake and Mint initiated.');
  }
};

let startIntercomm = new StartIntercomm();
startIntercomm.perform().then(function(r) {
  process.exit(0);
});
