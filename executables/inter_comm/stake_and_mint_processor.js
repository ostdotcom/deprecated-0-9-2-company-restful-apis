'use strict';

/**
 * This service is intermediate communicator between value chain and utility chain used for process staking and process minting.
 *
 * <br>It listens to the StakingIntentConfirmed event emitted by confirmStakingIntent method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openStValue contract
 * followed by calling processMinting method of openStUtility contract
 * followed by calling claim of branded token contract / simple token prime contract.
 *
 * @module executables/inter_comm/stake_and_mint_processor
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  filePath = args[2],
  configStrategy = args[3],
  ic = new InstanceComposer(configStrategy),
  platformProvider = ic.getPlatformProvider(),
  openStPlatform = platformProvider.getInstance(),
  StakeAndMintProcessorInterCommKlass = openStPlatform.services.interComm.stakeAndMintProcessor;

const stakeAndMintProcessorInterCommObj = new StakeAndMintProcessorInterCommKlass({ file_path: filePath });
stakeAndMintProcessorInterCommObj.registerInterruptSignalHandlers();
stakeAndMintProcessorInterCommObj.init();

logger.win('InterComm Script for Stake and Mint Processor initiated.');

process.on('uncaughtException', function() {
  logger.error('Received uncaughtException');
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});
