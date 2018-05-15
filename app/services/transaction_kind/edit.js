"use strict";

/**
 *
 * Edit existing action.
 *
 * @module app/services/transaction_kind/edit
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientTransactionTypeFromNameCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name')
  , ClientTransactionTypeFromIdCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , ActionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/action')
;

/**
 * Edit action constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.id - client id for whom setup is to be made.
 * @param {string} params.name (optional)- name of the action, unique
 * @param {string} params.currency- (optional) Currency. "USD" (fixed), or "BT" (floating)
 * @param {string<float>} params.amount - (optional) Amount, "USD" (min USD 0.01), or "BT" (min BT 0.00001)
 * @param {boolean} params.arbitrary_amount - (mandatory) true/false
 * @param {boolean} params.arbitrary_commission - (mandatory) true/false
 * @param {string<float>} params.commission_percent - (optional) Only for "user_to_user" kind. (min 0%, max 100%).
 *
 * @constructor
 */
const EditAction = function (params) {
  const oThis = this
  ;

  oThis.clientTransactionId = params.id;
  oThis.clientId = params.client_id;
  oThis.name = params.name;
  oThis.currency = params.currency;
  oThis.arbitraryAmount = params.arbitrary_amount;
  oThis.amount = params.amount;
  oThis.arbitraryCommission = params.arbitrary_commission;
  oThis.commissionPercent = params.commission_percent;

  oThis.transactionKindObj = {};
  oThis.dbRecord = null;
};

