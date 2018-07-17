"use strict";

const AmazonDaxClient = require('amazon-dax-client')
  , rs = require('randomstring')
  , AWS = require("aws-sdk");

const daxExampleKlass = function () {
  const oThis = this
    , region = 'us-east-1';

  oThis.tableName = "test_dax";

  const dax = new AmazonDaxClient(
    {
      endpoints: ['kit-saasapi-staging.xsap5a.clustercfg.dax.use1.cache.amazonaws.com:8111'],
      apiVersion: '2017-04-19',
      region: region,
      accessKeyId: 'AKIAJ3YLRLPH4QVPBFYQ',
      secretAccessKey: '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'
    });

  oThis.daxClient = new AWS.DynamoDB.DocumentClient({service: dax});

  oThis.ddbClient = new AWS.DynamoDB({
    apiVersion: '2012-08-10',
    accessKeyId: 'AKIAJ3YLRLPH4QVPBFYQ',
    secretAccessKey: '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',
    region: 'us-east-1',
    endpoint: 'http://dynamodb.us-east-1.amazonaws.com',
    sslEnabled: false
  });

  oThis.generatedUuids = {};
  oThis.createdUuidsInDynamo = {};
};

daxExampleKlass.prototype = {

  generateUuids: function (number) {

    const oThis = this;

    for (var i = 0; i < number; i++) {
      var part1 = rs.generate(8);
      var part2 = rs.generate(4);
      var part3 = rs.generate(4);
      var part4 = rs.generate(4);
      var part5 = rs.generate(12);
      var uuid = part1 + '-' + part2 + '-' + part3 + '-' + part4 + '-' + part5;
      oThis.generatedUuids[uuid] = '0x' + rs.generate(64);
    }
    return '';

  },

  getItemDax: async function (totalGets) {

    const oThis = this;

    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.createdUuidsInDynamo) {

      if (++i > totalGets) break;

      const params = {
        TableName: oThis.tableName,
        Key: {txu: uuid}
      };
      await ( async function() {
        return new Promise(function (onResolve, onReject) {
          oThis.daxClient.get(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {

            }
            onResolve();
          });
        });
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DAX ----- Total Get Requested - ", totalGets, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalGets, "ms");

  },

  getItemDdb: async function (totalGets) {

    const oThis = this;

    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.createdUuidsInDynamo) {

      if (++i > totalGets) break;

      const params = {
        TableName: oThis.tableName,
        Key: {txu: {S: uuid}}
      };
      await ( async function() {
        return new Promise(function (onResolve, onReject) {
          oThis.ddbClient.getItem(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {

            }
            onResolve();
          });
        });
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DDB ----- Total Get Requested - ", totalGets, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalGets, "ms");

  },

  batchGetItemDax: async function (totalGets, batchSize) {
    const oThis = this;
    var startTime = new Date().getTime()
      , batchCollected = 0
      , totalIndex = 0;

    var params = {RequestItems: {}};
    params.RequestItems[oThis.tableName] = {Keys: []};

    for (var uuid in oThis.createdUuidsInDynamo) {
      if (++totalIndex > totalGets && batchCollected == 0) break;

      params.RequestItems[oThis.tableName].Keys.push({txu: uuid});
      batchCollected++;
      if (batchCollected == batchSize || totalIndex > totalGets) {
        await ( async function() {
          return new Promise(function (onResolve, onReject) {
            oThis.daxClient.batchGet(params, function (err, data) {
              if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
              } else {
                console.error("Batch Completed.");
              }
              onResolve()
            });
          })
        })();

        batchCollected = 0;
        params.RequestItems[oThis.tableName].Keys = [];
      }

    }
    var endTime = new Date().getTime();
    console.log("\t DAX ----- Total Get Requested : ", totalGets, "\tBatch Size : ", batchSize, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime)*batchSize / totalGets, "ms");
  },

  batchGetItemDdb: async function (totalGets, batchSize) {
    const oThis = this;
    var startTime = new Date().getTime()
      , batchCollected = 0
      , totalIndex = 0;

    var params = {RequestItems: {}};
    params.RequestItems[oThis.tableName] = {Keys: []};

    for (var uuid in oThis.createdUuidsInDynamo) {
      if (++totalIndex > totalGets && batchCollected == 0) break;

      params.RequestItems[oThis.tableName].Keys.push({txu: {S: uuid}});
      batchCollected++;
      if (batchCollected == batchSize || totalIndex > totalGets) {
        await ( async function() {
          return new Promise(function (onResolve, onReject) {
            oThis.ddbClient.batchGetItem(params, function (err, data) {
              if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
              } else {
                console.error("Batch Completed.");
              }
              onResolve()
            });
          })
        })();

        batchCollected = 0;
        params.RequestItems[oThis.tableName].Keys = [];
      }

    }
    var endTime = new Date().getTime();
    console.log("\t DDB ----- Total Get Requested : ", totalGets, "\tBatch Size : ", batchSize, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime)*batchSize / totalGets, "ms");
  },

  putItemDax: async function (totalWrites) {
    const oThis = this;
    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.generatedUuids) {

      if (++i > totalWrites) break;

      const params = {
        TableName: oThis.tableName,
        Item: {
          txu: uuid,
          txh: oThis.generatedUuids[uuid],
          ca: '1530869547377',
          fa: '0xB29c55d58Af53F771C5F934B1029d2de2CaEe6a6',
          ta: 'asfdohjiwe jds jfasdlj lasdkjf lasdkj'
        }
      };
      await (async function () {
        return new Promise(function (onResolve, onReject) {
          oThis.daxClient.put(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              oThis.createdUuidsInDynamo[uuid] = oThis.generatedUuids[uuid];
              delete oThis.generatedUuids[uuid];
            }
            onResolve();
          })
        });
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DAX ----- Total Writes Requested : ", totalWrites, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalWrites, "ms");

  },

  putItemDdb: async function (totalWrites) {
    const oThis = this;
    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.generatedUuids) {

      if (++i > totalWrites) break;

      const params = {
        TableName: oThis.tableName,
        Item: {
          txu: {S: uuid},
          txh: {S: oThis.generatedUuids[uuid]},
          ca: {N: '1530869547377'},
          fa: {S: '0xB29c55d58Af53F771C5F934B1029d2de2CaEe6a6'},
          ta: {S: 'asfdohjiwe jds jfasdlj lasdkjf lasdkj'}
        }
      };
      await (async function () {
        return new Promise(function (onResolve, onReject) {
          oThis.ddbClient.putItem(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              oThis.createdUuidsInDynamo[uuid] = oThis.generatedUuids[uuid];
              delete oThis.generatedUuids[uuid];
            }
            onResolve();
          })
        });
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DDB ----- Total Writes Requested : ", totalWrites, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalWrites, "ms");

  },

  updateItemDax: async function (totalWrites) {

    const oThis = this;
    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.createdUuidsInDynamo) {

      if (++i > totalWrites) break;

      const params = {
        TableName: oThis.tableName,
        Key: {txu: uuid},
        UpdateExpression: 'ADD #a :x set #b = :x + :y',
        ExpressionAttributeNames: {'#a': 'Sum', '#b': 'Unsum'},
        ExpressionAttributeValues: {
          ':x': 1,
          ':y': 10,
        }
      };
      await (async function () {
        return new Promise(function (onResolve, onReject) {
          oThis.daxClient.update(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              oThis.createdUuidsInDynamo[uuid] = oThis.generatedUuids[uuid];
              delete oThis.generatedUuids[uuid];
            }
            onResolve();
          });
        })
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DAX ----- Total Writes Requested : ", totalWrites, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalWrites, "ms");

  },

  updateItemDDB: async function (totalWrites) {

    const oThis = this;
    var startTime = new Date().getTime()
      , i = 0;

    for (var uuid in oThis.createdUuidsInDynamo) {

      if (++i > totalWrites) break;

      const params = {
        TableName: oThis.tableName,
        Key: {txu: {S: uuid}},
        UpdateExpression: 'ADD #a :x set #b = :x + :y',
        ExpressionAttributeNames: {'#a': 'Sum', '#b': 'Unsum'},
        ExpressionAttributeValues: {
          ':x': {N: '1'},
          ':y': {N: '10'},
        }
      };
      await (async function () {
        return new Promise(function (onResolve, onReject) {
          oThis.ddbClient.updateItem(params, function (err, data) {
            if (err) {
              console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              oThis.createdUuidsInDynamo[uuid] = oThis.generatedUuids[uuid];
              delete oThis.generatedUuids[uuid];
            }
            onResolve();
          });
        })
      })();
    }

    var endTime = new Date().getTime();
    console.log("\t DDB ----- Total Writes Requested : ", totalWrites, "\tTotal time: ", (endTime - startTime), "ms - Avg time: ", (endTime - startTime) / totalWrites, "ms");

  }


};

module.exports = daxExampleKlass;