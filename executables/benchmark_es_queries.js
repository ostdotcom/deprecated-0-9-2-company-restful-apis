"use strict";

const rootPrefix = ".."
  , elasticSearchLibManifest = require(rootPrefix + '/lib/elasticsearch/manifest')
  , esSearchServiceObject = elasticSearchLibManifest.services.transactionLog
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const BenchmarkEsQueries = function (params) {

  const oThis = this;

  oThis.clientIds = params.client_ids;

};

BenchmarkEsQueries.prototype = {

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
            internal_error_identifier: 'e_beq_1',
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
    ;

    let promises = [];

    for(let i=0; i<oThis.clientIds.length; i++) {

      promises.push(oThis.benchMarkForClient(oThis.clientIds[i]));

    }

    await Promise.all(promises);

  },

  benchMarkForClient: async function (clientId) {

    let dbRows = await new ManagedAddressModel().select('id, uuid').where({client_id: clientId}).fire();

    for (let i = 0; i < dbRows.length; i++) {

      let dbRow = dbRows[0]
        , startTime = Date.now()
      ;

      let query = {
        "query": {
          "bool": {
            "filter": [
              {"term": {"client_id": clientId}},
              {"term": {"type": "1"}},
              {"terms": {"status": [1,2]}}
            ],
            "must": {"bool": {"should": [{"match": {"from_uuid": dbRow['uuid']}}, {"match": {"to_uuid": dbRow['uuid']}}]}}
          }
        }, "from": 0, "size": 10, "sort": [{"created_at": "desc"}]
      };

      // logger.log('query', query);

      let searchRsp = await esSearchServiceObject.search(query, ['id']);

      let endTime =  Date.now();

      logger.log('clientId', clientId, 'time ', endTime - startTime);

    }

  }

};

let clientIds = [1104,1555,1539,1222,1129,3223,1339,3244,1001,1054, 2402, 1584, 1092,3219,3218,1123, 3216,3215, 1152, 1357];

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/benchmark_es_queries.js parallelQueriesCount');
};

const args = process.argv
  , parallelQueriesCount = parseInt(args[2])
;

const validateAndSanitize = function () {

  if (!commonValidator.isVarInteger(parallelQueriesCount)) {
    logger.error('parallelQueriesCount is NOT valid in the arguments. INT max 15');
    usageDemo();
    process.exit(1);
  }

};

// validate and sanitize the input params
validateAndSanitize();

const obj = new BenchmarkEsQueries({client_ids: clientIds.slice(0, parallelQueriesCount)});
obj.perform().then(function (a) {
  logger.log(JSON.stringify(a.toHash()));
  process.exit(1)
}).catch(function (a) {
  logger.log(JSON.stringify(a));
  process.exit(1)
});
