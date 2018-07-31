'use strict';
const sortJson = require('sort-json');

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  KMSWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  configStartegyConstants = require(rootPrefix + '');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;


const  ConfigStrategyModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ConfigStrategyModel.prototype = Object.create(ModelBaseKlass.prototype);

const kind = {
  '1': configStartegyConstants.dynamo,
  '2': configStartegyConstants.dax,
  '3': configStartegyConstants.redis,
  '4': configStartegyConstants.memcached,
  '5': configStartegyConstants.value_geth,
  '6': configStartegyConstants.value_constants,
  '7': configStartegyConstants.utility_geth,
  '8': configStartegyConstants.utility_constants,
  '9': configStartegyConstants.autoscaling,
  '10': configStartegyConstants.es,
  '11': configStartegyConstants.constants

};
const ConfigStrategyModelSpecificPrototype = {
  tableName: 'config_strategies',



  sort_:function(){
    var params = {
      OST_REDIS_HOST:'12345',
      OST_REDIS_TLS_ENABLED:'fghj',
      OST_REDIS_PASS : 'fsfdsrsr'
    };
    const options = { ignoreCase: true, reverse: false, depth: 1};
    const new_params = sortJson(params , options);
    return new_params;
  },

  insertStrategyKind: function(kind, params){


   // insert into  config_strategies values ();

    /*
      get the plaintext
      get the local cipher of params

    */

    //returns strategy id autoincrement

  },

  getConfigById: function(clientId){

    const oThis = this;

    return oThis
      .select('*')``
      .where({clientId:clientId})
      .fire();
  },

  isPresent: function(params){

    //returns boolean
}

};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);
module.exports = ConfigStrategyModel;
