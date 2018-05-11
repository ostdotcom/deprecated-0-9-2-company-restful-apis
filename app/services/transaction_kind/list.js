"use strict";

/**
 *
 * Return transaction kind list.
 *
 * @module app/services/transaction_kind/list
 */


var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ActionEntityFormatterKlass = require(rootPrefix +'/lib/formatter/entities/latest/action')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
;

/**
 * List - Service for getting the list of transaction kinds
 *
 * @param params
 * @constructor
 */
const List = function(params) {

  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.page_no = params.page_no || 1;
  oThis.order_by = (params.order_by || 'created').toLowerCase();
  oThis.order = (params.order || 'desc').toLowerCase();
  oThis.limit = (params.limit || 10) + 1;
  oThis.offset = (oThis.page_no - 1) * oThis.limit;
  oThis.extra_entities = params.extra_entities || [];
  oThis.where = {};

  if(params.id) {
    oThis.where.id = basicHelper.commaSeperatedStrToArray(params.id);
    oThis.id = oThis.where.id;
  }
  if(params.name) {
    oThis.where.name = basicHelper.commaSeperatedStrToArray(params.name);
    oThis.name = oThis.where.name;
  }
  if(params.kind) {
    oThis.kind = basicHelper.commaSeperatedStrToArray(params.kind);
  }
  oThis.currencies = basicHelper.commaSeperatedStrToArray((params.currency || ''));
  oThis.arbitrary_amount = basicHelper.commaSeperatedStrToArray((params.arbitrary_amount || ''));
  oThis.arbitrary_commission = basicHelper.commaSeperatedStrToArray((params.arbitrary_commission || ''));

  oThis.transactionTypes = [];

  oThis.allPromises = [];

};

