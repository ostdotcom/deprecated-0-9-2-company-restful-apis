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

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path),
  instanceComposer = new InstanceComposer(configStrategy),
  shardName = configStrategy.OS_DYNAMODB_TABLE_NAME_PREFIX + 'managed_shards',
  storageProvider = instanceComposer.getStorageProvider(),
  openSTStorage = storageProvider.getInstance(),
  ddbServiceObj = openSTStorage.dynamoDBService;

function MigrateDataFromDdbShardsToClientConfigStrategies(params) {
  const oThis = this;

  oThis.shardName = params.shard_name;
}

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

    let distinctClientIdsRsp = await oThis._fetchClientIds(),
      distinctClientIds = distinctClientIdsRsp.data;

    for (let id in distinctClientIds) {
      let clientId = distinctClientIds[id],
        auxilary_data = {},
        clientErc20Address = null;

      let transactionLogShardNameRsp = await oThis._fetchDdbDetails(clientId, 'transactionLog');

      if (transactionLogShardNameRsp.isFailure() || transactionLogShardNameRsp.data.data.Count === 0) {
        continue;
      }

      auxilary_data.TRANSACTION_LOG_SHARD_NAME = transactionLogShardNameRsp.data.data.Items[0].SN.S;

      let clientErc20AddressRsp = await oThis._fetchErc20Address(clientId);

      if (clientErc20AddressRsp.data.length === 0) {
        continue;
      }

      clientErc20Address = clientErc20AddressRsp.data[0].toLowerCase();

      let tokenBalanceShardNameRsp = await oThis._fetchDdbDetails(clientErc20Address, 'tokenBalance');

      if (transactionLogShardNameRsp.isFailure() || tokenBalanceShardNameRsp.data.data.Count === 0) {
        continue;
      }

      auxilary_data.TOKEN_BALANCE_SHARD_NAME = transactionLogShardNameRsp.data.data.Items[0].SN.S;

      let configStrategyHelperObj = new configStrategyHelper(),
        strategyIdKindRspArray = await configStrategyHelperObj.getStrategyIdForKind(clientId, 'dynamo'),
        finalAuxilaryDataToInsert = JSON.stringify(auxilary_data);

      if (strategyIdKindRspArray.isFailure()) {
        continue;
      }

      if (strategyIdKindRspArray.data.length > 0) {
        let strategyIdKindToUpdate = strategyIdKindRspArray.data[0],
          insertRsp = await new ClientConfigStrategiesModel()
            .update({ auxilary_data: finalAuxilaryDataToInsert })
            .where(['client_id = ? AND config_strategy_id = ?', clientId, strategyIdKindToUpdate])
            .fire();
      }
    }
  },

  /**
   * Fetches distinct client ids present in the client config strategies table.
   *
   * @returns {Promise<any>}
   * @private
   */
  _fetchClientIds: async function() {
    const oThis = this;

    let clientIdsResponse = await new ClientConfigStrategiesModel()
        .select(['client_id'])
        .group_by(['client_id'])
        .fire(),
      distinctClientIds = [];

    for (let id in clientIdsResponse) {
      distinctClientIds.push(clientIdsResponse[id].client_id);
    }

    return Promise.resolve(responseHelper.successWithData(distinctClientIds));
  },

  /**
   * This function fetches data from dynamoDB on the basis of entity type and identifier provided.
   * @param identifier ('clientId' or 'erc20Address')
   * @param entityType (tokenBalance or transactionLog)
   * @returns {Promise<any>}
   * @private
   */
  _fetchDdbDetails: async function(identifier, entityType) {
    const oThis = this;

    let queryParams = { TableName: oThis.shardName };

    queryParams.KeyConditionExpression = 'ID=:a and ET=:b';
    queryParams.ExpressionAttributeValues = {
      ':a': { S: String(identifier) },
      ':b': { S: String(entityType) }
    };

    let dDbRsp = await ddbServiceObj.query(queryParams);

    return Promise.resolve(responseHelper.successWithData(dDbRsp));
  },

  _fetchErc20Address: async function(client_id) {
    let clientBrandedTokenRsp = await new ClientBrandedTokenModel()
        .select(['token_erc20_address'])
        .where(['client_id = ?', client_id])
        .fire(),
      erc20address = [];

    if (clientBrandedTokenRsp.length > 0) {
      erc20address.push(clientBrandedTokenRsp[0].token_erc20_address);
    }

    return Promise.resolve(responseHelper.successWithData(erc20address));
  }
};

const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/one_timers/shard_assignment_for_existing_clients.js configStrategy_file_path'
  );
};

const validateAndSanitize = function() {
  if (commonValidator.isVarNull(config_file_path)) {
    logger.error('config strategy file path is NOT present in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const object = new MigrateDataFromDdbShardsToClientConfigStrategies({ shard_name: shardName });
object
  .perform()
  .then(function(a) {
    process.exit(0);
  })
  .catch(function(a) {
    logger.error(JSON.stringify(a));
    process.exit(1);
  });
