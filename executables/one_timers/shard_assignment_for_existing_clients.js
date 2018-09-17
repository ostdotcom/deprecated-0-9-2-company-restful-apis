'use strict';

/**
 * node ./executables/one_timers/shard_assignment_for_existing_clients.js configStrategy_file_path
 * @type {string}
 */
const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  commonValidator = require(rootPrefix + '/lib/validators/common');

require(rootPrefix + '/lib/providers/storage');

const args = process.argv;

function MigrateDataFromDdbShardsToClientConfigStrategies(params) {}

MigrateDataFromDdbShardsToClientConfigStrategies.prototype = {
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
          internal_error_identifier: 'e_drdm_madfdste_1',
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
    const oThis = this;

    let clientIdErc20AddrMapRsp = await oThis._fetchClientIdErc20AddrMap(),
      clientIdErc20AddrMap = clientIdErc20AddrMapRsp.data;

    for (let clientId in clientIdErc20AddrMap) {
      logger.info(` starting for [${clientId}]`);

      let auxilary_data = {},
        configStrategyRsp = await new configStrategyHelper().getConfigStrategy(clientId);

      if (configStrategyRsp.isFailure()) {
        logger.error(`[${clientId}] failed to fetch configStrategyRsp: `, configStrategyRsp.toHash());
        continue;
      }

      let configStrategy = configStrategyRsp.data,
        instanceComposer = new InstanceComposer(configStrategy),
        shardName = configStrategy.OS_DYNAMODB_TABLE_NAME_PREFIX + 'managed_shards',
        storageProvider = instanceComposer.getStorageProvider(),
        openSTStorage = storageProvider.getInstance(),
        ddbServiceObj = openSTStorage.dynamoDBService;

      let transactionLogShardNameRsp = await oThis._fetchDdbDetails(
        shardName,
        ddbServiceObj,
        clientId,
        'transactionLog'
      );

      if (transactionLogShardNameRsp.isFailure() || transactionLogShardNameRsp.data.data.Count === 0) {
        logger.error(`[${clientId}] failed to fetch shard fro transactionLog: `, transactionLogShardNameRsp.toHash());
        continue;
      }

      auxilary_data.TRANSACTION_LOG_SHARD_NAME = transactionLogShardNameRsp.data.data.Items[0].SN.S;

      let clientErc20Address = clientIdErc20AddrMap[clientId].toLowerCase();

      let tokenBalanceShardNameRsp = await oThis._fetchDdbDetails(
        shardName,
        ddbServiceObj,
        clientErc20Address,
        'tokenBalance'
      );

      if (tokenBalanceShardNameRsp.isFailure() || tokenBalanceShardNameRsp.data.data.Count === 0) {
        logger.error(`[${clientId}] failed to fetch shard fro tokenBalance: `, tokenBalanceShardNameRsp.toHash());
        continue;
      }

      auxilary_data.TOKEN_BALANCE_SHARD_NAME = transactionLogShardNameRsp.data.data.Items[0].SN.S;

      logger.debug(`[${clientId}] auxilary_data: `, auxilary_data);

      let configStrategyHelperObj = new configStrategyHelper(),
        strategyIdKindRspArray = await configStrategyHelperObj.getStrategyIdForKind(clientId, 'dynamo');

      if (strategyIdKindRspArray.isFailure()) {
        logger.error(`[${clientId}] failed to fetch which id is to be updated: `, strategyIdKindRspArray.toHash());
        continue;
      }

      if (strategyIdKindRspArray.data.length > 0) {
        let strategyIdKindToUpdate = strategyIdKindRspArray.data[0],
          updateRsp = await new ClientConfigStrategiesModel()
            .update({ auxilary_data: JSON.stringify(auxilary_data) })
            .where(['client_id = ? AND config_strategy_id = ?', clientId, strategyIdKindToUpdate])
            .fire();
      }
    }
  },

  /**
   * Fetches distinct client id and erc20 addr map
   *
   * @returns {Promise<any>}
   * @private
   */
  _fetchClientIdErc20AddrMap: async function() {
    const oThis = this;

    let dbRows = await new ClientBrandedTokenModel()
        .select('client_id,token_erc20_address,airdrop_contract_addr,simple_stake_contract_addr')
        .fire(),
      clientIdErc20AddrMap = {};

    for (let index in dbRows) {
      let dbRow = dbRows[index];

      if (!dbRow.token_erc20_address || !dbRow.airdrop_contract_addr || !dbRow.simple_stake_contract_addr) {
        logger.debug(`ignoring client_id ${dbRow.client_id} as setup not complete`);
        continue;
      }
      clientIdErc20AddrMap[dbRow.client_id] = dbRow.token_erc20_address;
    }

    return Promise.resolve(responseHelper.successWithData(clientIdErc20AddrMap));
  },

  /**
   * This function fetches data from dynamoDB on the basis of entity type and identifier provided.
   * @param identifier ('clientId' or 'erc20Address')
   * @param entityType (tokenBalance or transactionLog)
   * @returns {Promise<any>}
   * @private
   */
  _fetchDdbDetails: async function(shardName, ddbServiceObj, identifier, entityType) {
    const oThis = this;

    let queryParams = { TableName: shardName };

    queryParams.KeyConditionExpression = 'ID=:a and ET=:b';
    queryParams.ExpressionAttributeValues = {
      ':a': { S: String(identifier) },
      ':b': { S: String(entityType) }
    };

    let dDbRsp = await ddbServiceObj.query(queryParams);

    return Promise.resolve(responseHelper.successWithData(dDbRsp));
  }
};

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/one_timers/shard_assignment_for_existing_clients.js');
};

const object = new MigrateDataFromDdbShardsToClientConfigStrategies({});
object
  .perform()
  .then(function(a) {
    process.exit(0);
  })
  .catch(function(a) {
    logger.error(JSON.stringify(a));
    process.exit(1);
  });
