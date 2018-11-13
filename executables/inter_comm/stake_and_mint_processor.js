'use strict';
/**
 * This service is intermediate communicator between value chain and utility chain used for process staking and process minting.
 *
 * It listens to the StakingIntentConfirmed event emitted by confirmStakingIntent method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openStValue contract
 * followed by calling processMinting method of openStUtility contract
 * followed by calling claim of branded token contract / simple token prime contract.
 *
 * Usage: node executables/inter_comm/stake_and_mint_processor.js processLockId
 *
 * Command Line Parameters Description:
 * processLockId: processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * Example: node executables/inter_comm/stake_and_mint_processor.js processLockId
 *
 * @module executables/inter_comm/stake_and_mint_processor
 */

const rootPrefix = '../..';

// Always include module overrides first.
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/stake_and_mint_processor.js processLockId');
};

// Declare variables.
const args = process.argv,
  processLockId = args[2];

let filePath, groupId;

const cronKind = CronProcessesConstants.stakeAndMintProcessor; // Define cronKind.

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.emit('SIGINT');
  }, 60000);
});

const StartIntercomm = function() {
  const oThis = this;

  SigIntHandler.call(oThis, { id: processLockId });
};

StartIntercomm.prototype = Object.create(SigIntHandler.prototype);

const StartIntercommPrototype = {
  /**
   * Main performer for the class.
   *
   * @returns {Promise<void>}
   */
  perform: function() {
    const oThis = this;

    // Validate and sanitize the input params.
    oThis._validateAndSanitize();

    oThis.asyncPerform();
  },

  /**
   * Validates certain variables.
   *
   * @private
   */
  _validateAndSanitize: function() {
    if (args.length < 2) {
      logger.error('Invalid arguments !!!');
      usageDemo();
      process.emit('SIGINT');
    }

    if (!processLockId) {
      logger.error('Process Lock id NOT passed in the arguments.');
      usageDemo();
      process.emit('SIGINT');
    }

    if (!filePath) {
      logger.error('File path NOT available in cron params in the database.');
      process.emit('SIGINT');
    }

    if (!groupId) {
      logger.error('Group id NOT available in cron params in the database.');
      process.emit('SIGINT');
    }
  },

  /**
   *
   * @returns {Promise<void>}
   */
  asyncPerform: async function() {
    const strategyByGroupHelperObj = new StrategyByGroupHelper(groupId),
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

  /**
   * Returns a boolean which checks whether all the pending tasks are done or not.
   *
   * @returns {boolean}
   */
  pendingTasksDone: function() {
    return true;
  }
};

Object.assign(StartIntercomm.prototype, StartIntercommPrototype);

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(async function(dbResponse) {
  let cronParams;

  try {
    cronParams = JSON.parse(dbResponse.data.params);
  } catch (err) {
    logger.error('cronParams stored in INVALID format in the DB.');
    process.emit('SIGINT');
  }

  // filePath is the file path for last ProcessedBlock and last Processed Transaction Index.
  filePath = cronParams.filePath.trim();

  // groupId needs to be passed to fetch config strategy.
  groupId = cronParams.groupId;

  const startIntercomm = new StartIntercomm();
  startIntercomm.perform();
});
