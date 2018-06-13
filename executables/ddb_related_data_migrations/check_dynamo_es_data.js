
const rootPrefix         = "../.."
    , ddbServiceObj      = require(rootPrefix + '/lib/dynamoDB_service')
    , dynamoDBFormatter  = require(rootPrefix + '/lib/elasticsearch/helpers/dynamo_formatters')
    , manifest           = require(rootPrefix + "/lib/elasticsearch/manifest" )
    , logger             = require(rootPrefix + '/lib/logger/custom_console_logger')

;

const tableNames = ['s_sb_transaction_logs_shard_001' , 's_sb_transaction_logs_shard_002'];
const Limit = 20;

let scanParams =  {
    TableName: "s_sb_transaction_logs_shard_001",
    Select: "ALL_PROJECTED_ATTRIBUTES",
    Limit: Limit
};


function CheckDynamoESData(  ) {
    const oThis =  this;
}


CheckDynamoESData.prototype = {

    isNextShard : function ( shardCount ) {
        return shardCount < tableNames.length ;
    },

    setTableName: function ( shardCount ) {
        scanParams[ "TableName" ] = tableNames[shardCount];
    },

    getTableName: function (  ) {
        return scanParams[ "TableName" ];
    },

    getSearchQuerey: function ( ids  ) {
        var oThis = this,
            querey = {}
        ;
        querey =  {
           "query": {
               "terms": {
                   "_id": ids
               }
           },
            "from": 0,
            "size": Limit
        };
       logger.log("querey ----", JSON.stringify( querey ));
    },

    getSearchIds: function ( items ) {
      var oThis = this,
          len = items.length,
          cnt ,
          id , item , itemTxu,
          ids = []
      ;
        for( cnt = 0 ;  cnt < len ; cnt ++){
            item =  items[ cnt ];
            itemTxu = item['txu'];
            if( itemTxu ){
                id = dynamoDBFormatter.toString( itemTxu );
                ids.push( id );
            }
        }
      logger.debug( "all items ids ",  ids.join(','));
      return ids;
    },

    searchRecords : function ( query ) {
        logger.log("search query", query);
        return manifest.services.transactionLog.search( query )
            .then( function ( response ) {
                response = response.toHash();
                logger.win("search response",  JSON.stringify(response));
            })
            .catch( function ( reason ) {
                logger.error("search reject reason", reason);
            });
    },

    validateRecordsInES : function ( items ) {
        var oThis =  this,
            itemIds , query
        ;
        return new Promise(function (resolve , reject) {
            itemIds = oThis.getSearchIds( items );
            query = oThis.getSearchQuerey( itemIds );
            oThis.searchRecords( query ).then(function ( response ) {
                resolve( "ES validation success" );
                logger.debug("got search result " ,JSON.stringify( response ));
                oThis.validateESDataForIds( response , itemIds)
            }).catch( function ( reason ) {
                reject(reason);
            });
        });
    },

    validateESDataForIds : function (esResponse , dynamoDBItemIds) {
        var oThis =  this,
            data =  esResponse  && esResponse.data ,
            esTransactionLogs = data && data.transaction_logs,
            dynamoDBlen = dynamoDBItemIds.length,
            dynamoDBCnt ,
            esLen = esTransactionLogs.length,
            esCnt, hasID = false;
        ;

        if(dynamoDBlen && !esLen){
            logger.error("ES record for ids " + dynamoDBItemIds.join(' , ')+ " was not found");
        }

        if(!dynamoDBlen){
            return false;
        }

        for(dynamoDBCnt = 0 ; dynamoDBCnt < dynamoDBlen ;  dynamoDBCnt ++){
            hasID = false;
            for( esCnt = 0 ;  esCnt < esLen ; esLen++ ){
                if( esTransactionLogs[esCnt]['id'] ==  dynamoDBItemIds[dynamoDBCnt]){
                    hasID = true;
                    break;
                }
            }
            if( !hasID ){
                logger.error("ES record for id " + dynamoDBItemIds[dynamoDBCnt] + " was not found");
            }
        }
    },

    dynamoDataBatch : 0,

    getDynamoDBData: function( LastEvaluatedKey  ){
        var oThis = this
        ;

        if( LastEvaluatedKey ){
            scanParams['ExclusiveStartKey'] = LastEvaluatedKey;
            oThis.dynamoDataBatch++;
        }

        ddbServiceObj.scan(scanParams)
            .then(function( response ){
                logger.debug("getDynamoDBData success",  JSON.stringify( response ));
                logger.win("DynamoData recieved for ", + oThis.getTableName + "for batch "+ oThis.dynamoDataBatch+  " complete !" );

                let data = response && response.data
                    , items = data.Items
                    , LastEvaluatedKey = data && data.LastEvaluatedKey
                    , txu = LastEvaluatedKey.txu
                    , LastEvaluatedKeyValue = dynamoDBFormatter.toString( txu );
                ;

                logger.debug("LastEvaluatedKeyValue",  LastEvaluatedKeyValue);
                oThis.validateRecordsInES( items ).then(function ( response ) {
                    logger.win("ES data validation for table ", + oThis.getTableName + "for batch "+ oThis.dynamoDataBatch +  " complete !" );
                    if( LastEvaluatedKeyValue ) {
                        oThis.getDynamoDBData();
                    }
                }).catch(function ( reason) {
                    if( LastEvaluatedKeyValue ) {
                        oThis.getDynamoDBData();
                    }
                    logger.error("ES data validation for table ", + oThis.getTableName + "for batch "+ oThis.dynamoDataBatch +  " failed !" ,  reason);
                })

            }).catch( function ( reason ) {
            logger.error("DynamoData recieved for ", + oThis.getTableName + "for batch "+ oThis.dynamoDataBatch+  " failed !" , reason);
        });
    },


};


CheckDynamoESData.prototype.getDynamoDBData();




