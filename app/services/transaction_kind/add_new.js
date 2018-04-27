"use strict";

/**
 * Add new transaction kind
 *
 * @module app/services/transaction_kind/add_new
 *
 */
var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , ClientTxKindCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type_count')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom setup is to be made.
 * @param {string} params.name - Name of the transaction kind eg. voteUp, voteDown, etc..
 * @param {string} params.kind - The kind of the kind, user_to_user, user_to_client, etc..
 * @param {string} params.currency_type - Type of currency. usd or bt
 * @param {decimal} params.currency_value - Value of currency with respect to currency_type
 * @param {decimal} params.commission_percent - commission in percentage.
 *
 * @constructor
 *
 */
const AddNew = function(params){

  var oThis = this;

  oThis.params = params || {};

  oThis.transactionKindObj = {};

};

AddNew.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_tk_an_4", "Unhandled result", {}, {sendErrorEmail: false});
        }
      })
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.createTransactionKind();
    if(r.isFailure()) return Promise.resolve(r);

    oThis.clearCache();

    return oThis.returnResponse();

  },

  /**
   * Validate params<br><br>
   *
   * @sets transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  validateParams: async function(){
    var oThis = this
      , client_id = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , currency_type = (oThis.params.currency_type || '').toUpperCase()
      , currency_value = oThis.params.currency_value
      , commission_percent = oThis.params.commission_percent
      , errors_object = {}
    ;

    if(!client_id || client_id==0){
      return Promise.resolve(responseHelper.error('s_tk_an_1', 'invalid Client', {}, {sendErrorEmail: false}));
    }

    if (name) {
      name = name.trim();
    }

    if(!basicHelper.isTxKindNameValid(name)){
      errors_object['name'] = 'Only letters, numbers and spaces allowed. (3 to 20 characters)';
    } else if (basicHelper.hasStopWords(name)) {
      errors_object['name'] = 'Come on, the ' + name + ' you entered is inappropriate. Please choose a nicer word.';
    }

    if(!kind || !new ClientTransactionTypeModel().invertedKinds[kind]){
      errors_object['kind'] = 'invalid kind';
    }

    if (currency_type == 'USD' ) {
      if(!currency_value || currency_value < 0.01 || currency_value > 100){
        errors_object['currency_value'] = 'Value of a transaction in $USD is out of range. Min value is 0.01$ and Max value is 100$ ';
      }
      oThis.transactionKindObj.value_in_usd = currency_value;
    } else if (currency_type == 'BT' ){
      if(!currency_value || currency_value < 0.00001 || currency_value > 100){
        errors_object['currency_value'] = 'Value of a transaction is out of range. Min value is 0.00001 and Max value is 100';
      }
      var value_in_bt_wei = basicHelper.convertToWei(currency_value);
      if(!basicHelper.isWeiValid(value_in_bt_wei)){
        errors_object['currency_value'] = 'currency value in BT is not valid';
      }
      oThis.transactionKindObj.value_in_bt_wei = basicHelper.formatWeiToString(value_in_bt_wei);
    } else {
      errors_object['currency_type'] = 'Atleast one currency type(USD or BT) to mention';
    }

    if(!commission_percent || parseInt(commission_percent) < 0 || parseFloat(commission_percent) > 100){
      errors_object['commission_percent'] = 'Invalid Commission Percentage.';
    }

    if(parseFloat(commission_percent) > 0 && kind != clientTxTypesConst.userToUserKind){
      errors_object['commission_percent'] = 'Commission Percentage is allowed only for user to user Transactions.';
    }

    var existingTKind = await new ClientTransactionTypeModel().getTransactionByName({clientId: client_id, name: name});
    if(existingTKind.length > 0){
      errors_object['name'] = 'Transaction kind name "'+ name +'" already present.';
    }

    if(Object.keys(errors_object).length > 0){
      return Promise.resolve(responseHelper.error('s_tk_an_2', 'invalid params', [errors_object],
        {sendErrorEmail: false}));
    }

    oThis.transactionKindObj.client_id = client_id;
    oThis.transactionKindObj.name = name;
    oThis.transactionKindObj.kind = kind;
    oThis.transactionKindObj.currency_type = currency_type;
    oThis.transactionKindObj.commission_percent = commission_percent;
    oThis.transactionKindObj.status = 'active';

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Create new kind in DB.<br><br>
   *
   * @set transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  createTransactionKind: async function(){
    const oThis = this
    ;

    const newObj = util.clone(oThis.transactionKindObj);
    newObj.kind = new ClientTransactionTypeModel().invertedKinds[newObj.kind];
    newObj.currency_type = new ClientTransactionTypeModel().invertedCurrencyTypes[newObj.currency_type];
    newObj.status = new ClientTransactionTypeModel().invertedStatuses[newObj.status];

    const clientTransactionKind = await new ClientTransactionTypeModel().insert(newObj).fire();
    oThis.transactionKindObj.id = clientTransactionKind.insertId;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Flush Memcache.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  clearCache: function(){

    const oThis = this
        , cacheObj = new ClientTxKindCntCacheKlass({clientId: oThis.params.client_id});

    cacheObj.clear();

  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  returnResponse: function(){
    var oThis = this;
    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "transactions",
        transactions: [{
          id: oThis.transactionKindObj.id,
          client_id: oThis.transactionKindObj.client_id,
          name: oThis.transactionKindObj.name,
          kind: oThis.transactionKindObj.kind,
          currency_type: oThis.params.currency_type,
          currency_value: oThis.params.currency_value,
          commission_percent: oThis.transactionKindObj.commission_percent,
          status: oThis.transactionKindObj.status,
          device_id: oThis.params.device_id,
          uts: Date.now()
        }]
      }
    ));
  }

};

module.exports = AddNew;
