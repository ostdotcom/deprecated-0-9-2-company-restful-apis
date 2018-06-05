"use strict";
/**
 * Entry point for AWS Lambda Service
 *
 * @module elasticsearch/lambda
 */

 const rootPrefix     = "."
    , logger          = require( rootPrefix + "/providers/logger" )
    , esServices      = require( rootPrefix + "/services/es_services/manifest")
    , transactionLogService = require( rootPrefix + "/transaction_log/service")
    , responseHelper  = require(rootPrefix + "/providers/responseHelper")
    , BulkService     = esServices.BulkService
;


const Service = async function ( params ) {
  const oThis = this;

  oThis.bulkService = new BulkService();
  /*
    For each param:
      - call populate bulk service object.
  */

  // Finally, perform bulk operations.
  await oThis.perform();

};
Service.prototype = {
  constructor: Service
  , bulkService: null
  , populateBulkService: function ( params ) {
    const oThis = this;

    let service = oThis.getService( params );

    if ( !service ) {
      logger.error("Unable to indentify service for params:\n", JSON.stringify( params ) );
      return;
    }

    service.popluateBulkService( oThis.bulkService, params);
  }
  , getService: function ( params ) {
    const oThis = this;

    //Switch comes here.

    return transactionLogService;
  }
  , perform: function () {
    const oThis = this;
    return oThis.bulkService.perform();
  }
};

 module.exports = Service;
