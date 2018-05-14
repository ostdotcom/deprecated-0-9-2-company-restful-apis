"use strict";

/**
 * Add new transaction kind
 *
 * @module app/services/transaction_kind/add_new
 *
 */
const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , ClientTxKindCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type_count')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ActionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/action')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params (mandatory) - external passed parameters
 * @param {number} params.client_id (mandatory) - client id for whom setup is to be made.
 * @param {string} params.name (mandatory) - name of the action, unique
 * @param {string} params.kind (mandatory) - The kind of the kind, user_to_user, user_to_client, etc..
 * @param {string} params.currency (mandatory) - Type of currency. usd or bt
 * @param {boolean} params.arbitrary_amount (mandatory) - whether to use arbitrary amount/not
 * @param {string<float>} params.amount (optional) - Value of currency with respect to currency
 * @param {boolean} params.arbitrary_commission (optional) - Whether to use arbitrary commission or not
 * @param {string<float>} params.commission_percent (optional) - commission in percentage.
 *
 * @constructor
 *
 */
const AddNewAction = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.name = params.name;
  oThis.kind = params.kind;
  oThis.currency = params.currency;
  oThis.arbitraryAmount = params.arbitrary_amount;
  oThis.amount = params.amount;
  oThis.arbitraryCommission = params.arbitrary_commission;
  oThis.commissionPercent = params.commission_percent;

  oThis.transactionKindObj = {};
};

AddNewAction.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_tk_an_4',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      })
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>}
   *
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis.validateParams();

    await oThis.createTransactionKind();

    await oThis.clearCache();

    return oThis.returnResponse();
  },

  /**
   * Validate params<br><br>
   *
   * Sets oThis.transactionKindObj
   *
   * @return {promise<result>}
   */
  validateParams: async function () {
    const oThis = this
      , errors_object = []
    ;

    oThis.currency = (oThis.currency || '').toUpperCase();
    oThis.name = oThis.name.trim();

    if (!basicHelper.isTxKindNameValid(oThis.name)) {
      errors_object.push('invalid_transaction_name');
    } else if (basicHelper.hasStopWords(oThis.name)) {
      errors_object.push('inappropriate_transaction_name');
    }

    if (!new ClientTransactionTypeModel().invertedKinds[oThis.kind]) {
      errors_object.push('invalid_transactionkind');
    }

    if(!commonValidator.isVarNull(oThis.amount) && !(oThis.amount >= 0)){
      errors_object.push('invalid_amount');
    } else {

      if (oThis.currency == clientTxTypesConst.usdCurrencyType) {
        if (!commonValidator.validateArbitraryAmount(oThis.amount, oThis.arbitraryAmount)) {
          errors_object.push('invalid_amount_arbitrary_combination');
        } else if (!commonValidator.validateUsdAmount(oThis.amount)) {
          errors_object.push('out_of_bound_transaction_usd_value');
        }
        oThis.transactionKindObj.value_in_usd = oThis.amount;
      } else if (oThis.currency == clientTxTypesConst.btCurrencyType) {
        if (!commonValidator.validateArbitraryAmount(oThis.amount, oThis.arbitraryAmount)) {
          errors_object.push('invalid_amount_arbitrary_combination');
        } else if (!commonValidator.validateBtAmount(oThis.amount)) {
          errors_object.push('out_of_bound_transaction_bt_value');
        }

        if (!commonValidator.isVarNull(oThis.amount)) {
          let value_in_bt_wei = basicHelper.convertToWei(oThis.amount);
          if (!basicHelper.isWeiValid(value_in_bt_wei)) {
            errors_object.push('out_of_bound_transaction_bt_value');
          }
          oThis.transactionKindObj.value_in_bt_wei = basicHelper.formatWeiToString(value_in_bt_wei);
        }
      } else {
        errors_object.push('invalid_currency');
      }
    }

    if(oThis.kind != clientTxTypesConst.userToUserKind) {
      if (!commonValidator.isVarNull(oThis.commissionPercent)) {
        errors_object.push('invalid_commission_percent');
      }
      if (!commonValidator.isVarNull(oThis.arbitraryCommission)) {
        errors_object.push('invalid_arbitrary_commission');
      }
    } else {
      if (!commonValidator.commissionPercentValid(oThis.commissionPercent)) {
        errors_object.push('invalid_commission_percent');
      } else if (!commonValidator.validateArbitraryCommissionPercent(oThis.commissionPercent, oThis.arbitraryCommission)) {
        errors_object.push('invalid_commission_arbitrary_combination');
      }
    }

    let existingTKind = await new ClientTransactionTypeModel().getTransactionByName({clientId: oThis.clientId, name: oThis.name});

    if (existingTKind.length > 0) {
      errors_object.push('duplicate_transaction_name');
    }

    console.log("-------errors_object---", errors_object);
    if (errors_object.length > 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_an_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    oThis.transactionKindObj.client_id = oThis.clientId;
    oThis.transactionKindObj.name = oThis.name;
    oThis.transactionKindObj.kind = oThis.kind;
    oThis.transactionKindObj.currency_type = oThis.currency;
    oThis.transactionKindObj.commission_percent = oThis.commissionPercent;
    oThis.transactionKindObj.status = 'active';

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Create new kind in DB<br><br>
   *
   * Sets oThis.transactionKindObj.id
   *
   * @return {promise<result>}
   */
  createTransactionKind: async function () {
    const oThis = this
    ;

    const cloneObj = util.clone(oThis.transactionKindObj);
    cloneObj.kind = new ClientTransactionTypeModel().invertedKinds[cloneObj.kind];
    cloneObj.currency_type = new ClientTransactionTypeModel().invertedCurrencyTypes[cloneObj.currency_type];
    cloneObj.status = new ClientTransactionTypeModel().invertedStatuses[cloneObj.status];

    const clientTransactionKind = await new ClientTransactionTypeModel().insert(cloneObj).fire();
    oThis.transactionKindObj.id = clientTransactionKind.insertId;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Flush Memcache.<br><br>
   *
   * @return {promise<result>}
   */
  clearCache: function () {
    const oThis = this
      , cacheObj = new ClientTxKindCntCacheKlass({clientId: oThis.clientId});

    return cacheObj.clear();
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  returnResponse: async function () {
    const oThis = this
    ;

    let actionEntityFormatter = new ActionEntityFormatterKlass({
      id: oThis.transactionKindObj.id,
      client_id: oThis.transactionKindObj.client_id,
      name: oThis.transactionKindObj.name,
      kind: oThis.transactionKindObj.kind,
      currency: oThis.currency,
      arbitrary_amount: oThis.arbitraryAmount,
      amount: oThis.amount,
      arbitrary_commission: oThis.arbitraryCommission,
      commission_percent: oThis.transactionKindObj.commission_percent,
      uts: Date.now()
    });

    let actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "action",
        action: actionEntityFormatterRsp.data
      }
    ));
  }
};

module.exports = AddNewAction;
