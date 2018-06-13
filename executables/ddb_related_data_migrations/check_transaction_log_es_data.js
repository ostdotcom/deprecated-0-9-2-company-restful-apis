
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
    Select: "SPECIFIC_ATTRIBUTES",
    AttributesToGet: ['txu'],
    Limit: Limit
};


function CheckDynamoESData(  ) {
    const oThis =  this;
}


CheckDynamoESData.prototype = {

    getTableName: function (  ) {
        return scanParams[ "TableName" ];
    },

    dynamoDataBatch : 0,
    getDynamoDBData: function( LastEvaluatedKey  ){
        var oThis = this
        ;

        if( LastEvaluatedKey ){
            scanParams['ExclusiveStartKey'] = LastEvaluatedKey;
        }

        ddbServiceObj.scan( scanParams )
            .then(function( response ) {
                logger.debug("dynamoDB data ",  JSON.stringify( response ));
                logger.win("DynamoDB fetch for " + oThis.getTableName() + " for batch " + oThis.dynamoDataBatch + " success!" );

                let data                    = response && response.data
                    , items                 = data.Items
                    , LastEvaluatedObj      = data && data.LastEvaluatedKey
                ;

                logger.debug("LastEvaluatedObj",  LastEvaluatedObj);
                oThis.validateRecordsInES( items ).then(function ( response ) {
                    logger.win("ES validation for DynamoDB table " + oThis.getTableName() + " for batch " + oThis.dynamoDataBatch +  " complete!" );
                    oThis.onESValidation( LastEvaluatedObj );
                }).catch(function ( reason) {
                    logger.error("ES validation for DynamoDB table " + oThis.getTableName() + " for batch "+ oThis.dynamoDataBatch +  " failed!" ,  reason);
                    oThis.onESValidation( LastEvaluatedObj );
                });
            }).catch( function ( reason ) {
                logger.error("DynamoDB fetch for " + oThis.getTableName() + " for batch "+ oThis.dynamoDataBatch+  " failed!" , reason);
            });
    },

    onESValidation : function ( LastEvaluatedObj ) {
        var oThis                   = this
            , txu                   = LastEvaluatedObj && LastEvaluatedObj.txu
            , LastEvaluatedKeyValue = dynamoDBFormatter.toString( txu );
        ;
        if( LastEvaluatedKeyValue ){ //Check for value present
            oThis.dynamoDataBatch++;
            oThis.getDynamoDBData( LastEvaluatedObj);
        }else {
            oThis.dynamoDataBatch = 0;
        }
    },

    validateRecordsInES : function ( dynamoRecords  ) {
        var oThis           =  this,
            dynamoRecordIds = [] ,
            esSearchQuery   = {}
        ;

        return new Promise(function (resolve , reject) {
            if( !dynamoRecords ){
                resolve();
            }
            dynamoRecordIds = oThis.getSearchIds( dynamoRecords );
            esSearchQuery   = oThis.getSearchQuerey( dynamoRecordIds );
            oThis.searchRecords( esSearchQuery ).then(function ( response ) {
                resolve( "Got search results");
                logger.win("ES result for ", dynamoRecords.join(' , ') );
                logger.debug("ES Response"  ,JSON.stringify( response ));
                oThis.validateESDataForIds( response , dynamoRecordIds);
            }).catch( function ( reason ) {
                reject(reason);
            });
        });
    },

    getSearchIds: function ( items ) {
        var oThis = this,
            len = items && items.length,
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
        logger.debug( "DynamoDB record ids to search in ES ",  ids.join(','));
        return ids;
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
        logger.debug("ES querey ", JSON.stringify( querey ));
        return querey;
    },

    searchRecords : function ( query ) {
        logger.debug("search query", query);
        return manifest.services.transactionLog.search( query );
    },

    validateESDataForIds : function (esResponse , dynamoDBItemIds) {
        var oThis =  this,
            data =  esResponse  && esResponse.data ,
            esTransactionLogs = data && data.transaction_logs,
            dynamoDBLen = dynamoDBItemIds && dynamoDBItemIds.length || 0,
            dynamoDBCnt ,
            esLen = esTransactionLogs && esTransactionLogs.length || 0,
            esCnt,
            hasID = false;
        ;

        if( dynamoDBLen && !esLen ){
            logger.error("ES record for ids " + dynamoDBItemIds.join(' , ')+ " was not found !");
        }

        if( !dynamoDBLen ){
            return false;
        }

        for( dynamoDBCnt = 0 ; dynamoDBCnt < dynamoDBLen ;  dynamoDBCnt ++ ){
            hasID = false;
            for( esCnt = 0 ;  esCnt < esLen ; esLen++ ){
                if( esTransactionLogs[esCnt]['id'] ==  dynamoDBItemIds[dynamoDBCnt]){
                    hasID = true;
                    break;
                }
            }
            if( hasID ){
                logger.win("ES record for id " + dynamoDBItemIds[dynamoDBCnt] + " was not successfully!");
            }else {
                logger.error("ES record for id " + dynamoDBItemIds[dynamoDBCnt] + " was not found");
            }
        }
    }


};

var checkDynamoESObj = new CheckDynamoESData();
checkDynamoESObj.getDynamoDBData();




