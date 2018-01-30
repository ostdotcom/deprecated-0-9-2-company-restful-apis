"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , statuses = {'1':'active', '2':'inactive', '3':'blocked'}
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
;

/*
 * Public methods
 */
const clientUser = {

  getUser: function(clientUserId){
    return QueryDB.read('client_users',
      [],
      'id=?',
      [clientUserId]);
  },

  create: function (params) {

    var oThis = this
      , creatableFields = ['client_id', 'name', 'ethereum_address', 'hashed_ethereum_address', 'passphrase', 'total_tokens_in_wei', 'status']
      , createFields = []
      , setFieldsValues = []
    ;

    var invertedStatuses = util.invert(statuses);
    params["status"] = invertedStatuses[params["status"]] || 0;

    for(var i=0; i<creatableFields.length; i++){
      if(params[creatableFields[i]]){
        console.log("------$$$$$----", creatableFields[i], "=>",params[creatableFields[i]]);
        createFields.push(creatableFields[i]);
        setFieldsValues.push(params[creatableFields[i]])
      }
    }

    return QueryDB.insert(
      'client_users',
      createFields,
      setFieldsValues
    );

  }

};

module.exports = clientUser;