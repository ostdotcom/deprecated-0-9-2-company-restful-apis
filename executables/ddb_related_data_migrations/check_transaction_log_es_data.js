
const rootPrefix         = "../.."
    , ddbServiceObj      = require(rootPrefix + '/lib/dynamoDB_service')
    , dynamoDBFormatter  = require(rootPrefix + '/lib/elasticsearch/helpers/dynamo_formatters')
    , manifest           = require(rootPrefix + "/lib/elasticsearch/manifest" )
    , logger             = require(rootPrefix + '/lib/logger/custom_console_logger')

;

const tables = ['s_sb_transaction_logs_shard_001' , 's_sb_transaction_logs_shard_002'];
const Limit = 20;


function CheckTransactionLogESData(  ) {
    const oThis =  this;
}


CheckTransactionLogESData.prototype = {

    shardCount      : 0,
    shardBatchCnt : 0,


    scanParams :  {
        TableName: null,
        Select: "SPECIFIC_ATTRIBUTES",
        AttributesToGet: ['txu'],
        Limit: Limit
    },

    getTableName: function (  ) {
        return this.scanParams[ "TableName" ];
    },

    getTableFromTables : function ( shardCount ) {
        return tables[shardCount];
    },

    getScanParamsForTable :function ( table ) {
        var oThis       = this,
            scanParams  = oThis.scanParams
        ;
        scanParams['TableName'] = table;
        return scanParams;
    },

    checkForESRecords: function () {
        var oThis       =  this ,
            shardCount  = oThis.shardCount,
            len         = tables.length,
            table
        ;
        table = oThis.getTableFromTables( shardCount );
        if( !table ) return ;
        oThis.validateDynamoRecordsForTable( table ).then( function (response ) {
            if( shardCount < len ){
                oThis.shardCount++;
                oThis.checkForESRecords();
            }else {
                logger.win("SUCCESS - DynamoDB fetch for tables" + tables.join(' , ')  + " completed!" );
            }

        }).catch( function ( reason ) {
            logger.error(" REJECT - DynamoDB fetch for " + oThis.getTableName() + " for batch "+ oThis.shardBatchCnt+  " failed!" , reason);
        });
    },

    validateDynamoRecordsForTable : function ( table ) {
        var oThis       = this,
            scanParams  = oThis.getScanParamsForTable( table );
        ;
        return new Promise(function (resolve , reject ) {

            function checkDynamoRecordsInES( LastEvaluatedKeyHash ) {

                if( LastEvaluatedKeyHash ) {
                    scanParams['ExclusiveStartKey'] = LastEvaluatedKeyHash;
                }else {
                    delete scanParams["ExclusiveStartKey"];
                }

                ddbServiceObj.scan( scanParams )
                    .then(function( response ) {
                        logger.debug("dynamoDB data ",  JSON.stringify( response ));
                        logger.win(" WIN - DynamoDB fetch for " + oThis.getTableName() + " for batch " + oThis.shardBatchCnt);

                        let data                    = response && response.data
                            , items                 = data.Items
                            , LastEvaluatedKeyHash  = data && data.LastEvaluatedKey
                        ;

                        logger.debug("LastEvaluatedKeyHash",  LastEvaluatedKeyHash);
                        oThis.validateRecordsInES( items ).then(function ( response ) {
                            logger.win(" WIN - ES validation for DynamoDB table " + oThis.getTableName() + " for batch " + oThis.shardBatchCnt +  " complete!" );
                            onESValidation( LastEvaluatedKeyHash );
                        }).catch(function ( reason) {
                            logger.error(" ERROR - ES validation for DynamoDB table " + oThis.getTableName() + " for batch "+ oThis.shardBatchCnt +  " failed!" ,  reason);
                            onESValidation( LastEvaluatedKeyHash );
                        });
                    }).catch( function ( reason ) {
                        logger.error(" REJECT - DynamoDB fetch for " + oThis.getTableName() + " for batch "+ oThis.shardBatchCnt+  " failed!" , reason);
                        oThis.shardBatchCnt = 0;
                        reject( reason );
                    });
            }

            function onESValidation( LastEvaluatedKeyHash ) {
                var   txu                   = LastEvaluatedKeyHash && LastEvaluatedKeyHash.txu
                    , LastEvaluatedKeyValue = dynamoDBFormatter.toString( txu );
                ;
                if( LastEvaluatedKeyValue ){ //Check for value present
                    oThis.shardBatchCnt++;
                    checkDynamoRecordsInES( LastEvaluatedKeyHash );
                }else {
                    oThis.shardBatchCnt = 0;
                    resolve( "DynamoDB data validation for table " + oThis.getTableName() + " complete!" );
                    logger.win(" WIN - DynamoDB data validation for table " + oThis.getTableName() + " complete!");
                }
            }

            checkDynamoRecordsInES( );

        });
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
                logger.debug("Dynamo DB ids "+ dynamoRecordIds.join(' , ') +" ES Response"  ,JSON.stringify( response ));
                oThis.validateESDataForIds( response , dynamoRecordIds);
            }).catch( function ( reason ) {
                reject(reason);
            });
        });
    },

    getSearchIds: function ( items ) {
        var oThis = this,
            len   = items && items.length,
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
            logger.error(" ERROR - ES record for ids " + dynamoDBItemIds.join(' , ')+ " was not found !");
        }

        if( !dynamoDBLen ){
            return false;
        }

        for( dynamoDBCnt = 0 ; dynamoDBCnt < dynamoDBLen ;  dynamoDBCnt ++ ){
            hasID = false;
            for( esCnt = 0 ;  esCnt < esLen ; esCnt++ ){
                if( esTransactionLogs[esCnt]['id'] ==  dynamoDBItemIds[dynamoDBCnt]){
                    hasID = true;
                    break;
                }
            }
            if( hasID ){
                logger.win(" WIN - ES record for id " + dynamoDBItemIds[dynamoDBCnt] + " successfully!");
            }else {
                logger.error(" ERROR - ES record for id " + dynamoDBItemIds[dynamoDBCnt] + " not found");
            }
        }
    }


};

const CheckTransactionLogESObj = new CheckTransactionLogESData();
CheckTransactionLogESObj.checkForESRecords();




