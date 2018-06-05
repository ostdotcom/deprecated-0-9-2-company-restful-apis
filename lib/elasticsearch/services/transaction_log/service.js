"use strict";

/**
 * transaction_log elasticsearch service.
 *
 * @module elasticsearch/transaction_log/service
 */

const rootPrefix 		= "../../"
		, logger 				= require( rootPrefix + "/providers/logger" )
		, esServices		= require( rootPrefix + "/services/es_services/manifest")
;

const Service = function () {

};

Service.prototype = {
	constructor: Service
	, bulk: function () {

	}
	, create: function () {

	}
	, update: function () {

	}
	, delete: function () {

	}
	, search: function () {

	}
};

module.exports = new Service();