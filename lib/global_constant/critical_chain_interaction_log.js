'use strict';

const criticalChainInteractionLog = {
  // Status enum types Start //

  queuedStatus: 'queued',

  pendingStatus: 'pending',

  processedStatus: 'processed',

  failedStatus: 'failed',

  timeoutStatus: 'time_out',

  // Status enum types end //

  // Activity Type enum types Start //

  requestOstActivityType: 'request_ost',

  transferToStakerActivityType: 'transfer_to_staker',

  grantEthActivityType: 'grant_eth',

  proposeBtActivityType: 'propose_bt',

  stakerInitialTransferActivityType: 'staker_initial_transfer',

  stakeApprovalStartedActivityType: 'stake_approval_started',

  stakeBtStartedActivityType: 'stake_bt_started',

  stakeStPrimeStartedActivityType: 'stake_st_prime_started',

  deployAirdropActivityType: 'deploy_airdrop',

  setWorkerActivityType: 'set_worker',

  setPriceOracleActivityType: 'set_price_oracle',

  setAcceptedMarginActivityType: 'set_accepted_margin',

  setopsAirdropActivityType: 'setops_airdrop',

  airdropUsersActivityType: 'airdrop_users',

  // Activity Type enum types End //

  // Chain Type enum types Start //

  valueChainType: 'value',

  utilityChainType: 'utility'

  // Chain Type enum types End //
};

module.exports = criticalChainInteractionLog;
