"use strict";

const openStorage = require('@openstfoundation/openst-storage');

const rootPrefix = "../.."
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , dynamoDBFormatter = require(rootPrefix + '/lib/elasticsearch/helpers/dynamo_formatters')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , TransactionLogModelDdb = openStorage.TransactionLogModel
  , TransactionLogConst = openStorage.TransactionLogConst
  , stpTransferTransactionType = parseInt(new TransactionLogModel().invertedTransactionTypes[TransactionLogConst.stpTransferTransactionType])
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

const Limit = 20;

function AddAirdropAmountToExistingDDBData(params) {

  const oThis = this;

  oThis.shardName = params.shard_name;

  oThis.ZeroXAddress = '0x0000000000000000000000000000000000000000';

  oThis.scanParams = {
    TableName: oThis.shardName,
    Select: "SPECIFIC_ATTRIBUTES",
    AttributesToGet: ['txu', 'ci', 'cti', 'te', 'tt'],
    Limit: Limit
  };

  oThis.clientTokenIdBudgetHolderAddrMap = {};

}

AddAirdropAmountToExistingDDBData.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'e_drdm_aaatedd_1',
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

    const oThis = this
    ;

    let batchNo = 1;

    while (true) {

      logger.info('starting to fetch data from DDB for batch: ', batchNo);

      let dDbRsp = await ddbServiceObj.scan(oThis.scanParams)
        , items = dDbRsp.data.Items
        , lastEvaluatedKeyHash = dDbRsp.data && dDbRsp.data.LastEvaluatedKey
      ;

      logger.info('fetched data from DDB for batch: ', batchNo);

      await oThis._processBatchOfItems(items);

      if (!lastEvaluatedKeyHash) {
        // No  more pages to fetch. break execution
        break;
      }

      oThis.scanParams['ExclusiveStartKey'] = lastEvaluatedKeyHash;
      batchNo += 1;

    }

  },

  /**
   * process batch of items returned by DDB
   *
   * @returns {promise}
   */
  _processBatchOfItems: async function(items) {

    const oThis = this
    ;

    let clientTokenIds = [];

    for (let i=0; i<items.length; i++) {
      if(dynamoDBFormatter.toNumber(items[i].tt === stpTransferTransactionType)) {continue}
      clientTokenIds.push(dynamoDBFormatter.toNumber(items[i].cti));
    }

    await oThis._fetchAffectedClientsData(clientTokenIds);

    let rowsToUpdate = [];

    logger.info('generating DDB Data To be updated');

    for (let i=0; i<items.length; i++) {

      let item = items[i]
        , txUuid = dynamoDBFormatter.toString( item.txu )
        , clientTokenId = dynamoDBFormatter.toNumber( item.cti )
        , clientId = dynamoDBFormatter.toNumber( item.ci )
        , transferEvents = ((item.te || {}).L) || []
      ;

      if(dynamoDBFormatter.toNumber(item.tt === stpTransferTransactionType)) {continue}

      for(let j=0; j<transferEvents.length; j++) {

        let transferEvent = transferEvents[j]
          , fromAddress = dynamoDBFormatter.toString(transferEvent.M.fa)
        ;

        if (fromAddress &&
          fromAddress !== oThis.ZeroXAddress &&
          fromAddress === oThis.clientTokenIdBudgetHolderAddrMap[clientTokenId]) {

          rowsToUpdate.push(
            {
              transaction_uuid: txUuid,
              airdrop_amount_in_wei: dynamoDBFormatter.toNumber(transferEvent.M.aiw)
            }
          );

        }

      }

    }

    // console.log('rowsToUpdate', JSON.stringify(rowsToUpdate));

    await oThis._updateDataInTransactionLogs(rowsToUpdate);

  },

  /**
   * update records in DDB
   *
   * @returns {promise<result>}
   */
  _updateDataInTransactionLogs: async function (rowsToUpdate) {

    const oThis = this;

    logger.info('starting _updateDataInTransactionLogs');

    let attemptCount = 1;

    while (true) {

      let promises = []
        , promiseResponses = []
        , rowsToRetry = []
      ;

      for (let k=0; k<rowsToUpdate.length; k++) {
        promises.push(
          new TransactionLogModelDdb({
            shard_name: oThis.shardName,
            ddb_service: ddbServiceObj,
            auto_scaling: autoscalingServiceObj
          }).updateItem(rowsToUpdate[k])
        );
      }

      promiseResponses = await Promise.all(promises);

      for(let i=0; i<promiseResponses.length; i++) {
        if(promiseResponses[i].isFailure()) {
          logger.error('_updateWithRetry failed row', rowsToUpdate[i]);
          logger.error('_updateWithRetry error', JSON.stringify(promiseResponses[i].toHash()));
          rowsToRetry.push(rowsToUpdate[i]);
        }
      }

      if(rowsToRetry.length === 0) {break}

      console.error(`_updateWithRetry attemptNo: ${attemptCount} will have to retry ${rowsToRetry.length} out of ${rowsToUpdate.length}`);

      rowsToUpdate = rowsToRetry;
      attemptCount += 1;

    }

    logger.info('completed _updateDataInTransactionLogs');

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * fetch clientTokenIdsData
   *
   * @returns {promise<result>}
   */
  _fetchAffectedClientsData: async function (affectedClientTokenIds) {

    const oThis = this
    ;

    logger.info('starting _fetchAffectedClientsData');

    let managedAddressIdAddressMap = {}
      , airdropBudgetHolderIds = []
      , missedClientTokenIds = []
    ;

    for(let i=0; i<affectedClientTokenIds.length; i++) {
      let clientTokenId = affectedClientTokenIds[i];
      if (!oThis.clientTokenIdBudgetHolderAddrMap[clientTokenId]) {
        missedClientTokenIds.push(clientTokenId);
      }
    }

    if (missedClientTokenIds.length > 0) {

      let clientBrandedTokenRows = await new ClientBrandedTokenModel().select('id,airdrop_holder_managed_address_id').where(['id IN (?)', missedClientTokenIds]).fire();
      for(let i=0; i<clientBrandedTokenRows.length; i++) {
        airdropBudgetHolderIds.push(clientBrandedTokenRows[i]['airdrop_holder_managed_address_id']);
      }

      let managedAddressRows = await new ManagedAddressModel().select('id,ethereum_address').where(['id IN (?)', airdropBudgetHolderIds]).fire();
      for(let i=0; i<managedAddressRows.length; i++) {
        let buffer = managedAddressRows[i];
        managedAddressIdAddressMap[buffer['id']] = buffer['ethereum_address'].toLowerCase();
      }

      for(let i=0; i<clientBrandedTokenRows.length; i++) {
        let buffer = clientBrandedTokenRows[i];
        oThis.clientTokenIdBudgetHolderAddrMap[buffer['id']] = managedAddressIdAddressMap[buffer['airdrop_holder_managed_address_id']];
      }

    }

    logger.info('completed _fetchAffectedClientsData');

    // console.log('oThis.clientTokenIdBudgetHolderAddrMap', oThis.clientTokenIdBudgetHolderAddrMap);

    return Promise.resolve(responseHelper.successWithData());

  }

};

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/ddb_related_data_migrations/add_airdrop_amount_to_existing_ddb_data.js shardName');
};

const args = process.argv
  , shardName = args[2]
;

const validateAndSanitize = function () {
  if (commonValidator.isVarNull(shardName)) {
    logger.error('shardName is NOT present in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const object = new AddAirdropAmountToExistingDDBData({shard_name: shardName});
object.perform().then(function (a) {
  console.log(JSON.stringify(a.toHash()));
  process.exit(0)
}).catch(function (a) {
  console.error(JSON.stringify(a));
  process.exit(1)
});
