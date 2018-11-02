'use strict';

/**
 * This cron archives the tx meta table by removing entries within provided time interval from tx meta and adding them to tx meta archive table.
 *
 * Usage: node ./executables/one_timers/transaction_meta_archival.js timeInterval [offsetForEndId]
 * Command Line Parameters:
 * timeInterval: [optional] Time Interval in hours to archive the data (in hours).
 * offsetToGetEndTimestamp: [optional] Time (in hours) to get end timestamp for archival, if not passed - default value is 24 hours
 *
 * Example: node ./executables/one_timers/transaction_meta_archival.js 24 6
 *
 * NOTE:- Only Tx Meta entries with status 'failed' or 'mined' are archived.
 * @module executables/one_timers/transaction_meta_archival
 */

const rootPrefix = '../..',
  transactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaArchiveModel = require(rootPrefix + '/app/models/transaction_meta_archive'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  timeIntervalInHours = args[2],
  offsetToGetEndTimestamp = args[3];

/**
 *
 * @constructor
 */
const TransactionMetaArchival = function() {
  const oThis = this;

  oThis.txMetaIds = [];
  oThis.batchSize = 500;
  oThis.archiveColumns = [];
};

TransactionMetaArchival.prototype = {
  /**
   *
   * @returns {Promise<T>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('executables/one_timers/transaction_meta_archival.js::perform::catch');
      logger.error(error);
    });
  },

  /**
   *
   * @returns {Promise<{}>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._validate();

    let statusArray = [],
      timeIntervalInSeconds = 0;

    if (!timeIntervalInHours) {
      //by default, this cron archives entries from two days ago.
      timeIntervalInSeconds = 24 * 3600 * 1000;
    } else {
      timeIntervalInSeconds = timeIntervalInHours * 3600 * 1000;
    }

    statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed]);
    statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.mined]);
    statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.insufficient_gas]);

    //startTimeStamp calculated as - currentTimeStamp - (archivalTimeInterval + offset)
    let endTimeStamp = new Date(Date.now() - oThis.offset).toLocaleString(),
      finalOffset = oThis.offset + parseInt(timeIntervalInSeconds),
      startTimeStamp = new Date(Date.now() - finalOffset).toLocaleString();

    logger.win('start timeStamp----', startTimeStamp);
    logger.win('end timeStamp----', endTimeStamp);

    if (endTimeStamp < startTimeStamp) {
      logger.log('Can not archive data for this Time Interval!');
      return Promise.reject({});
    }

    let whereClauseForIds = ['updated_at BETWEEN ? AND ? AND status IN (?)', startTimeStamp, endTimeStamp, statusArray];

    let queryResponseForIds = await new transactionMetaModel()
      .select('id')
      .where(whereClauseForIds)
      .fire();

    for (let i = 0; i < queryResponseForIds.length; i++) {
      let rawResponse = queryResponseForIds[i];
      oThis.txMetaIds.push(rawResponse.id);
    }

    logger.log('txMeta Ids-----', oThis.txMetaIds);

    let batchNo = 1;

    while (true) {
      const offset = (batchNo - 1) * oThis.batchSize,
        batchedTxIds = oThis.txMetaIds.slice(offset, oThis.batchSize + offset);

      if (batchedTxIds.length === 0) {
        break;
      }

      logger.info(`starting processing for batch: ${batchNo}`);

      let batchStartTime = Date.now();
      await oThis._performArchival(batchedTxIds);

      logger.info(`batchTime: ${batchNo} ${Date.now() - batchStartTime} ms`);

      batchNo = batchNo + 1;
    }

    return Promise.resolve({});
  },

  _performArchival: async function(batchedTxMetaIds) {
    const oThis = this;

    let insertColumns = oThis.archiveColumns,
      getIdsForMetaResponse = await new transactionMetaModel().getByIds(batchedTxMetaIds);

    if (!getIdsForMetaResponse) {
      return responseHelper.error({
        internal_error_identifier: 'e_ot_tma_1',
        debug_options: {}
      });
    }

    let insertParams = [];

    for (let i = 0; i < getIdsForMetaResponse.length; i++) {
      insertParams.push(Object.values(getIdsForMetaResponse[i]));
    }

    let queryResponseForMetaArchive = await new transactionMetaArchiveModel()
      .insertMultiple(insertColumns, insertParams)
      .fire();

    if (queryResponseForMetaArchive) {
      logger.win('TxMetaArchive Insert rsp---', queryResponseForMetaArchive);

      let queryResponseTxMetaDeletion = await new transactionMetaModel()
        .delete()
        .where(['id IN (?)', batchedTxMetaIds])
        .fire();

      logger.win('TxMeta Delete rsp---', queryResponseTxMetaDeletion);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Sets offsets according to the command line argument and validates table schema.
   * @returns {Promise<never>}
   * @private
   */
  _validate: async function() {
    const oThis = this;

    if (!offsetToGetEndTimestamp) {
      let timeConversionFactor = 3600 * 1000; //hours to millisecond conversion
      // set to 24 hours, if not passed explicitly
      oThis.offset = 24 * timeConversionFactor;
    } else {
      oThis.offset = offsetToGetEndTimestamp * 3600 * 1000;
    }

    let queryResponseForMeta = await new transactionMetaModel().showColumns().fire(),
      queryResponseForArchive = await new transactionMetaArchiveModel().showColumns().fire();

    let metaColumns = [];
    oThis.archiveColumns = [];

    if (queryResponseForMeta.length === queryResponseForArchive.length) {
      for (let i = 0; i < queryResponseForMeta.length; i++) {
        let rowOfMeta = queryResponseForMeta[i],
          rowOfArchive = queryResponseForArchive[i];

        metaColumns.push(rowOfMeta['Field']);
        oThis.archiveColumns.push(rowOfArchive['Field']);
      }
    } else {
      logger.log('Transaction Meta Schema does not matches to transaction Meta Archive!');
      return Promise.reject(JSON.stringify(metaColumns));
    }

    return Promise.resolve({});
  }
};

const transactionMetaArchivalObj = new TransactionMetaArchival({});

transactionMetaArchivalObj
  .perform()
  .then(function(r) {
    logger.win('Tx Meta Archival Done.');
    process.exit(0);
  })
  .catch(function(r) {
    logger.error('Error in archival: ', r);
    process.exit(1);
  });
