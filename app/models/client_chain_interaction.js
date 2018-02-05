"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , statuses = {'1':'pending', '2':'processed', '3':'failed'}
  , chain_types = {'1':'value', '2':'utility'}
  , activity_types = {'1':'request_ost', '2':'transfer_to_staker'}
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'client_chain_interactions'
;

/*
 * Public methods
 */
const clientChainInteraction = {

  getClientInteractions: function(clientId){
    return QueryDB.read(
      tableName,
      [],
      'client_id=?',
      [clientId]);
  },

  create: function (params) {

    var oThis = this
      , creatableFields = ['client_id', 'client_token_id', 'activity_type', 'chain_type', 'transaction_hash', 'debug_data', 'status']
      , createFields = []
      , setFieldsValues = []
    ;

    var invertedStatuses = util.invert(statuses);
    params["status"] = invertedStatuses[params["status"]] || 0;
    var invertedChainTypes = util.invert(chain_types);
    params["chain_type"] = invertedChainTypes[params["chain_type"]] || null;
    var invertedActivities = util.invert(activity_types);
    params["activity_type"] = invertedActivities[params["activity_type"]] || null;

    for(var i=0; i<creatableFields.length; i++){
      if(params[creatableFields[i]]){
        console.log("------$$$$$----", creatableFields[i], "=>",params[creatableFields[i]]);
        createFields.push(creatableFields[i]);
        setFieldsValues.push(params[creatableFields[i]])
      }
    }

    return QueryDB.insert(
      tableName,
      createFields,
      setFieldsValues
    );

  },

  getRequestOstActivity: function () {
    var invertedActivities = util.invert(activity_types);
    return invertedActivities['request_ost'];
  }

};

module.exports = clientChainInteraction;