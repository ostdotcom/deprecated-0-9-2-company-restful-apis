'use strict';
/**
 * This script can be used to populate cron_processes table.
 *
 * NOTES:
 * 1. PLEASE USE THIS SCRIPT IN DEVELOPMENT MODE ONLY.
 * 2. UPDATE THE groupId and utilityChainId based on your systems.
 * 3. DO NOT CHANGE THE 'id' VALUES IN THE CODE. THESE ID VALUES ARE BEING USED IN OTHER SCRIPTS AS IS.
 *
 * @module executables/one_timers/populate_cron_processes
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CronProcessesModel = require(rootPrefix + '/app/models/cron_processes'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes');

const populateCronProcesses = function() {
  const oThis = this;

  oThis.groupId = 1000;
  oThis.utilityChainId = 1000;
};

populateCronProcesses.prototype = {
  perform: async function() {
    const oThis = this;

    await oThis.entryForRmqFactory();
    await oThis.entryForStakeAndMintProcessor();
    await oThis.entryForBlockScannerWorker();
    await oThis.entryForBlockScannerTxDelegator();
    await oThis.entryForSendErrorEmails();
    await oThis.entryForUpdateRealtimeGasPrice();
    await oThis.entryForStartAirdrop();
    await oThis.entryForTransactionMetaObserver();

    logger.win('Table populated successfully.');
    process.exit(0);
  },

  // Kind: 2
  entryForRmqFactory: async function() {
    const params = {
        queue_suffix: 'temp',
        topics_to_subscribe:
          '["airdrop.approve.contract", "event.block_scanner.#", "event.stake_and_mint_processor.#", ' +
          '"stake_and_mint.#","on_boarding.#", "airdrop_allocate_tokens", "transaction.stp_transfer"]'
      },
      insertParams = {
        id: 1,
        kind: CronProcessesConstants.rmqFactory,
        ip_address: '127.0.0.1',
        status: 'stopped',
        group_id: null,
        params: JSON.stringify(params)
      };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 3
  entryForStakeAndMintProcessor: async function() {
    const oThis = this;

    const params = {
        file_path: '/data/utility-chain-' + oThis.utilityChainId.toString() + '/stake_and_mint_processor.data',
        group_id: oThis.groupId
      },
      insertParams = {
        id: 2,
        kind: CronProcessesConstants.stakeAndMintProcessor,
        ip_address: '127.0.0.1',
        status: 'stopped',
        group_id: oThis.groupId,
        params: JSON.stringify(params)
      };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 4
  entryForBlockScannerWorker: async function() {
    const oThis = this;

    const params = {
        group_id: oThis.groupId,
        prefetch_count: 1,
        benchmark_file_path: '/logs/block_scanner_benchmark-' + oThis.utilityChainId.toString() + '.csv'
      },
      insertParams = {
        id: 3,
        kind: CronProcessesConstants.blockScannerWorker,
        ip_address: '127.0.0.1',
        status: 'stopped',
        group_id: oThis.groupId,
        params: JSON.stringify(params)
      };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 5
  entryForBlockScannerTxDelegator: async function() {
    const oThis = this;

    const params = {
        group_id: oThis.groupId,
        data_file_path:
          '/data/utility-chain-' + oThis.utilityChainId.toString() + '/block_scanner_execute_transaction.data',
        benchmark_file_path: '/logs/block_scanner_benchmark-' + oThis.utilityChainId.toString() + '.csv'
      },
      insertParams = {
        id: 4,
        kind: CronProcessesConstants.blockScannerTxDelegator,
        ip_address: '127.0.0.1',
        status: 'stopped',
        group_id: oThis.groupId,
        params: JSON.stringify(params)
      };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 6
  entryForSendErrorEmails: async function() {
    const insertParams = {
      id: 5,
      kind: CronProcessesConstants.sendErrorEmails,
      ip_address: '127.0.0.1',
      status: 'stopped',
      group_id: null
    };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 10
  entryForUpdateRealtimeGasPrice: async function() {
    const insertParams = {
      id: 6,
      kind: CronProcessesConstants.updateRealtimeGasPrice,
      ip_address: '127.0.0.1',
      status: 'stopped',
      group_id: null
    };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 11
  entryForStartAirdrop: async function() {
    const insertParams = {
      id: 7,
      kind: CronProcessesConstants.startAirdrop,
      ip_address: '127.0.0.1',
      status: 'stopped',
      group_id: null
    };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  },

  // Kind: 14
  entryForTransactionMetaObserver: async function() {
    const oThis = this;

    const params = {
        prefetch_count: 25
      },
      insertParams = {
        id: 8,
        kind: CronProcessesConstants.transactionMetaObserver,
        ip_address: '127.0.0.1',
        status: 'stopped',
        group_id: null,
        params: JSON.stringify(params)
      };

    const obj = new CronProcessesModel();
    await obj.insertRecord(insertParams);
  }
};

const populateCronProcessesObj = new populateCronProcesses();
populateCronProcessesObj.perform();
