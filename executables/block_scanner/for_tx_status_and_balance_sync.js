'use strict';

/**
 * This block scanner has 2 main responsibilities:
 * 1. Marking the transaction status as mined.
 * 2. Settle the balance credit to the receiver and also settle the delta of pessimistic debit amount and actual debited amount from the sender.
 *
 * Usage: node executables/block_scanner/for_tx_status_and_balance_sync.js processLockId datafilePath group_id [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * processLockId: processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 * datafilePath: path to the file which is storing the last block scanned info.
 * group_id: group_id to fetch config strategy
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/block_scanner/for_tx_status_and_balance_sync
 */

const rootPrefix = '../..';

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/client_config_strategies'),
  ProcessLocker = new ProcessLockerKlass();

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Command line arguments.
const args = process.argv,
  processLockId = args[2],
  datafilePath = args[3],
  group_id = args[4],
  benchmarkFilePath = args[5];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/block_scanner/for_tx_status_and_balance_sync.js processLockId datafilePath group_id [benchmarkFilePath]'
  );
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
  logger.log('* datafilePath is the path to the file which is storing the last block scanned info.');
  logger.log('* group_id is needed to fetch config strategy.');
  logger.log('* benchmarkFilePath is the path to the file which is storing the benchmarking info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!datafilePath) {
    logger.error('Data file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({ process_title: 'executables_block_scanner_execute_transaction_' + processLockId });

const fs = require('fs'),
  abiDecoder = require('abi-decoder'),
  BigNumber = require('bignumber.js'),
  uuid = require('uuid');

const responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  TransactionMeta = require(rootPrefix + '/app/models/transaction_meta'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address');

const BlockScannerForTxStatusAndBalanceSync = function(params) {
  const oThis = this;

  oThis.filePath = params.file_path;
  oThis.benchmarkFilePath = params.benchmark_file_path;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = null;

  oThis.TransferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  oThis.ProcessedMintEventSignature = '0x96989a6b1d8c3bb8d6cc22e14b188b5c14b1f33f34ff07ea2e4fd6d880dac2c7';
  oThis.RevertedMintEventSignature = '0x86e6b95641fbf0f8939eb3da2e7e26aee0188048353d08a45c78218e84cf1d4f';

  oThis.ZeroXAddress = '0x0000000000000000000000000000000000000000';

  oThis.tokenTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.tokenTransferTransactionType];
  oThis.stpTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.stpTransferTransactionType];

  oThis.failedTxStatus = transactionLogConst.invertedStatuses[transactionLogConst.failedStatus];
  oThis.completeTxStatus = transactionLogConst.invertedStatuses[transactionLogConst.completeStatus];
};

BlockScannerForTxStatusAndBalanceSync.prototype = {
  /**
   * Intentional block delay.
   */
  INTENTIONAL_BLOCK_DELAY: 0,

  /**
   * Starts the process of the script with initializing processor.
   */
  init: async function() {
    const oThis = this;

    // Read this from a file.
    oThis.scannerData = JSON.parse(fs.readFileSync(oThis.filePath).toString());

    await oThis.warmUpWeb3Pool();

    oThis.checkForNewBlocks();
  },

  /**
   * Warm up web3 pool.
   */
  warmUpWeb3Pool: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash();

    configStrategy = configStrategyResp.data;
    oThis.ic = new InstanceComposer(configStrategy);

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    for (let i = 0; i < web3PoolSize; i++) {
      web3InteractFactory.getInstance('utility');
    }
  },

  /**
   * Check for new blocks.
   */
  checkForNewBlocks: async function() {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper(),
      platformProvider = oThis.ic.getPlatformProvider(),
      storageProvider = oThis.ic.getStorageProvider(),
      openStPlatform = platformProvider.getInstance(),
      openSTStorage = storageProvider.getInstance(),
      coreAbis = openStPlatform.abis;

    oThis.tokenBalanceModelDdb = openSTStorage.model.TokenBalance;

    abiDecoder.addABI(coreAbis.airdrop);
    abiDecoder.addABI(coreAbis.brandedToken);

    if (oThis.interruptSignalObtained) {
      logger.win('* Exiting Process after interrupt signal obtained.');
      process.exit(1);
    }

    const processNewBlocksAsync = async function() {
      try {
        oThis.initParams();

        await oThis.refreshHighestBlock();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('refreshHighestBlock-' + (Date.now() - oThis.startTime) + 'ms');
        // return if nothing more to do, as of now.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock)
          return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        oThis.currentBlock = 1260559;

        logger.log('Current Block =', oThis.currentBlock);

        let web3Interact = web3InteractFactory.getInstance('utility');

        oThis.currentBlockInfo = await web3Interact.getBlock(oThis.currentBlock);
        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('eth.getBlock-' + (Date.now() - oThis.startTime) + 'ms');

        if (!oThis.currentBlockInfo) return oThis.schedule();

        let promises = [];

        // Categorize the transaction hashes into known (having entry in transaction meta) and unknown.
        promises.push(oThis.categorizeTransactions());

        // For all the transactions in the block, get the receipt.
        promises.push(oThis.getTransactionReceipts());

        await Promise.all(promises);

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push(
            'Categorize transactions and getTransactionReceipts-' + (Date.now() - oThis.startTime) + 'ms'
          );

        await oThis.collectDecodedEvents();
        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('collectDecodedEvents-' + (Date.now() - oThis.startTime) + 'ms');

        // Construct the data to be updated for known transaction.
        await oThis.generateToUpdateDataForKnownTx();
        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('generateToUpdateDataForKnownTx-' + (Date.now() - oThis.startTime) + 'ms');

        // Construct the data to be inserted for unknown transaction.
        let dataToUpdateForUnknownTx = await oThis.generateToUpdateDataForUnKnownTx();
        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('generateToUpdateDataForUnKnownTx-' + (Date.now() - oThis.startTime) + 'ms');

        let clientIdsMap = {};

        // Remove already fetched client ids
        for (let o = 0; o < dataToUpdateForUnknownTx.data.clientIds.length; o++) {
          clientIdsMap[dataToUpdateForUnknownTx.data.clientIds[o]] = 1;
        }
        for (let clientId in oThis.recognizedTxUuidsGroupedByClientId) {
          delete clientIdsMap[clientId];
        }

        if (Object.keys(clientIdsMap) > 0) {
          let ShardMap = await oThis.fetchShardNamesForClients(Object.keys(clientIdsMap));

          Object.assign(oThis.clientIdShardsMap, ShardMap);
        }

        await oThis.updateDataForUnknownTx(dataToUpdateForUnknownTx.data);

        await oThis.updateTransactionLogs();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('updateTransactionLogs-' + (Date.now() - oThis.startTime) + 'ms');

        oThis.updateScannerDataFile();
        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('updateScannerDataFile-' + (Date.now() - oThis.startTime) + 'ms');

        if (oThis.recognizedTxHashes.length !== 0) {
          if (oThis.benchmarkFilePath) {
            oThis.updateBanchmarkFile();
            oThis.granularTimeTaken.push('updateBanchmarkFile-' + (Date.now() - oThis.startTime) + 'ms');
          }
        }

        oThis.schedule();
      } catch (err) {
        logger.error('Exception got:', err);

        if (oThis.interruptSignalObtained) {
          logger.win('* Exiting Process after interrupt signal obtained.');
          process.exit(1);
        } else {
          oThis.reInit();
        }
      }
    };

    await processNewBlocksAsync().catch(function(error) {
      logger.error('executables/block_scanner/base.js::processNewBlocksAsync::catch');
      logger.error(error);

      oThis.schedule();
    });
  },

  /**
   * Init params.
   */
  initParams: function() {
    const oThis = this;

    oThis.startTime = Date.now();
    oThis.tokenTransferTxHashesMap = {};
    oThis.txUuidToPostReceiptProcessParamsMap = {};
    oThis.recognizedTxUuidsGroupedByClientId = {};
    oThis.recognizedTxHashes = [];
    oThis.knownTxUuidToTxHashMap = {};
    oThis.txHashToTxReceiptMap = {};
    oThis.dataToUpdate = [];
    oThis.clientIdsMap = {};
    oThis.unRecognizedTxHashes = [];
    oThis.txHashToDecodedEventsMap = {};
    oThis.addressToDetailsMap = {};

    oThis.granularTimeTaken = [];
  },

  /**
   * Categorize Transactions using transaction_meta table.
   */
  categorizeTransactions: async function() {
    const oThis = this,
      batchSize = 100;

    let batchNo = 1,
      totalBtTransfers = 0,
      totalSTPTransfers = 0;

    // Batch-wise fetch data from transaction_meta table.
    while (true) {
      const offset = (batchNo - 1) * batchSize,
        batchedTxHashes = oThis.currentBlockInfo.transactions.slice(offset, batchSize + offset),
        recognizedTxHashesMap = {};

      batchNo = batchNo + 1;

      if (batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionMeta().getByTransactionHash(
        batchedTxHashes,
        configStrategy.OST_UTILITY_CHAIN_ID
      );

      logger.debug('---------------batchedTxLogRecords-----', batchedTxLogRecords);
      for (let i = 0; i < batchedTxLogRecords.length; i++) {
        const currRecord = batchedTxLogRecords[i];

        recognizedTxHashesMap[currRecord.transaction_hash] = 1;

        if (currRecord.kind == oThis.tokenTransferKind) {
          totalBtTransfers = totalBtTransfers + 1;
          oThis.tokenTransferTxHashesMap[currRecord.transaction_hash] = 1;
          oThis.txUuidToPostReceiptProcessParamsMap[currRecord.transaction_uuid] =
            currRecord.post_receipt_process_params;
        } else if (currRecord.kind == oThis.stpTransferKind) {
          totalSTPTransfers = totalSTPTransfers + 1;
        } else {
          continue;
        }

        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] =
          oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] || [];
        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id].push(currRecord.transaction_uuid);

        oThis.recognizedTxHashes.push(currRecord.transaction_hash);
        oThis.knownTxUuidToTxHashMap[currRecord.transaction_uuid] = currRecord.transaction_hash;
      }

      for (let i = 0; i < batchedTxHashes.length; i++) {
        // If already known transaction, skip here.
        if (recognizedTxHashesMap[batchedTxHashes[i]]) continue;
        oThis.unRecognizedTxHashes.push(batchedTxHashes[i]);
      }
    }

    logger.log('Total BT Transfers:', totalBtTransfers);
    logger.log('Total STP Transfers:', totalSTPTransfers);

    return Promise.resolve();
  },

  getTxReceiptsForBatch: async function(batchedTxHashes) {
    const oThis = this,
      web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    return new Promise(function(onResolve, onReject) {
      const totalCount = batchedTxHashes.length,
        web3InteractFactory = oThis.ic.getWeb3InteractHelper();

      let hasBeenRejected = false,
        count = 0;

      const requestCallback = function(err, result) {
        if (err) {
          if (hasBeenRejected) return;

          hasBeenRejected = true;
          onReject();
        }

        oThis.txHashToTxReceiptMap[result.transactionHash] = result;
        count++;

        if (count === totalCount) {
          onResolve();
        }
      };

      let web3Interact = web3InteractFactory.getInstance('utility'),
        batch = new web3Interact.web3WsProvider.BatchRequest();

      for (let i = 0; i < batchedTxHashes.length; i++) {
        let transactionHash = batchedTxHashes[i];

        let request = web3Interact.web3WsProvider.eth.getTransactionReceipt.request(transactionHash, requestCallback);

        batch.add(request);
      }

      batch.execute();
    });
  },

  /**
   * Get transaction receipt.
   */
  getTransactionReceipts: async function() {
    const oThis = this;

    let batchNo = 1,
      web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE,
      loadPerConnection = parseInt(oThis.currentBlockInfo.transactions.length / web3PoolSize) + 1,
      promiseArray = [];

    loadPerConnection = 30;

    if (loadPerConnection < 5) loadPerConnection = oThis.currentBlockInfo.transactions.length;

    while (true) {
      const offset = (batchNo - 1) * loadPerConnection,
        batchedTxHashes = oThis.currentBlockInfo.transactions.slice(offset, loadPerConnection + offset);

      batchNo = batchNo + 1;

      if (batchedTxHashes.length === 0) break;

      promiseArray.push(oThis.getTxReceiptsForBatch(batchedTxHashes));
    }

    await Promise.all(promiseArray);

    logger.win('* Fetching Tx Receipts DONE');

    return Promise.resolve();
  },

  /**
   * Post airdrop pay
   */
  generateToUpdateDataForKnownTx: async function() {
    const oThis = this,
      batchSize = 25;

    let clients = Object.keys(oThis.recognizedTxUuidsGroupedByClientId);

    oThis.clientIdShardsMap = {};

    if (clients.length > 0) {
      oThis.clientIdShardsMap = await oThis.fetchShardNamesForClients(clients);
    }

    for (let clientId in oThis.recognizedTxUuidsGroupedByClientId) {
      let txUuids = oThis.recognizedTxUuidsGroupedByClientId[clientId],
        batchNo = 1;

      oThis.clientIdsMap[clientId] = 1;

      while (true) {
        const offset = (batchNo - 1) * batchSize,
          batchedTxUuids = txUuids.slice(offset, batchSize + offset),
          promiseArray = [];

        batchNo = batchNo + 1;

        if (batchedTxUuids.length === 0) break;

        for (let txUuidIndex = 0; txUuidIndex < batchedTxUuids.length; txUuidIndex++) {
          let txUuid = batchedTxUuids[txUuidIndex];

          let txHash = oThis.knownTxUuidToTxHashMap[txUuid];
          let txReceipt = oThis.txHashToTxReceiptMap[txHash];

          let toUpdateFields = {},
            eventData = {};

          if (oThis.tokenTransferTxHashesMap[txHash]) {
            const decodedEvents = oThis.txHashToDecodedEventsMap[txHash];

            logger.debug(
              '--111111111111111------oThis.txUuidToPostReceiptProcessParamsMap--',
              oThis.txUuidToPostReceiptProcessParamsMap
            );
            let postAirdropParams = oThis.txUuidToPostReceiptProcessParamsMap[txUuid];

            let shardConfig = oThis.clientIdShardsMap[clientId];

            let finalConfig = oThis.ic.configStrategy;

            Object.assign(finalConfig, shardConfig);

            let instanceComposer = new InstanceComposer(finalConfig),
              paymentsProvider = instanceComposer.getPaymentsProvider(),
              openStPayments = paymentsProvider.getInstance(),
              PostAirdropPayKlass = openStPayments.services.airdropManager.postAirdropPay;

            logger.debug('--111111111111111------postAirdropParams--', postAirdropParams);

            if (postAirdropParams) {
              postAirdropParams = JSON.parse(postAirdropParams);
              const postAirdropPay = new PostAirdropPayKlass(postAirdropParams, decodedEvents, txReceipt.status);
              promiseArray.push(postAirdropPay.perform());
            }

            eventData = await oThis._getEventData(decodedEvents);
            toUpdateFields = {
              commission_amount_in_wei: eventData._commissionTokenAmount,
              amount_in_wei: eventData._tokenAmount,
              airdrop_amount_in_wei: eventData._airdropUsed
            };
          }

          toUpdateFields.transaction_uuid = txUuid;
          if (eventData.transfer_events) {
            toUpdateFields.transfer_events = eventData.transfer_events;
          }
          toUpdateFields.post_receipt_process_params = null;
          toUpdateFields.gas_used = txReceipt.gasUsed;
          toUpdateFields.block_number = txReceipt.blockNumber;
          toUpdateFields.status = txReceipt.status ? oThis.completeTxStatus : oThis.failedTxStatus;

          oThis.dataToUpdate.push({ client_id: clientId, data: toUpdateFields });
        }
        await Promise.all(promiseArray);
      }
    }
  },

  /**
   * Collect decoded events of all transactions.
   */
  collectDecodedEvents: async function() {
    const oThis = this;

    let addressesToFetch = [];

    for (let clientId in oThis.recognizedTxUuidsGroupedByClientId) {
      let txUuids = oThis.recognizedTxUuidsGroupedByClientId[clientId];
      for (let txUuidsInd = 0; txUuidsInd < txUuids.length; txUuidsInd++) {
        let txUuid = txUuids[txUuidsInd],
          txHash = oThis.knownTxUuidToTxHashMap[txUuid],
          txReceipt = oThis.txHashToTxReceiptMap[txHash];

        if (oThis.tokenTransferTxHashesMap[txHash]) {
          let decodedEvents = abiDecoder.decodeLogs(txReceipt.logs);
          oThis.txHashToDecodedEventsMap[txHash] = decodedEvents;

          for (let i = 0; i < decodedEvents.length; i++) {
            let decodedEvent = decodedEvents[i];
            if (decodedEvent.name === 'Transfer') {
              for (let j = 0; j < decodedEvent.events.length; j++) {
                let finalEvent = decodedEvent.events[j];
                if (['_from', '_to'].includes(finalEvent.name)) {
                  addressesToFetch.push(finalEvent.value);
                }
              }
            }
          }
        }
      }
    }

    if (addressesToFetch.length > 0) {
      //uniq addressesToFetch array.
      const uSet = new Set(addressesToFetch),
        qBatchSize = 100;
      addressesToFetch = [...uSet];

      let batchNo = 1;

      while (true) {
        const offset = (batchNo - 1) * qBatchSize,
          addressesToFetchSet = addressesToFetch.slice(offset, qBatchSize + offset);

        batchNo = batchNo + 1;

        if (addressesToFetchSet.length === 0) break;

        const managedAddressResults = await new ManagedAddressModel().getByEthAddresses(addressesToFetchSet);

        for (let i = 0; i < managedAddressResults.length; i++) {
          let managedAddressRow = managedAddressResults[i];
          oThis.addressToDetailsMap[managedAddressRow.ethereum_address.toLowerCase()] = managedAddressRow;
        }
      }
    }
  },

  /**
   * Generate to update data for unrecognized transaction if it belongs to us.
   */
  generateToUpdateDataForUnKnownTx: async function() {
    const oThis = this,
      eventGeneratingContractAddresses = [],
      txHashToShortListedEventsMap = {},
      Erc20ContractAddressCacheKlass = oThis.ic.getErc20ContractAddressCache();

    let erc20ContractAddressesData = {},
      erc20ContractAddressClientIdMap = {},
      clientIds = [];

    for (let i = 0; i < oThis.unRecognizedTxHashes.length; i++) {
      let txHash = oThis.unRecognizedTxHashes[i],
        txReceipt = oThis.txHashToTxReceiptMap[txHash];

      for (let j = 0; j < txReceipt.logs.length; j++) {
        eventGeneratingContractAddresses.push(txReceipt.logs[j].address);
      }
    }

    if (eventGeneratingContractAddresses.length > 0) {
      // from these addresses create a map of addresses of which are ERC20 address
      let cacheObj = new Erc20ContractAddressCacheKlass({
          addresses: eventGeneratingContractAddresses,
          chain_id: configStrategy.OST_UTILITY_CHAIN_ID
        }),
        cacheFetchRsp = await cacheObj.fetch();
      if (cacheFetchRsp.isFailure()) {
        return Promise.reject(cacheFetchRsp);
      }
      erc20ContractAddressesData = cacheFetchRsp.data;
    }

    for (let i = 0; i < oThis.unRecognizedTxHashes.length; i++) {
      let txHash = oThis.unRecognizedTxHashes[i];
      let txReceipt = oThis.txHashToTxReceiptMap[txHash];

      for (let j = 0; j < txReceipt.logs.length; j++) {
        let txReceiptLogElement = txReceipt.logs[j],
          contractAddress = txReceiptLogElement.address.toLowerCase(),
          eventSignature = txReceiptLogElement.topics[0],
          knownBTContractData = erc20ContractAddressesData[contractAddress],
          isTransferEvent = eventSignature === oThis.TransferEventSignature;

        if (knownBTContractData && isTransferEvent) {
          txHashToShortListedEventsMap[txHash] = txHashToShortListedEventsMap[txHash] || [];
          txHashToShortListedEventsMap[txHash].push(txReceiptLogElement);
          clientIds.push(knownBTContractData['client_id']);
          erc20ContractAddressClientIdMap[contractAddress] = knownBTContractData['client_id'];
        }
      }
    }

    let txHashDecodedEventsMap = await oThis._decodeTransactionEvents(txHashToShortListedEventsMap);

    let balanceAdjustmentRsp = await oThis._computeBalanceAdjustments(
      txHashDecodedEventsMap,
      erc20ContractAddressesData
    );
    let balanceAdjustmentMap = balanceAdjustmentRsp['balanceAdjustmentMap'],
      txHashTransferEventsMap = balanceAdjustmentRsp['txHashTransferEventsMap'],
      affectedAddresses = balanceAdjustmentRsp['affectedAddresses'];

    // format data to be inserted into transaction logs
    let params = {
      blockNoDetailsMap: oThis.currentBlockInfo,
      txHashToTxReceiptMap: oThis.txHashToTxReceiptMap,
      erc20ContractAddressesData: erc20ContractAddressesData,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses
    };

    let formattedTransactionsData = await oThis._fetchFormattedTransactionsForMigration(params);

    return Promise.resolve(
      responseHelper.successWithData({
        formattedTransactionsData: formattedTransactionsData,
        balanceAdjustmentMap: balanceAdjustmentMap,
        erc20ContractAddressClientIdMap: erc20ContractAddressClientIdMap,
        clientIds: clientIds
      })
    );
  },

  /**
   * decode events. returns map with key as txHash and value as array of decoded events
   *
   * @returns {promise<result>}
   */
  _decodeTransactionEvents: async function(txHashEventsMap) {
    const oThis = this;

    logger.info('starting _decodeTransactionEvents');

    // Decode events from AbiDecoder
    let txHashDecodedEventsMap = {},
      txHashes = Object.keys(txHashEventsMap);

    for (let i = 0; i < txHashes.length; i++) {
      let txHash = txHashes[i];
      txHashDecodedEventsMap[txHash] = abiDecoder.decodeLogs(txHashEventsMap[txHash]);
    }

    logger.info('completed _decodeTransactionEvents');

    return txHashDecodedEventsMap;
  },

  /**
   * Fetch shard names for given clients
   *
   * @returns {promise<result>}
   */
  fetchShardNamesForClients: async function(clientIds) {
    const oThis = this,
      clientConfigStrategyCacheObj = new configStrategyCacheKlass({ clientIds: clientIds }),
      strategiesFetchRsp = await clientConfigStrategyCacheObj.fetch(),
      clientIdShardsMap = {};

    if (strategiesFetchRsp.isFailure()) {
      return Promise.reject(strategiesFetchRsp);
    }

    for (let clientId in strategiesFetchRsp.data) {
      clientIdShardsMap[parseInt(clientId)] = strategiesFetchRsp.data[clientId]['shard_names'];
    }

    return Promise.resolve(clientIdShardsMap);
  },

  /**
   * update transaction logs and settle balances in Db
   *
   * @returns {promise<result>}
   */
  updateDataForUnknownTx: async function(unknownTxsData) {
    const oThis = this;

    await oThis._insertDataInTransactionLogs(unknownTxsData.formattedTransactionsData);

    await oThis._settleBalancesInDb(unknownTxsData);
  },

  /**
   * Update transaction logs table
   */
  updateTransactionLogs: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic.getTransactionLogModel();

    logger.debug('-------oThis.clientIdsMap----', oThis.clientIdsMap);

    if (Object.keys(oThis.clientIdsMap).length === 0) return {};

    logger.debug('-------oThis.dataToUpdate----', oThis.dataToUpdate);

    let promiseArray = [],
      batchNo = 1,
      dynamoQueryBatchSize = 500,
      clientIdToTxLogModelObjectMap = {};

    while (true) {
      let offset = (batchNo - 1) * dynamoQueryBatchSize,
        batchedData = oThis.dataToUpdate.slice(offset, dynamoQueryBatchSize + offset);

      if (batchedData.length === 0) break;

      for (let i = 0; i < batchedData.length; i++) {
        let toProcessData = batchedData[i],
          clientId = toProcessData.client_id,
          shardName = oThis.clientIdShardsMap[clientId].TRANSACTION_LOG_SHARD_NAME;

        clientIdToTxLogModelObjectMap[clientId] =
          clientIdToTxLogModelObjectMap[clientId] ||
          new transactionLogModel({
            client_id: clientId,
            shard_name: shardName
          });

        promiseArray.push(clientIdToTxLogModelObjectMap[clientId].updateItem(toProcessData.data));
      }

      await Promise.all(promiseArray);

      // Resetting batch iteration variables.
      promiseArray = [];
      batchNo = batchNo + 1;
    }
  },

  /**
   * Register interrupt signal handlers
   */
  registerInterruptSignalHandlers: function() {
    const oThis = this;

    process.on('SIGINT', function() {
      logger.win('* Received SIGINT. Signal registerred.');
      oThis.interruptSignalObtained = true;
    });

    process.on('SIGTERM', function() {
      logger.win('* Received SIGTERM. Signal registerred.');
      oThis.interruptSignalObtained = true;
    });
  },

  /**
   * Schedule
   */
  schedule: function() {
    const oThis = this;

    // if the current block is far behind the highest block, schedule for 10 ms otherwise schedule for 2 s
    const waitInterval =
      oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock ? 2000 : 10;

    logger.win('* Scheduled checkForNewBlocks after', waitInterval / 1000.0, 'seconds.');

    logger.log('------------------------------------------------');

    setTimeout(function() {
      oThis.checkForNewBlocks();
    }, waitInterval);
  },

  /**
   * Re init
   */
  reInit: function() {
    const oThis = this;

    setTimeout(function() {
      oThis.init();
    }, 1000);
  },

  /**
   * Update scanner data file
   */
  updateScannerDataFile: function() {
    const oThis = this;

    oThis.scannerData.lastProcessedBlock = oThis.currentBlock;

    fs.writeFileSync(oThis.filePath, JSON.stringify(oThis.scannerData), function(err) {
      if (err) logger.error(err);
    });

    logger.win('* Updated last processed block = ', oThis.scannerData.lastProcessedBlock);

    if (oThis.interruptSignalObtained) {
      logger.win('* Exiting Process after interrupt signal obtained.');
      process.exit(1);
    }
  },

  /**
   * Update executation statistics to benchmark file.
   */
  updateBanchmarkFile: function() {
    const oThis = this;
    const benchmarkData = [
      oThis.currentBlock,
      oThis.currentBlockInfo.transactions.length,
      oThis.recognizedTxHashes.length,
      oThis.unRecognizedTxHashes.length
    ];

    fs.appendFileSync(oThis.benchmarkFilePath, benchmarkData.concat(oThis.granularTimeTaken).join(',') + '\n', function(
      err
    ) {
      if (err) logger.error(err);
    });
  },

  /**
   * Get highest block
   */
  refreshHighestBlock: async function() {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3Interact = web3InteractFactory.getInstance('utility');

    oThis.highestBlock = await web3Interact.getBlockNumber();

    logger.win('* Obtained highest block:', oThis.highestBlock);

    return Promise.resolve();
  },

  /**
   * Get event data
   */
  _getEventData: async function(decodedEvents) {
    const oThis = this;
    const eventData = { _tokenAmount: '0', _commissionTokenAmount: '0', _airdropUsed: '0', transfer_events: [] };

    if (!decodedEvents || decodedEvents.length === 0) {
      return eventData;
    }

    let airdropPaymentEventVars = null,
      allTransferEventsVars = [];

    for (let i = 0; i < decodedEvents.length; i++) {
      if (decodedEvents[i].name === 'AirdropPayment') {
        airdropPaymentEventVars = decodedEvents[i].events;
      }
      if (decodedEvents[i].name === 'Transfer') {
        allTransferEventsVars.push(decodedEvents[i].events);
      }
    }

    airdropPaymentEventVars = airdropPaymentEventVars || [];
    for (let i = 0; i < airdropPaymentEventVars.length; i++) {
      if (airdropPaymentEventVars[i].name === '_commissionTokenAmount') {
        eventData._commissionTokenAmount = airdropPaymentEventVars[i].value;
      }

      if (airdropPaymentEventVars[i].name === '_tokenAmount') {
        eventData._tokenAmount = airdropPaymentEventVars[i].value;
      }

      if (airdropPaymentEventVars[i].name === '_airdropUsed') {
        eventData._airdropUsed = airdropPaymentEventVars[i].value;
      }
    }

    logger.debug('---------------------------allTransferEventsVars------', allTransferEventsVars);

    for (let i = 0; i < allTransferEventsVars.length; i++) {
      let transferEventVars = allTransferEventsVars[i];

      let transferEvent = {};

      for (let j = 0; j < transferEventVars.length; j++) {
        if (transferEventVars[j].name === '_from') {
          transferEvent.from_address = transferEventVars[j].value;
          if (oThis.addressToDetailsMap[transferEvent.from_address.toLowerCase()]) {
            transferEvent.from_uuid = oThis.addressToDetailsMap[transferEvent.from_address.toLowerCase()].uuid;
          }
        }

        if (transferEventVars[j].name === '_to') {
          transferEvent.to_address = transferEventVars[j].value;
          if (oThis.addressToDetailsMap[transferEvent.to_address.toLowerCase()]) {
            transferEvent.to_uuid = oThis.addressToDetailsMap[transferEvent.to_address.toLowerCase()].uuid;
          }
        }

        if (transferEventVars[j].name === '_value') {
          transferEvent.amount_in_wei = transferEventVars[j].value;
        }
      }

      eventData.transfer_events.push(transferEvent);
    }

    return eventData;
  },

  /**
   * Computes balance adjustment map. Returns map with key as contract address and value as a map
   * which has key as user_eth_address and value as amount to be adjusted.
   *
   * @returns {promise<result>}
   */
  _computeBalanceAdjustments: async function(txHashDecodedEventsMap, erc20ContractAddressesData) {
    const oThis = this;

    logger.info('starting _computeBalanceAdjustments');

    let balanceAdjustmentMap = {},
      txHashTransferEventsMap = {},
      affectedAddresses = [],
      txHashes = Object.keys(txHashDecodedEventsMap);

    for (let k = 0; k < txHashes.length; k++) {
      let txHash = txHashes[k];

      let decodedEventsMap = txHashDecodedEventsMap[txHash],
        transferEvents = [];

      for (let i = 0; i < decodedEventsMap.length; i++) {
        let decodedEventData = decodedEventsMap[i],
          contractAddress = decodedEventData.address.toLowerCase();

        let fromAddr = null,
          toAddr = null,
          valueStr = null;

        for (let j = 0; j < decodedEventData.events.length; j++) {
          let eventData = decodedEventData.events[j];
          switch (eventData.name) {
            case '_from': // Case "_staker":
              fromAddr = eventData.value.toLowerCase();
              break;
            case '_to': // Case "_beneficiary":
              toAddr = eventData.value.toLowerCase();
              break;
            case '_value':
              valueStr = eventData.value;
              break;
          }
        }

        transferEvents.push({
          from_address: fromAddr,
          to_address: toAddr,
          amount_in_wei: valueStr
        });

        if (fromAddr === contractAddress) {
          // If from == contract, this tx event is then of claim by beneficiary. This was credited by platform so ignore here.
          continue;
        }

        let valueBn = new BigNumber(valueStr);
        balanceAdjustmentMap[contractAddress] = balanceAdjustmentMap[contractAddress] || {};

        if (fromAddr) {
          balanceAdjustmentMap[contractAddress][fromAddr] = balanceAdjustmentMap[contractAddress][fromAddr] || {
            settledBalance: new BigNumber('0'),
            unSettledDebit: new BigNumber('0')
          };
          balanceAdjustmentMap[contractAddress][fromAddr].settledBalance = balanceAdjustmentMap[contractAddress][
            fromAddr
          ].settledBalance.minus(valueBn);
          // TODO: This is being happening for unrecognized, but this can happen outside SaaS also
          balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit = balanceAdjustmentMap[contractAddress][
            fromAddr
          ].unSettledDebit.minus(valueBn);
          // if(!claimDone){
          //   balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit = balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit.minus(valueBn);
          // }
          affectedAddresses.push(fromAddr);
        }

        if (toAddr) {
          balanceAdjustmentMap[contractAddress][toAddr] = balanceAdjustmentMap[contractAddress][toAddr] || {
            settledBalance: new BigNumber('0'),
            unSettledDebit: new BigNumber('0')
          };
          balanceAdjustmentMap[contractAddress][toAddr].settledBalance = balanceAdjustmentMap[contractAddress][
            toAddr
          ].settledBalance.plus(valueBn);
          affectedAddresses.push(toAddr);
        }
      }

      txHashTransferEventsMap[txHash] = transferEvents;

      // uniq!
      affectedAddresses = affectedAddresses.filter(function(item, pos) {
        return affectedAddresses.indexOf(item) === pos;
      });
    }

    logger.info('completed _computeBalanceAdjustments');

    return {
      balanceAdjustmentMap: balanceAdjustmentMap,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses
      // doClaimTransferEventData: doClaimTransferEventData
    };
  },

  /**
   * From all the data we have fetched till now, format it to a format which could be directly inserted in DDB.
   *
   * @returns {promise<result>}
   */
  _fetchFormattedTransactionsForMigration: async function(params) {
    logger.debug('-1111--------------------params---', params);
    logger.info('starting _fetchFormattedTransactionsForMigration');

    let blockNoDetails = params['blockNoDetailsMap'],
      txHashToTxReceiptMap = params['txHashToTxReceiptMap'],
      erc20ContractAddressesData = params['erc20ContractAddressesData'],
      txHashTransferEventsMap = params['txHashTransferEventsMap'],
      affectedAddresses = params['affectedAddresses'],
      addressUuidMap = {},
      formattedTransactionsData = {},
      completeStatus = parseInt(transactionLogConst.invertedStatuses[transactionLogConst.completeStatus]),
      failedStatus = parseInt(transactionLogConst.invertedStatuses[transactionLogConst.failedStatus]),
      tokenTransferType = parseInt(
        transactionLogConst.invertedTransactionTypes[transactionLogConst.externalTokenTransferTransactionType]
      );

    logger.debug('-2222--------------------addressUuidMap---', addressUuidMap);
    if (affectedAddresses.length > 0) {
      let dbRows = await new ManagedAddressModel().getByEthAddresses(affectedAddresses);
      for (let i = 0; i < dbRows.length; i++) {
        let dbRow = dbRows[i];
        addressUuidMap[dbRow['ethereum_address'].toLowerCase()] = dbRow['uuid'];
      }
    }

    logger.debug('-3333--------------------addressUuidMap---', addressUuidMap);
    let txHashes = Object.keys(txHashTransferEventsMap);

    for (let i = 0; i < txHashes.length; i++) {
      let txHash = txHashes[i],
        txFormattedData = {},
        txDataFromChain = txHashToTxReceiptMap[txHash];

      let contractAddress = txDataFromChain.logs[0].address,
        erc20ContractAddressData = erc20ContractAddressesData[contractAddress.toLowerCase()];

      if (!erc20ContractAddressData) {
        // As we are also processing mint events, they wouldn't have client id.
        // They should only be used to adjust balances but not insert here.
        continue;
      }

      txFormattedData = {
        transaction_hash: txHash,
        transaction_uuid: uuid.v4(),
        transaction_type: tokenTransferType,
        block_number: txDataFromChain['blockNumber'],
        client_id: parseInt(erc20ContractAddressData['client_id']),
        client_token_id: parseInt(erc20ContractAddressData['client_token_id']),
        token_symbol: erc20ContractAddressData['symbol'],
        gas_used: txDataFromChain['gasUsed'],
        status: txDataFromChain.status ? completeStatus : failedStatus,
        created_at: blockNoDetails['timestamp'],
        updated_at: blockNoDetails['timestamp'],
        from_address: txDataFromChain['from'],
        to_address: txDataFromChain['to']
      };

      let fromUuid = addressUuidMap[txDataFromChain['from'].toLowerCase()];
      if (!commonValidator.isVarNull(fromUuid)) {
        txFormattedData['from_uuid'] = fromUuid;
      }

      let toUuid = addressUuidMap[txDataFromChain['to'].toLowerCase()];
      if (!commonValidator.isVarNull(toUuid)) {
        txFormattedData['to_uuid'] = toUuid;
      }

      if (txHashTransferEventsMap[txHash]) {
        txFormattedData['transfer_events'] = txHashTransferEventsMap[txHash];
        for (let j = 0; j < txFormattedData['transfer_events'].length; j++) {
          let event_data = txFormattedData['transfer_events'][j];
          let fromUuid = addressUuidMap[event_data['from_address']];
          if (!commonValidator.isVarNull(fromUuid)) {
            event_data['from_uuid'] = fromUuid;
          }
          let toUuid = addressUuidMap[event_data['to_address']];
          if (!commonValidator.isVarNull(toUuid)) {
            event_data['to_uuid'] = toUuid;
          }
        }
      }

      // Group data by client_ids so that they can be batch inserted in ddb.
      formattedTransactionsData[txFormattedData['client_id']] =
        formattedTransactionsData[txFormattedData['client_id']] || [];

      formattedTransactionsData[txFormattedData['client_id']].push(txFormattedData);
    }

    logger.info('completed _fetchFormattedTransactionsForMigration');

    return Promise.resolve(formattedTransactionsData);
  },

  /**
   * Bulk create records in DDB.
   *
   * @returns {promise<result>}
   */
  _insertDataInTransactionLogs: async function(formattedTransactionsData) {
    const oThis = this,
      transactionLogModel = oThis.ic.getTransactionLogModel();

    logger.info('starting _insertDataInTransactionLogs');

    let clientIds = Object.keys(formattedTransactionsData);

    for (let k = 0; k < clientIds.length; k++) {
      let clientId = clientIds[k],
        dataToInsert = formattedTransactionsData[clientId];

      logger.info(`starting _insertDataInTransactionLogs clientId : ${clientId} length : ${dataToInsert.length}`);

      let rsp = await new transactionLogModel({
        client_id: clientId,
        shard_name: oThis.clientIdShardsMap[clientId].TRANSACTION_LOG_SHARD_NAME
      }).batchPutItem(dataToInsert, 10);
    }

    logger.info('completed _insertDataInTransactionLogs');

    return Promise.resolve({});
  },

  /**
   * Settle balances in DB.
   *
   * @returns {promise<result>}
   */
  _settleBalancesInDb: async function(unknownTxsData) {
    const oThis = this;

    logger.info('starting _settleBalancesInDb');

    console.log('clientIdShardsMap2', oThis.clientIdShardsMap);

    let erc20ContractAddresses = Object.keys(unknownTxsData.balanceAdjustmentMap),
      erc20ContractAddressClientIdMap = unknownTxsData.erc20ContractAddressClientIdMap;

    for (let k = 0; k < erc20ContractAddresses.length; k++) {
      let erc20ContractAddress = erc20ContractAddresses[k];

      let clientId = erc20ContractAddressClientIdMap[erc20ContractAddress];

      let userBalancesSettlementsData = unknownTxsData.balanceAdjustmentMap[erc20ContractAddress],
        tokenBalanceModelObj = new oThis.tokenBalanceModelDdb({
          erc20_contract_address: erc20ContractAddress,
          chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
          shard_name: oThis.clientIdShardsMap[clientId].TOKEN_BALANCE_SHARD_NAME
        }),
        promises = [],
        userAddresses = Object.keys(userBalancesSettlementsData);

      for (let l = 0; l < userAddresses.length; l++) {
        let userAddress = userAddresses[l],
          settledAmountDelta = userBalancesSettlementsData[userAddress].settledBalance,
          unsettledDebitDelta = userBalancesSettlementsData[userAddress].unSettledDebit || '0';

        promises.push(
          tokenBalanceModelObj
            .update({
              settle_amount: settledAmountDelta.toString(10),
              un_settled_debit_amount: unsettledDebitDelta.toString(10),
              ethereum_address: userAddress
            })
            .catch(oThis.catchHandlingFunction)
        );
      }

      await Promise.all(promises);
    }

    logger.info('completed _settleBalancesInDb');

    return Promise.resolve({});
  },

  /**
   * Generic function to handle catch blocks
   *
   * @returns {object}
   */
  catchHandlingFunction: async function(error) {
    if (responseHelper.isCustomResult(error)) {
      const errorData = error.toDebugHash();
      if (
        errorData.err.debugOptions &&
        errorData.err.debugOptions.error &&
        errorData.err.debugOptions.error.code !== 'ConditionalCheckFailedException'
      ) {
        logger.notify(errorData.err.debugOptions);
      } else {
        logger.error(error.toDebugHash());
      }
      return error;
    } else {
      logger.error(`${__filename}::perform::catch`);
      logger.error(error);
      return responseHelper.error({
        internal_error_identifier: 'e_drdm_mdfctb_2',
        api_error_identifier: 'something_went_wrong',
        debug_options: {},
        error_config: errorConfig
      });
    }
  }
};

const blockScannerObj = new BlockScannerForTxStatusAndBalanceSync({
  file_path: datafilePath,
  benchmark_file_path: benchmarkFilePath
});
blockScannerObj.registerInterruptSignalHandlers();
blockScannerObj.init().then(function(r) {
  logger.win('Blockscanner Started');
});

// InstanceComposer.register(BlockScannerForTxStatusAndBalanceSync, 'getBlockScannerForTxStatusAndBalanceSync', true);
