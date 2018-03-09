"use strict";

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the stake and mint.
 *
 * <br>It listens to the StakingIntentDeclared event emitted by stake method of openSTValue contract.
 * On getting this event, it calls confirmStakingIntent method of utilityRegistrar contract.
 *
 * @module executables/inter_comm/stake_and_mint
 */

const rootPrefix = '../..'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const openStPlatform = require('@openstfoundation/openst-platform')
;

const logger = require(rootPrefix + '/helpers/custom_console_logger')
  , StakeAndMintInterCommKlass = openStPlatform.services.interComm.stakeAndMint
;

const args = process.argv
  , filePath = args[2]
;

const stakeAndMintInterCommObj = new StakeAndMintInterCommKlass({file_path: filePath});
stakeAndMintInterCommObj.registerInterruptSignalHandlers();
stakeAndMintInterCommObj.init();

logger.win("InterComm Script for Stake and Mint initiated.");
