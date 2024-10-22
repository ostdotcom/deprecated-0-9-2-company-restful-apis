'use strict';

/**
 *
 * Return existing action
 *
 * @module app/services/transaction_kind/get
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types'),
  ActionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/action'),
  commonValidator = require(rootPrefix + '/lib/validators/common');

/**
 * Get an action
 *
 * @param params
 * @param {number} params.client_id - client_id for action fetch
 * @param {number} params.id - id of the action to fetch
 *
 * @constructor
 */
const GetAction = function(params) {
  const oThis = this;

  oThis.id = params.id;
  oThis.clientId = params.client_id;
  oThis.transactionTypes = [];
};

GetAction.prototype = {
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
          internal_error_identifier: 's_tk_g_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform
   *
   * @returns {promise}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis.validateAssignParams();

    await oThis.getTransactionKind();

    return oThis.returnResponse();
  },

  /**
   * validateAssignParams - Perform validations on input params and assign for use
   *
   * @returns {promise}
   */
  validateAssignParams: async function() {
    const oThis = this;

    if (isNaN(oThis.id)) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_tk_g_2',
          api_error_identifier: 'data_not_found',
          debug_options: { clientId: oThis.clientId }
        })
      );
    }

    return Promise.resolve({});
  },

  /**
   * getTransactionKind - Get the transaction kind record from DB
   *
   * @returns {promise}
   */
  getTransactionKind: async function() {
    const oThis = this;

    const result = await new ClientTransactionTypeModel().getTransactionById({ clientTransactionId: oThis.id });

    oThis.result = result[0];

    if (!oThis.result) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_tk_g_3',
          api_error_identifier: 'data_not_found',
          debug_options: { clientId: oThis.clientId }
        })
      );
    }

    if (oThis.result.client_id != oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_tk_g_4',
          api_error_identifier: 'data_not_found',
          debug_options: { clientId: oThis.clientId }
        })
      );
    }

    if (result.currency_type == clientTxTypesConst.btCurrencyType) {
      oThis.amount = basicHelper.formatWeiToString(basicHelper.convertToNormal(oThis.result.value_in_bt_wei));
    } else {
      oThis.amount = oThis.result.value_in_usd;
    }

    oThis.arbitrary_amount = commonValidator.isVarNull(oThis.amount);
    oThis.arbitrary_commission = commonValidator.isVarNull(oThis.result.commission_percent);

    return Promise.resolve({});
  },

  /**
   * returnResponse - format and return the response
   *
   * @returns {promise}
   */
  returnResponse: async function() {
    const oThis = this;

    let actionEntityFormatter = new ActionEntityFormatterKlass(oThis.result);

    let actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(
      responseHelper.successWithData({
        result_type: 'action',
        action: actionEntityFormatterRsp.data
      })
    );
  }
};

InstanceComposer.registerShadowableClass(GetAction, 'getGetActionClass');

module.exports = GetAction;
