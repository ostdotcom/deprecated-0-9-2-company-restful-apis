'use strict';
/**
 * This executable / script is intermediate communicator between value chain and utility chain used for
 * calling process staking if NOT called before process minting is called.
 *
 * It listens to the ProcessedMint event emitted by processMinting method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openSTValue contract if not called already.
 *
 * Usage: node executables/inter_comm/stake_hunter.js filePath group_id
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index
 * group_id: group id for fetching config strategy
 *
 * Example: node executables/inter_comm/stake_hunter.js $HOME/openst-setup/logs/stake_hunter.data group_id
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
  logger.log('usage:', 'node ./executables/inter_comm/stake_hunter.js blockNoFilePath group_id');
};

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  filePath = args[2],
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
      StakeHunterInterCommKlass = openStPlatform.services.interComm.stakeHunter;

    const stakeHunterInterCommObj = new StakeHunterInterCommKlass({ file_path: filePath });
    stakeHunterInterCommObj.registerInterruptSignalHandlers();
    stakeHunterInterCommObj.init();

    logger.win('InterComm Script for Stake Hunter initiated.');
  },

  /**
   * Check if pending tasks are completed
   *
   */
  pendingTasksDone: function() {
    const oThis = this;

    return true;
  }
};

Object.assign(StartIntercomm.prototype, StartIntercommPrototype);

let startIntercomm = new StartIntercomm();
startIntercomm.perform().then(function(r) {});
