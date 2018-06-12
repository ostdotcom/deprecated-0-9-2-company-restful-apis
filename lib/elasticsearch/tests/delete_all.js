const rootPrefix     = ".."
    , logger         = require( rootPrefix + "/providers/logger" )
    , manifest       = require( rootPrefix + "/manifest" )
    , TransactionLogModelMysql = require(rootPrefix + '/app/models/transaction_log')
;

function async deleteRecord() {

    const oThis = this
        , pageLimit = 1000;

    let offset = 0;

    while (true) {

        var dbRows = await new TransactionLogModelMysql().getByRange(oThis.startId, oThis.endId, pageLimit, offset);

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
                logger.error(JSON.stringify(response.toHash()));
            }
        }

        offset += dbRows.length;

    }
}

deleteRecord().then(function ( response ) {
    logger.win("delete response", response.toHash() );
}).catch(function (reason) {
    logger.error("delete reject reason", reason);
});
