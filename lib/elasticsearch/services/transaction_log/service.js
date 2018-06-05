"use strict";

/**
 * transaction_log elasticsearch service.
 *
 * @module elasticsearch/transaction_log/service
 */

const rootPrefix 			= "../../"
		, logger 					= require( rootPrefix + "/providers/logger" )
		, esServices			= require( rootPrefix + "/services/es_services/manifest")
		, responseHelper  = require(rootPrefix + "/providers/responseHelper")
		, BulkService   	= esServices.BulkService
		, CreateService 	= esServices.CreateService
;

const Service = function () {
	const oThis = this;

};

Service.prototype = {
	constructor: Service
	, bulk: function ( arParams ) {
		const oThis = this;
		
		if ( !arParams instanceof Array ) {
			//@Rachin : Change this.
			arParams = [ arParams ];
		}

		let len = arParams.length
			, cnt = 0
			, bulkService = new BulkService()
			, params
			, invalidParams = []
		;

		for( cnt = 0; cnt < len; cnt++ ) {
			params = arParams[ cnt ];
			if ( oThis.validateParams( params ) ) {
				oThis.popluateBulkService( bulkService, params);	
			} else {
				invalidParams.push( params );
			}
		}

		return oThis.bulkService.perform();

	}
	, create: function ( params ) {
		const oThis = this;

		if ( oThis.validateParams( params ) ) { 
			let formattedParams = oThis.formatParams( params )
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
	, popluateBulkService: function ( bulkService, params ) {
		const oThis = this;

	}
	, validateParams: function ( params ) {
		//Validate Here.
		return true;
	}
	, formatParams: function ( params ) {
		return params;
	}
};

module.exports = new Service();