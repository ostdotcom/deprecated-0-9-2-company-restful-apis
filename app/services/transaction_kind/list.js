"use strict";

/**
 *
 * Return action list.
 *
 * @module app/services/transaction_kind/list
 */


const rootPrefix = '../../..'
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
 * List - Service for getting the list of actions
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id (mandatory)- client id for whom setup is to be made.
 * @param {string} params.page_no (optional)- Page for which results have to be fetched
 * @param {string} params.order_by - (optional) Order results, by created/name
 * @param {string} params.order - (optional) Order results, in desc/asc
 * @param {number} params.limit - (optional) results in page, can be 0 to 100
 *
 * @param {string} params.id - (optional filter) - Comma separated list of ids to get in result
 * @param {string} params.name - (optional filter) - Comma separated list of names to get in result
 * @param {string} params.kind - (optional filter) - Comma separated list of action kinds to get in result
 * @param {string} params.currency - (optional filter) - Currency to get in result, 'USD'/'BT'
 * @param {string} params.arbitrary_amount - (optional filter) - Results matching this flag, true/false
 * @param {string} params.arbitrary_commission - (optional filter) - Results matching this flag, true/false
 * @constructor
 */
const ListActions = function(params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.page_no = params.page_no;
  oThis.order_by = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
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
  oThis.arbitrary_amount_str = params.arbitrary_amount;
  oThis.arbitrary_commission_str = params.arbitrary_commission;

  oThis.transactionTypes = [];

  oThis.allPromises = [];

};

ListActions.prototype = {

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
            internal_error_identifier: 's_tk_l_0',
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

    const oThis = this
    ;

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

    const oThis = this
    ;

    if( Number(oThis.page_no) < 1 ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_1',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.page_no = Number(oThis.page_no || 1);

    let order_by = null;

    if (oThis.order_by) {
      order_by = oThis.order_by.toLowerCase();
    }

    if ( oThis.order_by &&  order_by != 'created' && order_by != 'name' ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order_by = order_by || 'created';

    let order = null;

    if (oThis.order) {
      order = oThis.order.toLowerCase();
    }

    if ( oThis.order && !commonValidator.isValidOrderingString(order) ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_7',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order = order || 'desc';

    if(!commonValidator.isVarNull(oThis.limit)) {
      oThis.limit = Number(oThis.limit);
    }

    if ( !commonValidator.isVarNull(oThis.limit) && (isNaN(oThis.limit) || oThis.limit < 1 || oThis.limit > 100) ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.limit = oThis.limit || 10;

    if(oThis.kind) {
      let kinds = [];
      for(var i=0; i < oThis.kind.length; i++){
        let val = new ClientTransactionTypeModel().invertedKinds[oThis.kind[i]];
        if(!isNaN(Number(val))) kinds.push(Number(val));
      }
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

    if (!commonValidator.isVarNull(oThis.arbitrary_amount_str)) {
      oThis.arbitrary_amount_arr = basicHelper.commaSeperatedStrToArray(oThis.arbitrary_amount_str);
    }

    if(!commonValidator.isVarNull(oThis.arbitrary_amount_arr) && oThis.arbitrary_amount_arr.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_amount_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(!commonValidator.isVarNull(oThis.arbitrary_amount_arr)) {
      oThis.arbitrary_amount = oThis.arbitrary_amount_arr[0];
    }


    if (!commonValidator.isVarNull(oThis.arbitrary_commission_str)) {
      oThis.arbitrary_commission_arr = basicHelper.commaSeperatedStrToArray(oThis.arbitrary_commission_str);
    }

    if(!commonValidator.isVarNull(oThis.arbitrary_commission_arr) && oThis.arbitrary_commission_arr.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_commission_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(!commonValidator.isVarNull(oThis.arbitrary_commission_arr)){
      oThis.arbitrary_commission = oThis.arbitrary_commission_arr[0];
    }

    return Promise.resolve({});

  },

  /**
   * getTransactionKinds - Query and get list of transaction kinds
   *
   * @returns {Promise}
   */
  getTransactionKinds: function () {

    const oThis = this
    ;

    return new Promise(async function (onResolve, onReject) {

      const result = await oThis.getAllFilteredActions().catch(function(err){
        onReject(err);
      });

      let actionEntityFormatter = null;
      let actionEntityFormatterRsp = null;

      for (var i = 0; i < result.length; i++) {
        var res = result[i];

        actionEntityFormatter = new ActionEntityFormatterKlass(res);

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

    if(oThis.limit) query.limit(oThis.limit + 1);
    if(oThis.offset) query.offset(oThis.offset);

    if(oThis.order_by) {
      let order_by = (oThis.order_by == 'name' ? 'name' : 'id');
      query.order_by(`${order_by} ${oThis.order}`);
    }

    const results = await query.fire();

    oThis.next_page_present = results.length > oThis.limit ? true : false;

    let result_count = results.length;
    if (oThis.next_page_present) result_count--;

    return Promise.resolve(results);

  },

  /**
   * getExtraData - Get client token data
   *
   * @returns {Promise}
   */
  getExtraData: function() {

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

    let meta_data = {
      next_page_payload: {},
    };

    if (oThis.next_page_present) {
      meta_data.next_page_payload = {
        id: oThis.id,
        name: oThis.name,
        kind: oThis.kind,
        currency: (oThis.currencies[0] != '') ? oThis.currencies[0] : undefined,
        arbitrary_amount: oThis.arbitrary_amount,
        arbitrary_commission: oThis.arbitrary_commission,
        order_by: oThis.order_by,
        limit: oThis.limit,
        page_no: oThis.page_no + 1
      }
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

module.exports = ListActions;
