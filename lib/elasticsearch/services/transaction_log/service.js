"use strict";

/**
 * transaction_log elasticsearch service.
 *
 * @module elasticsearch/transaction_log/service
 */

const rootPrefix 			= "../.."
		, Constants				= require( rootPrefix + "/config/es_constants" )
		, logger 					= require( rootPrefix + "/providers/logger" )
		, esServices			= require( rootPrefix + "/services/es_services/manifest")
		, responseHelper  = require( rootPrefix + "/providers/responseHelper")
		, dataFormatter   = require( rootPrefix + "/services/transaction_log/dynamo_to_es_formatter")
		, Formatter       = require( rootPrefix + "/helpers/Formatter")
		, dynamoHelpers   = require( rootPrefix + "/helpers/dynamo_formatters")
		, BulkService   	= esServices.BulkService
		, CreateService 	= esServices.CreateService
		, SearchService		= esServices.SearchService
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

		return bulkService.perform();

	}
	, create: function ( eventName, data ) {
		const oThis = this;
		let createService = new CreateService();

		let populatePromise;
		populatePromise = oThis.formatDynamoData( data );

		return populatePromise
			.then( function ( formattedData ) {

				logger.log("\nformattedData:\n", formattedData );

				let dataId 			= formattedData.id
					, actionDesc	= {
						index	: Service.INDEX
						, id 	: dataId
						, type : Service.DOC_TYPE
					}
					;
				createService.setActionDescription(actionDesc);
				createService.setActionBody(formattedData);
				return createService.perform();

			})
			.catch( function ( reason ) {
				// Format Error.
				logger.error("Failed to format transaction_log record.\n Reason:", reason, "\n eventName:", eventName, "\n data:", JSON.stringify( data ));
			})

	}
	, update: function () {
		const oThis = this;

	}
	, delete: function () {
		const oThis = this;

	}
	, search: function ( queryBody ) {
		const oThis = this;

	}
	, populateBulkService: function ( eventName, data, bulkService ) {
		const oThis = this;

		let populatePromise;

		if ( Constants.DYNAMO_DELETE_EVENT_NAME === String( eventName ).toUpperCase() ) {
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
					case Constants.DYNAMO_DELETE_EVENT_NAME:
						actionDescKey = "delete";
						actionBody = null;
						break;
					case Constants.DYNAMO_INSERT_EVENT_NAME:
					case Constants.DYNAMO_UPDATE_EVENT_NAME:
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