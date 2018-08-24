"use strict";

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for
 * calling process staking if NOT called before process minting is called.
 *
 * <br>It listens to the ProcessedMint event emitted by processMinting method of openSTUtility contract.
 * On getting this event, it calls processStaking method of openSTValue contract if not called already.
 *
 * @module executables/inter_comm/stake_hunter
 */

const rootPrefix = '../..'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const openStPlatform = require('@openstfoundation/openst-platform')
;

const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , StakeHunterInterCommKlass = openStPlatform.services.interComm.stakeHunter
;

const args = process.argv
  , filePath = args[2]
;

const stakeHunterInterCommObj = new StakeHunterInterCommKlass({file_path: filePath});
stakeHunterInterCommObj.registerInterruptSignalHandlers();
stakeHunterInterCommObj.init();

logger.win("InterComm Script for Stake Hunter initiated.");


process.on('uncaughtException', function(args) {
  logger.error("Received uncaughtException", args);
  setTimeout(function () {
    process.exit(1);
  }, 60000)
});
