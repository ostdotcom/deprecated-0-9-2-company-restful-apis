'use strict';
/**
 * This service is intermediate communicator between value chain and utility chain used for process staking and process minting.
 *
 * It listens to the StakingIntentConfirmed event emitted by confirmStakingIntent method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openStValue contract
 * followed by calling processMinting method of openStUtility contract
 * followed by calling claim of branded token contract / simple token prime contract.
 *
 * Usage: node executables/inter_comm/stake_and_mint_processor.js filePath group_id
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * group_id: id of the group's strategy being used
 *
 * Example: node executables/inter_comm/stake_and_mint_processor.js $HOME/openst-setup/logs/stake_and_mint_processor.data group_id
 *
 * @module executables/inter_comm/stake_and_mint_processor
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/stake_and_mint_processor.js blockNoFilePath group_id');
  logger.log('* blockNoFilePath is the file path for last ProcessedBlock and last Processed Transaction Index.');
  logger.log('* group_id need to be passed to fetch config strategy');
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

  SigIntHandler.call(oThis, {});
};

StartIntercomm.prototype = Object.create(SigIntHandler.prototype);

const StartIntercommPrototype = {
  perform: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data,
      ic = new InstanceComposer(configStrategy),
      platformProvider = ic.getPlatformProvider(),
      openStPlatform = platformProvider.getInstance(),
      StakeAndMintProcessorInterCommKlass = openStPlatform.services.interComm.stakeAndMintProcessor;

    const stakeAndMintProcessorInterCommObj = new StakeAndMintProcessorInterCommKlass({ file_path: filePath });
    stakeAndMintProcessorInterCommObj.registerInterruptSignalHandlers();
    stakeAndMintProcessorInterCommObj.init();

    logger.win('InterComm Script for Stake and Mint Processor initiated.');
  },

  pendingTasksDone: function() {
    const oThis = this;

    return true;
  }
};

Object.assign(StartIntercomm.prototype, StartIntercommPrototype);

let startIntercomm = new StartIntercomm();
startIntercomm.perform().then(function(r) {});