EditAction.prototype = {

  /**
   * perform
   *
   * @returns {promise}
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
            internal_error_identifier: 's_tk_e_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function () {

    const oThis = this
    ;

    await oThis._fetchDbRecord();

    await oThis._validatePrivilege();

    await oThis._validateParams();

    await oThis._editTransactionKind();

    return oThis._returnResponse();
  },

  /**
   * Fetch DB Record
   *
   * Sets oThis.dbRecord
   *
   * @return {promise<result>}
   */
  _fetchDbRecord: async function () {
    const oThis = this
    ;

    let dbRecords = await new ClientTransactionTypeModel()
      .getTransactionById({clientTransactionId: oThis.clientTransactionId});

    if(!dbRecords[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_e_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_client_transaction_id'],
        debug_options: {}
      }));
    }

    oThis.dbRecord = dbRecords[0];

    return responseHelper.successWithData({});
  },

  /**
   * Validate privilege
   *
   * @return {promise<result>}
   */
  _validatePrivilege: async function () {
    const oThis = this;

    // check if the action is from the same client id to which it belongs
    if (oThis.dbRecord['client_id'] != oThis.clientId) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_tk_e_2',
        api_error_identifier: 'invalid_client_transaction_id',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate params
   *
   * @sets transactionKindObj
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  _validateParams: async function () {
    const oThis = this
    ;

    let bt_amount = oThis.dbRecord.value_in_bt_wei ?
      basicHelper.convertToNormal(oThis.dbRecord.value_in_bt_wei) :
      null;

    let kind = new ClientTransactionTypeModel().kinds[oThis.dbRecord.kind.toString()]
      , currency = (oThis.currency
      || new ClientTransactionTypeModel().currencyTypes[oThis.dbRecord.currency_type]).toUpperCase()
      , amount = oThis.amount || oThis.dbRecord.value_in_usd || bt_amount
      , commission_percent = oThis.commissionPercent || oThis.dbRecord.commission_percent
      , errors_object = []
    ;

    amount = parseFloat(amount);

    /* Keep amount and currency type aligned in DB */
    if (currency == clientTxTypesConst.usdCurrencyType) {

      if (!commonValidator.validateArbitraryAmount(amount, oThis.arbitraryAmount)) {
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if (!commonValidator.validateUsdAmount(amount)) {
        errors_object.push('out_of_bound_transaction_usd_value');
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_bt_wei'] = null;
      oThis.transactionKindObj['value_in_usd'] = amount;

    } else if (currency == clientTxTypesConst.btCurrencyType) {

      if (!commonValidator.validateArbitraryAmount(amount, oThis.arbitraryAmount)) {
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if (!commonValidator.validateUsdAmount(amount)) { // This validation has to be in USD, since, value is modified
        errors_object.push('out_of_bound_transaction_bt_value');
      }

      if (!commonValidator.isVarNull(amount)) {
        var value_in_bt_wei = basicHelper.convertToWei(amount);

        if (!basicHelper.isWeiValid(value_in_bt_wei)) {
          errors_object.push('out_of_bound_transaction_bt_value');
        }
        oThis.transactionKindObj['value_in_bt_wei'] = basicHelper.formatWeiToString(value_in_bt_wei);
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_usd'] = null;

    } else {
      errors_object.push('invalid_currency_type');
    }

    /* Validate commission percent */
    commission_percent = parseFloat(commission_percent);
    if (kind == clientTxTypesConst.userToUserKind) {
      console.log('-------------------', 'commission_percent', commission_percent, 'oThis.arbitraryCommission', oThis.arbitraryCommission);
      if (!commonValidator.validateArbitraryCommissionPercent(commission_percent, oThis.arbitraryCommission)) {
        errors_object.push('invalid_commission_arbitrary_combination');
      } else if (!isNaN(commission_percent) && !commonValidator.commissionPercentValid(commission_percent)) {
        errors_object.push('invalid_commission_percent');
        console.log('-------2');
      }
    }

    if (!isNaN(commission_percent) && commission_percent > 0 && kind != clientTxTypesConst.userToUserKind) {
      errors_object.push('invalid_commission_percent');
    }

    /* Validate name */
    if (oThis.name) {
      oThis.name = oThis.name.trim();
    }

    if (oThis.name && oThis.dbRecord && oThis.dbRecord['name'].toLowerCase() != oThis.name.toLowerCase()) {

      if (!basicHelper.isTxKindNameValid(oThis.name)) {
        errors_object.push('invalid_transaction_name');
      } else if (basicHelper.hasStopWords(oThis.name)) {
        errors_object.push('inappropriate_transaction_name');
      } else {
        let existingTKind = await new ClientTransactionTypeModel()
          .getTransactionByName({
            clientId: oThis.clientId,
            name: oThis.name
          });

        if (existingTKind.length > 0 && oThis.clientTransactionId != existingTKind.id) {
          errors_object.push('duplicate_transaction_name');
        }
      }
    }

    /* Return all the validation errors */
    if (errors_object.length > 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_e_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * edit action in DB.<br><br>
   *
   * @return {promise<result>}
   */
  _editTransactionKind: async function () {
    const oThis = this
    ;

    if (oThis.name) oThis.transactionKindObj['name'] = oThis.name;

    if (oThis.commissionPercent) oThis.transactionKindObj['commission_percent'] = oThis.commissionPercent;

    await new ClientTransactionTypeModel().update(
      util.clone(oThis.transactionKindObj)
    ).where({id: oThis.clientTransactionId}).fire();


    new ClientTransactionTypeFromNameCache({
      client_id: oThis.dbRecord['client_id'],
      transaction_kind: oThis.dbRecord['name']
    }).clear();

    new ClientTransactionTypeFromIdCache({id: oThis.clientTransactionId}).clear();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>}
   */
  _returnResponse: async function () {
    const oThis = this
    ;

    let currency_type = oThis.transactionKindObj.currency_type || oThis.dbRecord.currency_type;

    let actionEntityFormatter = new ActionEntityFormatterKlass({
      id: oThis.clientTransactionId,
      client_id: oThis.dbRecord.client_id,
      name: oThis.name || oThis.dbRecord.name,
      currency: new ClientTransactionTypeModel().currencyTypes[currency_type],
      arbitrary_amount: oThis.arbitraryAmount,
      amount: oThis.amount,
      arbitrary_commission: oThis.arbitraryCommission,
      commission_percent: oThis.commissionPercent || oThis.dbRecord.commission_percent,
      kind: new ClientTransactionTypeModel().kinds[oThis.dbRecord.kind],
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

module.exports = EditAction;
