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
 * NOTE:- Only Tx Meta entries with status 'failed', 'insufficient_gas' or 'mined' are archived.
 *
 * sample params for cron process table - {"time_interval_in_hours": 960, "offset_to_get_endimestamp":12}
 * @module executables/one_timers/transaction_meta_archival
 */

const rootPrefix = '../..',
  transactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaArchiveModel = require(rootPrefix + '/app/models/transaction_meta_archive'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  CronProcessHandlerObject = new CronProcessesHandler(),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  processLockId = args[2];

let timeIntervalInHours,
  offsetToGetEndTimestamp,
  statusArray,
  timeIntervalInSeconds,
  endTimeStamp,
  finalOffset,
  startTimeStamp;

/**
 *
 * @constructor
 */
const TransactionMetaArchival = function() {
  const oThis = this;

  oThis.txMetaIds = [];
  oThis.batchSize = 500;
  oThis.archiveColumns = [];
  oThis.firstTime = true;
  oThis.canExit = true;

  SigIntHandler.call(oThis, { id: processLockId });
};

TransactionMetaArchival.prototype = Object.create(SigIntHandler.prototype);

const TransactionMetaArchivalPrototype = {
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

    if (oThis.firstTime) {
      await oThis._validate();

      statusArray = [];
      timeIntervalInSeconds = 0;

      if (!timeIntervalInHours) {
        //by default, this cron archives entries from two days ago.
        timeIntervalInSeconds = 24 * 3600 * 1000;
      } else {
        timeIntervalInSeconds = timeIntervalInHours * 3600 * 1000;
      }

      // statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.submitted]);
      statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed]);
      statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.mined]);
      statusArray.push(transactionMetaConstants.invertedStatuses[transactionMetaConstants.insufficient_gas]);
      //startTimeStamp calculated as - currentTimeStamp - (archivalTimeInterval + offset)

      let endTime = Date.now() - oThis.offset;

      endTimeStamp = new Date(endTime).toLocaleString();
      finalOffset = oThis.offset + parseInt(timeIntervalInSeconds);

      let startTime = Date.now() - finalOffset;

      startTimeStamp = new Date(startTime).toLocaleString();

      logger.win('start timeStamp----', startTimeStamp);
      logger.win('end timeStamp----', endTimeStamp);

      if (endTime < startTime) {
        logger.log('Can not archive data for this Time Interval!');
        return Promise.reject({});
      }

      oThis.firstTime = false;
    }

    let whereClauseForIds = ['updated_at BETWEEN ? AND ? AND status IN (?)', startTimeStamp, endTimeStamp, statusArray];
    // let whereClauseForIds = ['client_id = 1310 AND status IN (?)', statusArray];

    let queryResponseForIds = await new transactionMetaModel()
      .select('id')
      .where(whereClauseForIds)
      .limit(1000)
      .fire();

    if (queryResponseForIds.length == 0) {
      logger.log('Nothing to archived.');
      process.emit('SIGINT');
    }

    oThis.txMetaIds = [];

    for (let i = 0; i < queryResponseForIds.length; i++) {
      let rawResponse = queryResponseForIds[i];
      oThis.txMetaIds.push(rawResponse.id);
    }

    logger.debug('txMeta Ids-----', oThis.txMetaIds);

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

      logger.info(`batchTime for ${batchNo} : ${Date.now() - batchStartTime} ms`);

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
      oThis.canExit = false;
      logger.debug('TxMetaArchive Insert rsp---', queryResponseForMetaArchive);

      let queryResponseTxMetaDeletion = await new transactionMetaModel()
        .delete()
        .where(['id IN (?)', batchedTxMetaIds])
        .fire();

      oThis.canExit = true;

      logger.debug('TxMeta Delete rsp---', queryResponseTxMetaDeletion);
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

    let timeConversionFactor = 3600 * 1000; //hours to millisecond conversion
    if (!offsetToGetEndTimestamp) {
      // set to 24 hours, if not passed explicitly
      oThis.offset = 24 * timeConversionFactor;
    } else {
      oThis.offset = offsetToGetEndTimestamp * timeConversionFactor;
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
  },

  init: async function() {
    const oThis = this;
    await oThis.asyncPerform();
    return oThis.init();
  },

  /**
   * Indicates whether picked up tasks are complete
   */
  pendingTasksDone: function() {
    const oThis = this;

    return oThis.canExit;
  }
};

Object.assign(TransactionMetaArchival.prototype, TransactionMetaArchivalPrototype);

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: CronProcessesConstants.transactionMetaArchival
}).then(async function(dbResponse) {
  let cronParams;
  let transactionMetaArchivalObj = new TransactionMetaArchival({});

  try {
    cronParams = JSON.parse(dbResponse.data.params);

    timeIntervalInHours = cronParams.time_interval_in_hours;
    offsetToGetEndTimestamp = cronParams.offset_to_get_endimestamp;

    transactionMetaArchivalObj.init();
  } catch (err) {
    logger.error('cronParams stored in INVALID format in the DB.');
    logger.error(
      'The status of the cron was NOT changed to stopped. Please check the status before restarting the cron'
    );
    process.exit(1);
  }
});
