'use strict';

/**
 *
 * Edit existing action.
 *
 * @module app/services/transaction_kind/edit
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  util = require(rootPrefix + '/lib/util'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  ActionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/action');

require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name');
require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id');

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
const EditAction = function(params) {
  const oThis = this;

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
  oThis.updatedValues = {};
  oThis.paramsErrorIdentifiersMap = {};
};

EditAction.prototype = {
  /**
   * perform
   *
   * @returns {promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
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
  asyncPerform: async function() {
    const oThis = this;

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
  _fetchDbRecord: async function() {
    const oThis = this;

    let dbRecords = await new ClientTransactionTypeModel().getTransactionById({
      clientTransactionId: oThis.clientTransactionId
    });

    if (!dbRecords[0]) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_tk_e_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_client_transaction_id'],
          debug_options: {}
        })
      );
    }

    oThis.dbRecord = dbRecords[0];

    return responseHelper.successWithData({});
  },

  /**
   * Validate privilege
   *
   * @return {promise<result>}
   */
  _validatePrivilege: async function() {
    const oThis = this;

    // check if the action is from the same client id to which it belongs
    if (oThis.dbRecord['client_id'] != oThis.clientId) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_tk_e_3',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_client_transaction_id'],
          debug_options: {}
        })
      );
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate params
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  _validateParams: async function() {
    const oThis = this;

    await oThis._validateCommissionParams();

    await oThis._validateCurrencyType();

    await oThis._validateName();

    let paramsErrorIdentifiers = Object.keys(oThis.paramsErrorIdentifiersMap);

    /* Return all the validation errors */
    if (paramsErrorIdentifiers.length > 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_tk_e_4',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: paramsErrorIdentifiers,
          debug_options: {}
        })
      );
    }
  },

  /**
   * Validate params
   *
   * @sets updatedValues, errors_object
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  _validateCommissionParams: async function() {
    const oThis = this,
      kind = new ClientTransactionTypeModel().kinds[oThis.dbRecord.kind.toString()];

    if (kind == clientTxTypesConst.userToUserKind) {
      // commission params are allowed here.
      // validate commission params if present in request.
      if (
        !commonValidator.isVarNull(oThis.commissionPercent) &&
        !commonValidator.isVarNull(oThis.arbitraryCommission)
      ) {
        if (!commonValidator.validateArbitraryCommissionPercent(oThis.commissionPercent, oThis.arbitraryCommission)) {
          oThis.paramsErrorIdentifiersMap['invalid_commission_arbitrary_combination'] = 1;
        }
        oThis.updatedValues.commission_percent = oThis.commissionPercent;
      } else if (!commonValidator.isVarNull(oThis.commissionPercent)) {
        if (commonValidator.isVarNull(oThis.dbRecord.commission_percent)) {
          oThis.paramsErrorIdentifiersMap['arbitrary_commission_already_set_to_true'] = 1;
        }
        oThis.updatedValues.commission_percent = oThis.commissionPercent;
      } else if (!commonValidator.isVarNull(oThis.arbitraryCommission)) {
        if (commonValidator.isVarTrue(oThis.arbitraryCommission)) {
          oThis.updatedValues.commission_percent = null;
        } else if (commonValidator.isVarFalse(oThis.arbitraryCommission)) {
          if (commonValidator.isVarNull(oThis.dbRecord.commission_percent)) {
            // Error case, as commission_percent is mandatory in case of arbitraryCommission is false.
            oThis.paramsErrorIdentifiersMap['invalid_arbitrary_commission'] = 1;
          }
        } else {
          oThis.paramsErrorIdentifiersMap['invalid_arbitrary_commission'] = 1;
        }
      }
    } else {
      // error if commission params are present in request.
      if (!commonValidator.isVarNull(oThis.commissionPercent)) {
        oThis.paramsErrorIdentifiersMap['invalid_commission_percent'] = 1;
      }
      if (!commonValidator.isVarNull(oThis.arbitraryCommission)) {
        oThis.paramsErrorIdentifiersMap['invalid_arbitrary_commission'] = 1;
      }
    }
  },

  /**
   * Validate currency type
   *
   * @sets updatedValues, errors_object
   *
   * @return {}
   *
   */
  _validateCurrencyType: async function() {
    const oThis = this;
    var currency = null;

    //If trying to edit currency type, its mandatory to mention amount parameters.
    if (!commonValidator.isVarNull(oThis.currency)) {
      currency = oThis.currency.toUpperCase().trim();
      if (commonValidator.isVarNull(oThis.amount) && commonValidator.isVarNull(oThis.arbitraryAmount)) {
        oThis.paramsErrorIdentifiersMap['invalid_amount'] = 1;
      }
      oThis.updatedValues.currency_type = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];

      if (commonValidator.isVarNull(oThis.updatedValues.currency_type)) {
        oThis.paramsErrorIdentifiersMap['invalid_currency_type'] = 1;
      }
    } else {
      currency = new ClientTransactionTypeModel().currencyTypes[oThis.dbRecord.currency_type].toUpperCase();
    }

    /* Keep amount and currency type aligned in DB */
    if (currency == clientTxTypesConst.usdCurrencyType) {
      oThis._validateAmount('value_in_usd');
      if (
        !commonValidator.isVarNull(oThis.updatedValues.value_in_usd) &&
        !commonValidator.validateUsdAmount(oThis.updatedValues.value_in_usd)
      ) {
        oThis.paramsErrorIdentifiersMap['out_of_bound_transaction_usd_value'] = 1;
      }
      oThis.updatedValues.value_in_bt_wei = null;
    } else if (currency == clientTxTypesConst.btCurrencyType) {
      oThis._validateAmount('value_in_bt_wei');

      if (!commonValidator.isVarNull(oThis.updatedValues.value_in_bt_wei)) {
        if (!commonValidator.validateBtAmount(oThis.updatedValues.value_in_bt_wei)) {
          oThis.paramsErrorIdentifiersMap['out_of_bound_transaction_bt_value'] = 1;
        } else {
          var value_in_bt_wei = basicHelper.convertToWei(oThis.updatedValues.value_in_bt_wei);
          oThis.updatedValues.value_in_bt_wei = basicHelper.formatWeiToString(value_in_bt_wei);
        }
      }

      oThis.updatedValues.value_in_usd = null;
    } else if (!commonValidator.isVarNull(currency)) {
      oThis.paramsErrorIdentifiersMap['invalid_currency_type'] = 1;
    }
  },

  /**
   * Validate name
   *
   * @sets errors_object
   *
   * @return {}
   *
   */
  _validateName: async function() {
    const oThis = this;

    /* Validate name */
    if (oThis.name) {
      oThis.name = oThis.name.trim();
    }

    if (oThis.name && oThis.dbRecord.name.toLowerCase() != oThis.name.toLowerCase()) {
      if (!basicHelper.isTxKindNameValid(oThis.name)) {
        oThis.paramsErrorIdentifiersMap['invalid_transaction_name'] = 1;
      } else if (basicHelper.hasStopWords(oThis.name)) {
        oThis.paramsErrorIdentifiersMap['inappropriate_transaction_name'] = 1;
      } else {
        let existingTKind = await new ClientTransactionTypeModel().getTransactionByName({
          clientId: oThis.clientId,
          name: oThis.name
        });

        if (existingTKind.length > 0 && oThis.clientTransactionId != existingTKind.id) {
          oThis.paramsErrorIdentifiersMap['duplicate_transaction_name'] = 1;
        }
      }
      oThis.updatedValues.name = oThis.name;
    }
  },

  /**
   * Validate amounts with respective params
   *
   * @sets updatedValues, errors_object
   *
   * @return {}
   *
   */
  _validateAmount: function(editCurrType) {
    const oThis = this;

    if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.isVarNull(oThis.arbitraryAmount)) {
      if (!commonValidator.validateArbitraryAmount(oThis.amount, oThis.arbitraryAmount)) {
        oThis.paramsErrorIdentifiersMap['invalid_amount_arbitrary_combination'] = 1;
      }
      oThis.updatedValues[editCurrType] = oThis.amount;
    } else if (!commonValidator.isVarNull(oThis.amount)) {
      if (commonValidator.isVarNull(oThis.dbRecord[editCurrType])) {
        oThis.paramsErrorIdentifiersMap['invalid_amount_arbitrary_combination'] = 1;
      }
      oThis.updatedValues[editCurrType] = oThis.amount;
    } else if (!commonValidator.isVarNull(oThis.arbitraryAmount)) {
      if (commonValidator.isVarTrue(oThis.arbitraryAmount)) {
        oThis.updatedValues[editCurrType] = null;
      } else if (commonValidator.isVarFalse(oThis.arbitraryAmount)) {
        oThis.paramsErrorIdentifiersMap['invalid_amount'] = 1;
      } else {
        oThis.paramsErrorIdentifiersMap['invalid_arbitrary_amount'] = 1;
      }
    }
  },

  /**
   * edit action in DB.<br><br>
   *
   * @return {promise<result>}
   */
  _editTransactionKind: async function() {
    const oThis = this,
      ClientTransactionTypeFromNameCache = oThis.ic().getClientTransactionTypeByNameCache(),
      ClientTransactionTypeFromIdCache = oThis.ic().getClientTransactionTypeByIdCache();

    logger.debug('-----------oThis.updatedValues-', oThis.updatedValues);

    if (Object.keys(oThis.updatedValues).length > 0) {
      Object.assign(oThis.dbRecord, oThis.updatedValues);

      await new ClientTransactionTypeModel()
        .update(util.clone(oThis.dbRecord))
        .where({ id: oThis.clientTransactionId })
        .fire();

      new ClientTransactionTypeFromNameCache({
        client_id: oThis.dbRecord['client_id'],
        transaction_kind: oThis.dbRecord['name']
      }).clear();

      new ClientTransactionTypeFromIdCache({ id: oThis.clientTransactionId }).clear();
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>}
   */
  _returnResponse: async function() {
    const oThis = this;

    let actionEntityFormatter = new ActionEntityFormatterKlass(oThis.dbRecord);

    let actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(
      responseHelper.successWithData({
        result_type: 'action',
        action: actionEntityFormatterRsp.data
      })
    );
  }
};

InstanceComposer.registerShadowableClass(EditAction, 'getEditActionClass');

module.exports = EditAction;
