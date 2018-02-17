"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , statuses = {'1':'active', '2':'inactive', '3':'blocked'}
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'client_users'
;

/*
 * Public methods
 */
const clientUser = {

  getUser: function(clientUserId){
    return QueryDB.read(
      tableName,
      [],
      'id=?',
      [clientUserId]);
  },

  create: function (params) {

    var oThis = this
      , creatableFields = ['client_id', 'name', 'company_managed_address_id', 'total_tokens_in_wei', 'status']
      , createFields = []
      , setFieldsValues = []
    ;

    var invertedStatuses = util.invert(statuses);
    params["status"] = invertedStatuses[params["status"]] || 0;

    for(var i=0; i<creatableFields.length; i++){
      if(params[creatableFields[i]]){
        createFields.push(creatableFields[i]);
        setFieldsValues.push(params[creatableFields[i]])
      }
    }

    return QueryDB.insert(
      tableName,
      createFields,
      setFieldsValues
    );

  }

};

module.exports = clientUser;