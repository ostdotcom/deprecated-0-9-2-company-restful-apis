'use strict';

/**
 * node ./executables/one_timers/transaction_meta_archival.js transaction_meta transaction_meta_archive 1 10
 *
 * @type {string}
 */

const rootPrefix = '../..',
  transactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  mysqlWrapper = require(rootPrefix + '/lib/mysql_wrapper'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const args = process.argv,
  fromTableName = args[2],
  toTableName = args[3],
  fromId = args[4],
  toId = args[5];

const tableNameToModelMap = {
  transaction_meta: transactionMetaModel
};

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/one_timers/transaction_meta_archival.js fromTableName toTableName fromId toId'
  );

  logger.log('* fromTableName is the table name from which data is to be fetched.');
  logger.log('* toTableName is the table to which data will be archived to.');
  logger.log('* fromId is the id from which migration to start. ');
  logger.log('* toId is the id upto which migration should run. ');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!fromTableName) {
    logger.error('fromTableName is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!toTableName) {
    logger.error('toTableName is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!fromId) {
    logger.error('fromId is not passed');
    usageDemo();
    process.exit(1);
  }

  if (!toId) {
    logger.error('toId is not passed');
    usageDemo();
    process.exit(1);
  }

  if (!tableNameToModelMap[fromTableName]) {
    logger.error('Incorrect table name');
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const TransactionMetaArchival = function(params) {
  const oThis = this;

  oThis.fromTableName = params.from_table_name;
  oThis.toTableName = params.to_table_name;
  oThis.fromId = params.from_id;
  oThis.toId = params.to_id;
  oThis.modelForTable = tableNameToModelMap[oThis.fromTableName];
  oThis.batchSize = 3;
};

TransactionMetaArchival.prototype = {
  perform: function() {
    const oThis = this;

    return oThis
      .asyncPerform()
      .then(function(resolve) {
        logger.win('Migration Done');
        process.exit(0);
      })
      .catch(function(error) {
        logger.error(error);
        process.exit(1);
      });
  },

  asyncPerform: async function() {
    const oThis = this;

    let startingId = parseInt(oThis.fromId),
      endingId = parseInt(oThis.toId),
      batchSize = parseInt(oThis.batchSize),
      tableModelClass = oThis.modelForTable,
      tableModelObj = new tableModelClass(),
      dbConnection = tableModelObj.onWriteConnection();

    while (endingId >= startingId) {
      let endingIdForThisLoop = startingId + batchSize;

      //To handle the border case when endingIdForThisLoop may exceed given endingId.
      if (endingIdForThisLoop > endingId) {
        endingIdForThisLoop = endingId + 1;
      }

      let response = await oThis
        ._performMigration(startingId, endingIdForThisLoop, dbConnection)
        .catch(async function(err) {
          logger.error('Error in migration of batch starting at', startingId);
          return Promise.reject(err);
        });

      startingId = endingIdForThisLoop;
    }

    return Promise.resolve({});
  },

  _performMigration: async function(startingId, endingIdForThisLoop, dbConnection) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      let queryString =
        `INSERT INTO ${
          oThis.toTableName
        }(id, chain_id, transaction_hash, transaction_uuid, client_id, kind, post_receipt_process_params, created_at, updated_at) ` +
        `SELECT id, chain_id, transaction_hash, transaction_uuid, client_id, kind, post_receipt_process_params, created_at, updated_at ` +
        `FROM ${oThis.fromTableName}` +
        ` WHERE id >= ${startingId} AND id < ${endingIdForThisLoop}`;

      let deleteQueryString =
        `DELETE FROM ${oThis.fromTableName} ` + `WHERE id >= ${startingId} AND id < ${endingIdForThisLoop}`;

      let pre_query = Date.now(),
        queryResponse = dbConnection.query(queryString, function(err, result, fields) {
          logger.info('(' + (Date.now() - pre_query) + ' ms)', queryResponse.sql);
          if (err) {
            logger.log('Error in insert query', err);
            return onReject(err);
          } else {
            logger.log('Successfully inserted data', result);
            let before_query = Date.now(),
              deleteQueryResponse = dbConnection.query(deleteQueryString, function(err, result, fields) {
                logger.info('(' + (Date.now() - before_query) + ' ms)', deleteQueryResponse.sql);
                if (err) {
                  logger.log('err in delete query', err);
                  onReject(err);
                } else {
                  onResolve(result);
                  logger.log('Successfully deleted data', result);
                }
              });
          }
        });
    });
  }
};

const transactionMetaArchivalObj = new TransactionMetaArchival({
  from_table_name: fromTableName,
  to_table_name: toTableName,
  from_id: fromId,
  to_id: toId
});

transactionMetaArchivalObj
  .perform()
  .then(function(r) {})
  .catch(function(r) {
    logger.error('Error in archival: ', r);
    process.exit(1);
  });

module.exports = TransactionMetaArchival;
