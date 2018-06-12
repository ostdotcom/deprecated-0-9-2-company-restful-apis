const rootPrefix     = ".."
    , logger         = require( rootPrefix + "/providers/logger" )
    , manifest       = require( rootPrefix + "/manifest" )
    , responseHelper = require( rootPrefix + "/providers/responseHelper")
    , TransactionLogModelMysql = require("../../" + rootPrefix + '/app/models/transaction_log')
;

const deleteRecord = async function ( startId, endId ) {

    const oThis = this
        , pageLimit = 1000;

    let offset = 0;

    while (true) {

        var dbRows = await new TransactionLogModelMysql().getByRange(startId , endId, pageLimit, offset);

        if (dbRows.length == 0) {
            return Promise.resolve(responseHelper.successWithData({}));
        }

        let promises = [];

        for(var i=0; i<dbRows.length; i++) {
            promises.push(manifest.services.transactionLog.delete(dbRows[i]['transaction_uuid']));
        }

        let promiseResponses = await Promise.all(promises);

        for(var i=0; i<promiseResponses.length; i++) {
            if(promiseResponses[i].isFailure()) {
                logger.error(JSON.stringify(promiseResponses[i]));
            }
        }

        offset += dbRows.length;

    }
};

const startId =  1, //Change as per DB id
      endId = 100   //Change as per DB id
     ;

deleteRecord( startId , endId ).then(function ( response ) {
    logger.win("delete response", response.toHash() );
}).catch(function (reason) {
    logger.error("delete reject reason", reason);
});