List.prototype = {

  /**
   * perform
   *
   * @returns {Promise}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error({
            internal_error_identifier: 's_tk_l_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * asyncPerform
   *
   * @returns {Promise}
   */
  asyncPerform: async function() {

    const oThis = this;

    await oThis.validateAssignParams();

    oThis.allPromises.push(oThis.getTransactionKinds());

    oThis.allPromises.push(oThis.getExtraData());

    return oThis.prepareApiResponse();

  },

  /**
   * validateAssignParams - Validate and assign params for use
   *
   */
  validateAssignParams: function() {

    var oThis = this;

    if( oThis.page_no < 1 ){
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_1',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if ( oThis.order_by != 'created' && oThis.order_by != 'name' ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if ( !commonValidator.isValidOrderingString(oThis.order) ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_7',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if ( oThis.limit < 1 || oThis.limit > 100 ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(oThis.kind) {
      let kinds = basicHelper.commaSeperatedStrToArray(oThis.kind);
      kinds = kinds.map(function(kind){
        let val = new ClientTransactionTypeModel().invertedKinds[kind];
        return Number(val);
      });
      oThis.where.kind = kinds;
    }

    if(oThis.currencies.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_currency_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(oThis.currencies[0] != '') oThis.where.currency_type = new ClientTransactionTypeModel().invertedCurrencyTypes[oThis.currencies[0]];

    if(oThis.arbitrary_amount.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_amount_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(oThis.arbitrary_amount[0] != '') oThis.arbitrary_amount = oThis.arbitrary_amount[0];

    if(oThis.arbitrary_commission.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_commission_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if (oThis.arbitrary_commission[0] != '') oThis.arbitrary_commission = oThis.arbitrary_commission[0];

    return Promise.resolve({});

  },

  /**
   * getTransactionKinds - Query and get list of transaction kinds
   *
   * @returns {Promise}
   */
  getTransactionKinds: function () {

    var oThis = this;

    return new Promise(async function (onResolve, onReject) {

      const result = await oThis.getAllFilteredActions().catch(function(err){
        onReject(err);
      });

      oThis.total_no = result.length;

      let amount = null;
      let arbitrary_amount = null;
      let arbitrary_commission = null;
      let actionEntityFormatter = null;
      let actionEntityFormatterRsp = null;
      let commission_percent = null;
      let uts = Date.now();

      for (var i = 0; i < result.length; i++) {
        var res = result[i];
        if(res.currency_type == clientTxTypesConst.btCurrencyType){
          amount = basicHelper.formatWeiToString(basicHelper.convertToNormal(res.value_in_bt_wei));
        }else{
          amount = res.value_in_usd;
        }

        arbitrary_amount = amount ? false : true;
        arbitrary_commission = res.commission_percent ? false : true;
        commission_percent = res.commission_percent ? res.commission_percent.toString(10) : null;

        actionEntityFormatter = new ActionEntityFormatterKlass({
          id: res.id,
          client_id: oThis.clientId,
          name: res.name,
          kind: res.kind,
          currency: res.currency_type,
          arbitrary_amount: arbitrary_amount,
          amount: amount,
          arbitrary_commission: arbitrary_commission,
          commission_percent: commission_percent,
          uts: uts
        });

        actionEntityFormatterRsp = await actionEntityFormatter.perform();

        oThis.transactionTypes.push(actionEntityFormatterRsp.data);
      }
      onResolve();

    });

  },

  getAllFilteredActions: async function() {

    const oThis = this
      , return_result = []
    ;

    var whereClause = {
      client_id: oThis.clientId
    };

    Object.assign(whereClause, oThis.where);

    let query = new ClientTransactionTypeModel().select('*').where(whereClause);

    if( commonValidator.isVarTrue(oThis.arbitrary_amount) ) {
      query.where('value_in_usd is null and value_in_bt_wei is null');
    } else if( commonValidator.isVarFalse(oThis.arbitrary_amount) ) {
      query.where('value_in_usd > 0 or value_in_bt_wei > 0');
    } else {

    }

    if( commonValidator.isVarTrue(oThis.arbitrary_commission) ) {
      query.where('commission_percent is null');
    } else if( commonValidator.isVarFalse(oThis.arbitrary_commission) ){
      query.where('commission_percent > 0');
    } else {

    }

    if(oThis.limit) query.limit(oThis.limit);
    if(oThis.offset) query.offset(oThis.offset);

    if(oThis.order_by) {
      let order_by = (oThis.order_by == 'name' ? 'name' : 'id');
      query.order_by(`${order_by} ${oThis.order}`);
    }

    const results = await query.fire();

    oThis.next_page_present = results.length > oThis.limit - 1 ? true : false;

    let result_count = results.length;
    if (oThis.next_page_present) result_count--;

    for (var i = 0; i < result_count; i++) {
      return_result.push(query.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);

  },

  /**
   * getExtraData - Get client token data
   *
   * @returns {Promise}
   */
  getExtraData: function(){

    const oThis = this;

    return new Promise(async function (onResolve, onReject) {

      if (oThis.extra_entities.includes('client_tokens')) {

        const clientBrandedTokenCacheObj = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId});

        const clientBrandedTokenCacheResp = await clientBrandedTokenCacheObj.fetch();

        oThis.clientTokens = clientBrandedTokenCacheResp.data;
      }

      if (oThis.extra_entities.includes('price_points')) {
        oThis.ostPrices = await new ostPriceCacheKlass().fetch();
      }

      onResolve();

    });

  },

  /**
   * prepareApiResponse - Prepare final response
   *
   * @returns {Promise}
   */
  prepareApiResponse: async function () {

    const oThis = this;

    await Promise.all(oThis.allPromises);

    let arbitrary_amount;

    if( oThis.arbitrary_amount instanceof Array || oThis.arbitrary_amount == '') {
      delete oThis.arbitrary_amount;
    }

    if( oThis.arbitrary_commission instanceof Array || oThis.arbitrary_commission == '') {
      delete oThis.arbitrary_commission;
    }

    let meta_data = {
      next_page_payload: {
        id: oThis.id,
        name: oThis.name,
        kind: oThis.kind,
        currency: oThis.currencies[0] != '' ? oThis.currencies[0] : undefined,
        arbitrary_amount: oThis.arbitrary_amount,
        arbitrary_commission: oThis.arbitrary_commission,
        order_by: oThis.order_by,
        offset: oThis.offset + oThis.limit - 1,
        limit: oThis.limit - 1
      },
      total_actions: oThis.total_no
    };

    if (oThis.next_page_present) {
      delete meta_data.next_page_payload;

      meta_data.next_page_payload.order_by = oThis.order_by;
      meta_data.next_page_payload.offset = oThis.offset + oThis.limit - 1;
      meta_data.next_page_payload.limit = oThis.limit - 1;
    }

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: 'actions',
        actions: oThis.transactionTypes,
        meta: meta_data,
        client_tokens: oThis.clientTokens,
        price_points: oThis.ostPrices
      }
    ));
  }
};

module.exports = List;
