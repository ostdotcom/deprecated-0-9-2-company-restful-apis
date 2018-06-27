"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/ddb_related_data_migrations/migrate_token_balances_data
 *
 */

const openStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../..'
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , commonValidator = require(rootPrefix +  '/lib/validators/common')
    , TransactionLogModelMysql = require(rootPrefix + '/app/models/transaction_log')
    , TransactionLogModelDdb = openStorage.TransactionLogModel
    , TransactionLogConst = openStorage.TransactionLogConst
    , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
    , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
;

const MigrateTransactionLogsKlass = function (params) {

  const oThis = this
  ;

  oThis.startId = params.start_id;
  oThis.endId = params.end_id;

  oThis.totalCheckedUuidsCount = 0;
  oThis.totalVerifiedUuidsCount = 0;
  oThis.clientIdMissingTxUuidsMap = {};

};

MigrateTransactionLogsKlass.prototype = {

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
              internal_error_identifier: 'e_drdm_mtld_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            });
          }
        });
  },

  /**
   * Starts the process of the script
   *
   * @returns {promise<result>}
   */
  asyncPerform: async function () {

    const oThis = this
        , pageLimit = 1000;

    let offset = 0;

    while (true) {

      var dbRows = await new TransactionLogModelMysql().getByRange(oThis.startId, oThis.endId, pageLimit, offset);

      if (dbRows.length == 0) {
        return Promise.resolve(responseHelper.successWithData({
          totalCheckedUuidsCount: oThis.totalCheckedUuidsCount,
          totalVerifiedUuidsCount: oThis.totalVerifiedUuidsCount,
          failure_percent: (oThis.totalCheckedUuidsCount - oThis.totalVerifiedUuidsCount) / parseFloat(oThis.totalCheckedUuidsCount) * 100,
          clientIdMissingTxUuidsMap: JSON.stringify(oThis.clientIdMissingTxUuidsMap)
        }));
      }

      await oThis._migrateRecords(dbRows);

      offset += dbRows.length;

    }

  },

  /**
   * migrate old db records to dynamo DB
   *
   * @param dbRows
   *
   * @returns {promise<result>}
   */
  _migrateRecords: async function (dbRows) {

    const oThis = this
        , stpTransferTransactionType = parseInt(new TransactionLogModelMysql().invertedTransactionTypes[TransactionLogConst.stpTransferTransactionType])
    ;

    let clientIdTxsToMigrateMap = {}
        , clientIdtxUuidsToVerify = {}
    ;

    for(let i=0; i<dbRows.length; i++) {
      let dbRow = dbRows[i];
      // if type == 2 or hash is not present (tx couldn't make it to a block)
      if (parseInt(dbRow['transaction_type']) === stpTransferTransactionType || !dbRow['transaction_hash']) {
        let formattedRow = oThis._formatRow(dbRow);
        clientIdTxsToMigrateMap[formattedRow['client_id']] = clientIdTxsToMigrateMap[formattedRow['client_id']] || [];
        clientIdTxsToMigrateMap[formattedRow['client_id']].push(formattedRow);
      } else {
       // these transaction should have been migrated by chain parsing migration
        clientIdtxUuidsToVerify[dbRow['client_id']] = clientIdtxUuidsToVerify[dbRow['client_id']] || [];
        clientIdtxUuidsToVerify[dbRow['client_id']].push(dbRow['transaction_uuid']);
      }
    }

    // insert in DDb
    let insertTxLogsRsp = await oThis._insertDataInTransactionLogs(clientIdTxsToMigrateMap);
    if(insertTxLogsRsp.isFailure()) {
      console.error('insertTxLogsRspError', insertTxLogsRsp.toHash());
      return Promise.reject(insertTxLogsRsp);
    }

    let verifyTxLogsRsp = await oThis._verifyDataInTransactionLogs(clientIdtxUuidsToVerify);
    if(verifyTxLogsRsp.isFailure()) {
      console.error('verifyTxLogsRsp', verifyTxLogsRsp.toHash());
      return Promise.reject(verifyTxLogsRsp);
    }

  },

  _formatRow: function(existingTxData) {

    const oThis = this;

    let txFormattedData = {
      transaction_uuid: existingTxData['transaction_uuid'],
      transaction_type: existingTxData['transaction_type'] || 1,
      client_id: parseInt(existingTxData['client_id']),
      client_token_id: existingTxData['client_token_id'],
      gas_price: existingTxData['gas_price'] || 1000000000 ,
      status: existingTxData['status'],
      created_at: new Date(existingTxData['created_at']).getTime(),
      updated_at: new Date(existingTxData['updated_at']).getTime()
    };

    let  existingInputParams = existingTxData['input_params']
        , existingFormattedReceipt = existingTxData['formatted_receipt']
    ;

    if (!commonValidator.isVarNull(existingTxData['transaction_hash'])) { txFormattedData['transaction_hash'] = existingTxData['transaction_hash']}
    if (!commonValidator.isVarNull(existingTxData['block_number'])) { txFormattedData['block_number'] = existingTxData['block_number']}
    if (!commonValidator.isVarNull(existingTxData['gas_used'])) { txFormattedData['gas_used'] = existingTxData['gas_used']}
    if (!commonValidator.isVarNull(existingInputParams['amount_in_wei'])) {txFormattedData['amount_in_wei'] = existingInputParams['amount_in_wei']}
    if (!commonValidator.isVarNull(existingInputParams['to_address'])) {txFormattedData['to_address'] = existingInputParams['to_address']}
    if (!commonValidator.isVarNull(existingInputParams['from_address'])) {txFormattedData['from_address'] = existingInputParams['from_address']}
    if (!commonValidator.isVarNull(existingInputParams['from_uuid'])) {txFormattedData['from_uuid'] = existingInputParams['from_uuid']}
    if (!commonValidator.isVarNull(existingInputParams['to_uuid'])) {txFormattedData['to_uuid'] = existingInputParams['to_uuid']}
    if (!commonValidator.isVarNull(existingInputParams['token_symbol'])) {txFormattedData['token_symbol'] = existingInputParams['token_symbol']}
    if (!commonValidator.isVarNull(existingInputParams['transaction_kind_id'])) {txFormattedData['action_id'] = existingInputParams['transaction_kind_id']}
    if (!commonValidator.isVarNull(existingInputParams['amount']) && commonValidator.validateAmount(existingInputParams['amount'])) {txFormattedData['amount'] = existingInputParams['amount']}
    if (!commonValidator.isVarNull(existingInputParams['commission_percent'])) {txFormattedData['commission_percent'] = existingInputParams['commission_percent']}
    if (!commonValidator.isVarNull(existingFormattedReceipt['code'])) {txFormattedData['error_code'] = existingFormattedReceipt['code']}
    if (!commonValidator.isVarNull(existingFormattedReceipt['commission_amount_in_wei'])) {txFormattedData['commission_amount_in_wei'] = existingFormattedReceipt['commission_amount_in_wei']}
    if (!commonValidator.isVarNull(existingFormattedReceipt['bt_transfer_in_wei'])) {txFormattedData['amount_in_wei'] = existingFormattedReceipt['bt_transfer_in_wei']}

    return txFormattedData;

  },

  /**
   * bulk create records in DDB
   *
   * @returns {promise<result>}
   */
  _insertDataInTransactionLogs: async function (formattedTransactionsData) {

    const oThis = this;

    let clientIds = Object.keys(formattedTransactionsData);

    for(let k=0; k<clientIds.length; k++) {

      let clientId = clientIds[k]
          , dataToInsert = formattedTransactionsData[clientId]
      ;

      logger.info(`starting insertion for client ${clientId}`);

      let rsp = await new TransactionLogModelDdb({
        client_id: clientId,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).batchPutItem(dataToInsert, 10);

    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  _verifyDataInTransactionLogs: async function (clientIdtxUuidsToVerify) {

    const oThis = this
        , ddbInQueryFetch = 100
    ;

    let clientIds = Object.keys(clientIdtxUuidsToVerify);

    for(let k=0; k<clientIds.length; k++) {

      let clientId = clientIds[k]
          , txUuidsToVerify = clientIdtxUuidsToVerify[clientId]
          , batchNo = 1
      ;

      while (true) {

        const offset = (batchNo - 1) * ddbInQueryFetch
            , batchedTxUuidsToVerify = txUuidsToVerify.slice(offset, ddbInQueryFetch + offset)
        ;

        if (batchedTxUuidsToVerify.length === 0) break;

        logger.info(`starting verification for batch: ${batchNo} for client ${clientId}`);

        let rsp = await new TransactionLogModelDdb({
          client_id: clientId,
          ddb_service: ddbServiceObj,
          auto_scaling: autoscalingServiceObj
        }).batchGetItem(batchedTxUuidsToVerify, 10);

        if(rsp.isFailure()) {return Promise.reject(rsp)}

        for(let i=0; i<batchedTxUuidsToVerify.length; i++) {
          oThis.totalCheckedUuidsCount += 1;
          let uuidToVerify = batchedTxUuidsToVerify[i];
          if (!rsp.data[uuidToVerify]) {
            logger.error(`clientId ${clientId} missing txUuid : ${uuidToVerify}`);
            oThis.clientIdMissingTxUuidsMap[clientId] = oThis.clientIdMissingTxUuidsMap[clientId] || [];
            oThis.clientIdMissingTxUuidsMap[clientId].push(uuidToVerify);
          } else {
            oThis.totalVerifiedUuidsCount += 1;
          }
        }

        batchNo = batchNo + 1;

      }

    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/ddb_related_data_migrations/migrate_remaining_transaction_logs_data.js startId endId');
};

const args = process.argv
    , startId = parseInt(args[2])
    , endId = parseInt(args[3])
;

const validateAndSanitize = function () {
  if (!commonValidator.isVarInteger(startId)) {
    logger.error('startId is NOT valid in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!commonValidator.isVarInteger(endId)) {
    logger.error('endId is NOT valid in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const obj = new MigrateTransactionLogsKlass({start_id: startId, end_id: endId});
obj.perform().then(function(a) {
  logger.log(a.toHash());
  process.exit(1)
}).catch(function(a) {
  logger.log(a);
  process.exit(1)
});

