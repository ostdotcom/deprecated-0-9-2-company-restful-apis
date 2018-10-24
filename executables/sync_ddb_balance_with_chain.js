'use strict';

/**
 * This script is used to synchronize DynamoDB balances with Chain.
 * In case DDB balances are messed up, we can sync these balances with actual chain balances.
 *
 * You can compare and find mismatched balances from this script: executables/check_balances.js
 *
 * Usage: node executables/sync_ddb_balance_with_chain.js group_id
 *
 * Command Line Parameters Description:
 * group_id: Group id for fetching the config strategy
 *
 * It takes erc20 address to ethereum adresses map as input params
 *
 * @module executables/sync_ddb_balance_with_chain
 */

const rootPrefix = '..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');

const args = process.argv,
  group_id = args[2];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log('usage:', 'node ./executables/sync_ddb_balance_with_chain.js group_id');
  logger.log('* grou_id is required to fetch config strategy');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!group_id) {
    logger.error('Group id is not passed in the input');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 *
 * @constructor
 *
 */
const SyncDdbBalancesWithChain = function(erc20AddressToAdressesMap) {
  const oThis = this;

  oThis.erc20AddressToAdressesMap = erc20AddressToAdressesMap;
};

SyncDdbBalancesWithChain.prototype = {
  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'e_drdm_sdbwc_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  asyncPerform: async function() {
    const oThis = this,
      erc20Addresses = Object.keys(oThis.erc20AddressToAdressesMap);

    for (let i = 0; i < erc20Addresses.length; i++) {
      let erc20Address = erc20Addresses[i];

      await oThis._syncForClient(erc20Address, oThis.erc20AddressToAdressesMap[erc20Address]);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * for a client would check balances
   *
   * @returns {promise}
   */
  _syncForClient: async function(erc20Address, userAddresses) {
    const oThis = this;

    let strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data;

    const batchSize = 25,
      ic = new InstanceComposer(configStrategy),
      platformProvider = ic.getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      getBrandedTokenBalanceKlass = openSTPlaform.services.balance.brandedTokenFromChain,
      storageProvider = ic.getStorageProvider(),
      openSTStorage = storageProvider.getInstance(),
      TokenBalanceModel = openSTStorage.model.TokenBalance,
      Erc20ContractAddressCacheKlass = ic.getErc20ContractAddressCache();

    let cacheObj = new Erc20ContractAddressCacheKlass({
        addresses: [erc20Address],
        chain_id: configStrategy.OST_UTILITY_CHAIN_ID
      }),
      cacheFetchRsp = await cacheObj.fetch();

    if (cacheFetchRsp.isFailure()) {
      return Promise.reject(cacheFetchRsp);
    }

    let erc20ContractAddressesData = cacheFetchRsp.data,
      knownBTContractData = erc20ContractAddressesData[erc20Address],
      clientId = knownBTContractData['client_id'];

    let configStrategyHashRsp = await new configStrategyHelper(clientId).get(),
      configStrategyHash = configStrategyHashRsp.data,
      shardName = configStrategyHash.TOKEN_BALANCE_SHARD_NAME;

    logger.info(`params: client_id: ${clientId}, shard_name: ${shardName}, erc20_address: ${erc20Address}`);

    let batchNo = 1,
      tokenBalanceObj = new TokenBalanceModel({
        erc20_contract_address: erc20Address,
        shard_name: shardName
      });

    while (true) {
      let offset = (batchNo - 1) * batchSize,
        batchedUserAddresses = userAddresses.slice(offset, batchSize + offset);

      if (batchedUserAddresses.length === 0) break;

      let promises = [];

      for (let i = 0; i < batchedUserAddresses.length; i++) {
        let promise = new getBrandedTokenBalanceKlass({
          address: batchedUserAddresses[i],
          erc20_address: erc20Address,
          use_cache: 0
        }).perform();
        promises.push(promise);
      }

      let promiseResponses = await Promise.all(promises);

      for (let i = 0; i < batchedUserAddresses.length; i++) {
        let updateData = {
          ethereum_address: batchedUserAddresses[i],
          settle_amount: promiseResponses[i].data.balance,
          un_settled_debit_amount: '0',
          pessimistic_settled_balance: promiseResponses[i].data.balance
        };
        let updateRsp = await tokenBalanceObj.set(updateData);

        logger.info('updateData', updateData);
        logger.info('updateRsp', updateRsp.toHash());
      }

      batchNo = batchNo + 1;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

// const jsonStr = '{"0x4F739d40dB7509Fac8789a9Ff7bd3f86132738E2":["0xdcb2ec51c8c4632ae0039befef861fd1de2cd616","0xb9f6d4c885e8653f66fbf4f1a87d2db0835c70e8","0x16b8e5c5cf4532969746d9c97c5c233b3647c105","0x06c18b69b13b38a2ed0d0c1146c2ed340ed4e7e5","0x8837741e2ede243927679e2b9c290243140dafc7","0x8187f120d3d2aa0fd32df04bc1cf8a148beadf1f","0x924efb75845b8a5b93e00f864391894360315bdb","0x79f720d773619edea6aa91ce9553983bf36ce87f","0xab3e3db1362b2b91663b22ff277f039eaf1b8cdb","0xfec3033dd1e9de348e13169ed7c53dd6e03b28a1","0xb5c0d3fc77ec5422c0a16cdf652c764d29df5961","0x53dd4f876e922877ba57921ee2f8200bc4ce9963","0x1cb5860593729a7ff4d0ca7d0bc101a4544b19a9"]}';
const erc20AddressToAdressesMapStr =
  '{"0x8a5a8cf3913d6886053d2e7217e13d26decd00d6": ["0x88fc4c810b9d83ffff4a791a484e8003905aae97","0x3fe697ff4655288086864492f1307eef32979b76"]}';
const object = new SyncDdbBalancesWithChain(JSON.parse(erc20AddressToAdressesMapStr));
object
  .perform()
  .then(function(a) {
    logger.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    logger.log(a);
    process.exit(1);
  });
