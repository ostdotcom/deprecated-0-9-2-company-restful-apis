"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/ddb_related_data_migrations/migrate_token_balances_data
 *
 */

const rootPrefix = '../..'
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , commonValidator = require(rootPrefix +  '/lib/validators/common')
    , TransactionLogModelMysql = require(rootPrefix + '/app/models/transaction_log')
    , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

const MigrateTransactionLogsKlass = function (params) {

  const oThis = this
  ;

  oThis.startId = params.start_id;
  oThis.endId = params.end_id;

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
        , pageLimit = 100;

    let offset = 0;

    while (true) {

      var dbRows = await new TransactionLogModelMysql().getByRange(oThis.startId, oThis.endId, pageLimit, offset);

      if (dbRows.length == 0) {
        return Promise.resolve("Done");
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
  _migrateRecords:  async function (dbRows) {

    for(let i=0; i<dbRows.length; i++) {
      let dbRow = dbRows[i];
      //TODO: Call DDB model to create
    }

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
obj.perform();

