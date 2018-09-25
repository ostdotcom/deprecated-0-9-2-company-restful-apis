'use strict';

const rootPrefix = '../..',
  elasticSearchLibManifest = require(rootPrefix + '/lib/elasticsearch/manifest'),
  esSearchServiceObject = elasticSearchLibManifest.services.transactionLog,
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const BenchmarkEsQueries = function(params) {
  const oThis = this;

  oThis.clientIds = params.client_ids;
  oThis.parallelQueriesCount = params.parallel_count;
};

BenchmarkEsQueries.prototype = {
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
  asyncPerform: async function() {
    const oThis = this;

    let dbRows = await new ManagedAddressModel()
      .select('id, uuid')
      .where(['client_id IN (?)', oThis.clientIds])
      .fire();
    let uuids = [];

    for (let i = 0; i < dbRows.length; i++) {
      uuids.push(dbRows[i]['uuid']);
    }

    let batchNo = 1;

    while (true) {
      const offset = (batchNo - 1) * oThis.parallelQueriesCount,
        batchedUuids = uuids.slice(offset, oThis.parallelQueriesCount + offset);

      if (batchedUuids.length === 0) break;

      logger.info(`starting processing for batch: ${batchNo}`);

      let batchStartTime = Date.now();

      await oThis._benchMarkForUuids(batchedUuids);

      logger.info(`batchTime: ${batchNo} ${Date.now() - batchStartTime} ms`);

      batchNo = batchNo + 1;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _benchMarkForUuids: async function(uuids) {
    let promiseResolvers = [];

    for (let i = 0; i < uuids.length; i++) {
      let startTime = Date.now();

      let query = {
        query: {
          bool: {
            filter: [
              { term: { type: '1' } },
              {
                query_string: {
                  query: `(${uuids[i]}) AND ((1) OR (2))`,
                  fields: ['query_str']
                }
              }
            ]
          }
        },
        from: 0,
        size: 10,
        sort: [{ created_at: 'desc' }]
      };

      // logger.log('query', query);

      let promise = new Promise(async function(onResolve, onReject) {
        await esSearchServiceObject
          .search(query, ['id'])
          .then(function(searchRsp) {
            let endTime = Date.now();

            // logger.log('searchRsp', searchRsp.data);

            logger.log(
              `searchbyuuid, ${uuids[i]}, startTime: ${startTime}, endTime: ${endTime}, timeTaken: [${endTime -
                startTime}] ms`
            );

            onResolve();
          })
          .catch(function(reason) {
            logger.error('search reject reason', reason);
            onReject(reason);
          });
      });

      promiseResolvers.push(promise);
    }

    await Promise.all(promiseResolvers);

    return responseHelper.successWithData({});
  }
};

let clientIds = [
  1104,
  1555,
  1539,
  1222,
  1129,
  3223,
  1339,
  3244,
  1001,
  1054,
  2402,
  1584,
  1092,
  3219,
  3218,
  1123,
  3216,
  3215,
  1152,
  1357,
  1104,
  1555,
  1539,
  1222,
  1129,
  3223,
  1339,
  3244,
  1558,
  1684,
  1121,
  1208,
  1053,
  3295,
  1313,
  1141,
  1164,
  1766,
  1686,
  3232,
  1551,
  2317,
  1087,
  1429,
  1857,
  1456,
  3229,
  1333,
  3252,
  2209,
  1083,
  1100,
  3279,
  3254
];

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/es_related/benchmark_select_queries.js parallelQueriesCount');
};

const args = process.argv,
  parallelQueriesCount = parseInt(args[2]);

const validateAndSanitize = function() {
  if (!commonValidator.isVarInteger(parallelQueriesCount)) {
    logger.error('parallelQueriesCount is NOT valid in the arguments. INT max 45');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const obj = new BenchmarkEsQueries({
  client_ids: basicHelper.shuffleArray(clientIds),
  parallel_count: parallelQueriesCount
});
obj
  .perform()
  .then(function(a) {
    logger.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    logger.log(a);
    process.exit(1);
  });
