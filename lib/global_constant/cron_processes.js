'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const cronProcesses = {
  // Cron processes enum types start
  executeTx: 'execute_transaction',

  rmqFactory: 'rmq_factory',

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

  monitorWorkersGas: 'monitor_workers_gas',

  transactionMetaArchival: 'transactionMetaArchival',

  // Cron processes enum types end

  // Status enum types start

  runningStatus: 'running',

  stoppedStatus: 'stopped',

  inactiveStatus: 'inactive'

  //Status enum types end
};

const kind = {
  '1': cronProcesses.executeTx,
  '2': cronProcesses.rmqFactory,
  '3': cronProcesses.stakeAndMintProcessor,
  '4': cronProcesses.blockScannerWorker,
  '5': cronProcesses.blockScannerTxDelegator,
  '6': cronProcesses.sendErrorEmails,
  '7': cronProcesses.updatePriceOraclePricePoints,
  '8': cronProcesses.fundAddressesByReserveStPrime,
  '9': cronProcesses.fundAddressesByUtilityChainOwnerEth,
  '10': cronProcesses.updateRealtimeGasPrice,
  '11': cronProcesses.startAirdrop,
  '12': cronProcesses.fundAddressesByUtilityChainOwnerStPrime,
  '13': cronProcesses.observeBalanceOfDonors,
  '14': cronProcesses.transactionMetaObserver,
  '15': cronProcesses.monitorWorkersGas,
  '16': cronProcesses.transactionMetaArchival
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
