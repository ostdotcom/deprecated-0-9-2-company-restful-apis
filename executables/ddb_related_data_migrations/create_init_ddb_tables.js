'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/storage');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path);

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CreateInitDdbTables = function(params) {
  const oThis = this;
};

CreateInitDdbTables.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
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
          internal_error_identifier: 'e_drdm_cs_1',
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
      instanceComposer = new InstanceComposer(configStrategy),
      storageProvider = instanceComposer.getStorageProvider(),
      openSTStorage = storageProvider.getInstance(),
      ddbServiceObj = openSTStorage.dynamoDBService,
      shardMgmtObj = ddbServiceObj.shardManagement();

    // running the database migrations for shard management table
    await shardMgmtObj.runShardMigration(ddbServiceObj);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

const object = new CreateInitDdbTables({});
object
  .perform()
  .then(function(a) {
    console.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    console.log(a);
    process.exit(1);
  });
