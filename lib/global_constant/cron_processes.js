'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const cronProcesses = {
  // Cron processes enum types start
  executeTx: 'execute_transaction',

  onBoardingFactory: 'on_boarding_factory',

  airdropAllocateTokensFactory: 'airdrop_allocate_tokens_factory',

  stakeAndMintFactory: 'stake_and_mint_factory',

  airdropContractApproveFactory: 'airdrop_contract_approve_factory',

  executeStpTransferFactory: 'execute_stp_transfer_factory',

  stakeAndMintProcessor: 'stake_and_mint_processor',

  blockScannerWorker: 'block_scanner_worker',

  blockScannerTxDelegator: 'block_scanner_tx_delegator',

  sendErrorEmails: 'send_error_emails',

  updatePriceOraclePricePoints: 'update_price_oracle_price_points',

  fundAddressesByReserveStPrime: 'fund_addresses_by_reserve_st_prime',

  fundAddressesByUtilityChainOwnerEth: 'fund_addresses_by_utility_chain_owner_eth',

  updateRealtimeGasPrice: 'update_realtime_gas_price',

  startAirdrop: 'start_airdrop',

  fundAddressesByUtilityChainOwnerStPrime: 'fund_addresses_by_utility_chain_owner_st_prime',

  observeBalanceOfDonors: 'observe_balance_of_donors',

  transactionMetaObserver: 'transaction_meta_observer',

  // Cron processes enum types end

  // Status enum types start

  runningStatus: 'running',

  stoppedStatus: 'stopped',

  inactiveStatus: 'inactive'

  //Status enum types end
};

const kind = {
  '1': cronProcesses.executeTx,
  '2': cronProcesses.onBoardingFactory,
  '3': cronProcesses.airdropAllocateTokensFactory,
  '4': cronProcesses.stakeAndMintFactory,
  '5': cronProcesses.airdropContractApproveFactory,
  '6': cronProcesses.executeStpTransferFactory,
  '7': cronProcesses.stakeAndMintProcessor,
  '8': cronProcesses.blockScannerWorker,
  '9': cronProcesses.blockScannerTxDelegator,
  '10': cronProcesses.sendErrorEmails,
  '11': cronProcesses.updatePriceOraclePricePoints,
  '12': cronProcesses.fundAddressesByReserveStPrime,
  '13': cronProcesses.fundAddressesByUtilityChainOwnerEth,
  '14': cronProcesses.updateRealtimeGasPrice,
  '15': cronProcesses.startAirdrop,
  '16': cronProcesses.fundAddressesByUtilityChainOwnerStPrime,
  '17': cronProcesses.observeBalanceOfDonors,
  '18': cronProcesses.transactionMetaObserver
};

const status = {
  '1': cronProcesses.runningStatus,
  '2': cronProcesses.stoppedStatus,
  '3': cronProcesses.inactiveStatus
};

cronProcesses.kinds = kind;
cronProcesses.statuses = status;
cronProcesses.invertedKinds = util.invert(kind);
cronProcesses.invertedStatuses = util.invert(status);

module.exports = cronProcesses;
