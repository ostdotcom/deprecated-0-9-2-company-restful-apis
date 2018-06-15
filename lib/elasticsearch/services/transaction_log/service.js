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
		, UpdateService		= esServices.UpdateService
		, DeleteService		= esServices.DeleteService
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
	, create: function ( data ) {
		const oThis = this;
		let service = new CreateService();

		return oThis.formatDynamoData( data )
			.then( function ( formattedData ) {
				logger.debug("\nformattedData:\n", formattedData );
				let dataId 			= formattedData.id
					, actionDesc	= {
						index	: Service.INDEX
						, id 	: dataId
						, type : Service.DOC_TYPE
					}
				;
				service.setActionDescription(actionDesc);
				service.setRequestBody(formattedData);
				return service.perform();

			})
			.catch( function ( reason ) {
				// Format Error.
				logger.error("Failed to format transaction_log record.\n Reason:", reason, "\n data:", JSON.stringify( data ));

				return responseHelper.error({
          internal_error_identifier: 'l_es_s_tl_s_c',
          api_error_identifier: 'invalid_params'
				});
			})
		;

	}
	, update: function ( data ) {
		const oThis = this;
		let service = new UpdateService();

		return oThis.formatDynamoData( data )
			.then( function ( formattedData ) {
				logger.debug("\nformattedData:\n", formattedData );
				let dataId 			= formattedData.id
					, actionDesc	= {
						index	: Service.INDEX
						, id 	: dataId
						, type : Service.DOC_TYPE
					}
				;
				service.setActionDescription(actionDesc);
				service.setRequestBody(formattedData);
				return service.perform();

			})
			.catch( function ( reason ) {
				// Format Error.
				logger.error("Failed to format transaction_log record.\n Reason:", reason, "\n data:", JSON.stringify( data ));

				return responseHelper.error({
          internal_error_identifier: 'l_es_s_tl_s_u',
          api_error_identifier: 'invalid_params'
				});
			})
		;
	}
	, delete: function ( dataId ) {
		const oThis = this;
		let service = new DeleteService();
		let actionDesc	= {
				index		: Service.INDEX
				, id 		: dataId
				, type 	: Service.DOC_TYPE
			}
		;
		service.setActionDescription(actionDesc);
		return service.perform();
	}

	/* *
	* queryBody - query for ES
	* Eg queryBody : {
	*			"query": {
	*		  		"match": {
	*					"updated_at": ua
	*		 			 }
	*				},
	*			"from": 0,
	*			"size": 10
	*	 		}
	* requestSource - Fields to get from ES , default will get complete document.
	* Eg requestSource : ["id", "from_uuid", ...];
	* */
	, search: function ( queryBody , requestSource ) {
		const oThis = this;
		let service = new SearchService();
		let actionDesc	= {
				index		: Service.INDEX
		};
		service.setActionDescription(actionDesc);
		if ( queryBody ) {
			service.setRequestBody( queryBody );
		}
		if( requestSource ){
            service.setRequestSource( requestSource );
		}
		return service.perform();
	}
	, populateBulkService: function ( eventName, data, bulkService ) {
		const oThis = this;

		let populatePromise;

		if ( Constants.DYNAMO_DELETE_EVENT_NAME === String( eventName ).toUpperCase() ) {
			populatePromise = new Promise( function ( resolve, reject ) {
				if ( !data[Service.DYNAMO_ID_KEY] ) {
					reject("Could not determine the id of record to delete.");
				}

				let dataId = dynamoHelpers.val( data[Service.DYNAMO_ID_KEY] );
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