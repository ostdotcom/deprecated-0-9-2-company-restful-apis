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

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  filePath = args[2],
  configStrategy = args[3],
  ic = new InstanceComposer(configStrategy),
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
