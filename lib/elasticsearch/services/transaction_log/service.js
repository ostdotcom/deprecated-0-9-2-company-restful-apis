"use strict";

/**
 * transaction_log elasticsearch service.
 *
 * @module elasticsearch/transaction_log/service
 */

const rootPrefix 			= "../.."
		, logger 					= require( rootPrefix + "/providers/logger" )
		, esServices			= require( rootPrefix + "/services/es_services/manifest")
		, responseHelper  = require( rootPrefix + "/providers/responseHelper")
		, dataFormatter   = require( rootPrefix + "/services/transaction_log/dynamo_to_es_formatter")
		, Formatter       = require( rootPrefix + "/helpers/Formatter")
		, dynamoHelpers   = require( rootPrefix + "/helpers/dynamo_formatters")
		, BulkService   	= esServices.BulkService
		, CreateService 	= esServices.CreateService
;

const Service = function () {
	const oThis = this;

};

Service.INDEX = "transaction_logs";
Service.DYNAMO_ID_KEY = "txu";
Service.DOC_TYPE = "_doc";

Service.prototype = {
	constructor: Service
	, bulk: function ( eventName, arData ) {
		const oThis = this;
		
		if ( !arData instanceof Array ) {
			//@Rachin : Change this.
			arData = [ arData ];
		}

		let len = arData.length
			, bulkService = new BulkService()
			, cnt = 0
			, data
		;

		for( cnt = 0; cnt < len; cnt++ ) {
			data = arData[ cnt ];
			oThis.populateBulkService( eventName, data, bulkService);	
		}

		return oThis.bulkService.perform();

	}
	, create: function ( params ) {
		const oThis = this;

		if ( oThis.validateParams( params ) ) { 
			let formattedParams = oThis.formatDynamoData( params )
				, service = new CreateService( formattedParams )
			;
			
			return service.perform();
		} else {
			//Return response with error.
			let response = responseHelper.error({
				internal_error_identifier: "l_es_s_tl_s_c"
				, api_error_identifier: "invalid_params"
			});
			return Promise.reject( response );
		}

	}
	, update: function () {
		const oThis = this;

	}
	, delete: function ( ) {
		const oThis = this;

	}
	, search: function () {
		const oThis = this;

	}
	, populateBulkService: function ( eventName, data, bulkService ) {
		const oThis = this;

		let populatePromise;

		if ( "DELETE" === String( eventName ).toUpperCase() ) {
			populatePromise = new Promise( function ( resolve, reject ) {
				let dataId = dynamoHelpers.val( Service.DYNAMO_ID_KEY );
				if ( Formatter.isNull( dataId ) ) {
					reject( new Error("Could not determine the id of record to delete.") );
				}
				resolve({
					id: dataId
				});
			});
		} else {
			populatePromise = oThis.formatDynamoData( data );
		}

		return populatePromise
			.then( function ( formattedData ) {
				// Data successfully formatted.
				logger.log("\nformattedData:\n", formattedData );

				let dataId 			= formattedData.id
					, actionDescKey
					, actionDescPayload	= {
						_index	: Service.INDEX
						, _id 	: dataId
						, _type : Service.DOC_TYPE
					}
					, actionDesc
					, actionBody
				;

				switch( String( eventName ).toUpperCase() ) {
					case "DELETE":
						actionDescKey = "delete";
						actionBody = null;
						break;
					case "INSERT":
					case "UPDATE":
						actionDescKey = "index";
						actionBody 		= formattedData;
						break;
					default:
						throw "Unrecognised dynamo event name: '" + eventName + "'";
				}

				actionDesc = {};
				actionDesc[ actionDescKey ] = actionDescPayload;
				bulkService.addRequestParams(actionDesc);
				if ( actionBody ) {
					bulkService.addRequestParams( actionBody );
				}
			})
			.catch( function ( reason ) {
				// Format Error.
				logger.error("Failed to format transaction_log record.\n Reason:", reason, "\n eventName:", eventName, "\n data:", JSON.stringify( data ));
			})
	}
	, formatDynamoData: function ( data ) {
		return new Promise( function (resolve,reject) {
			let formattedData = dataFormatter.format( data );
			resolve( formattedData )
		});
	}
};

module.exports = new Service();