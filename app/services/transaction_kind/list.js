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
const List = function(params){

  const oThis = this;

  oThis.params = params;
  oThis.transactionTypes = [];
  oThis.clientTokens = [];

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
      })
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

    oThis.allPromises.push(oThis.getClientTokens());

    return oThis.prepareApiResponse();

  },

  /**
   * validateAssignParams - Validate and assign params for use
   *
   */
  validateAssignParams: function() {

    var oThis = this;

    oThis.clientId = oThis.params.client_id;

    if( oThis.params.page_no && oThis.params.page_no < 1 ){
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_1',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.page_no = oThis.params.page_no || 1;

    if ( oThis.params.order_by && (oThis.params.order_by != 'created' && oThis.params.order_by != 'name') ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order_by = oThis.params.order_by || 'created';

    if (oThis.params.order && !commonValidator.isValidOrderingString(oThis.params.order)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_7',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order = oThis.params.order || 'desc';

    if ( oThis.params.limit && (oThis.params.limit < 1 || oThis.params.limit > 100) ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.limit = oThis.params.limit || 10;

    oThis.offset = (oThis.page_no - 1) * oThis.limit;

    oThis.where = {};

    if(oThis.params.id) oThis.where.id = basicHelper.commaSeperatedStrToArray(oThis.params.id);
    if(oThis.params.name) oThis.where.name = basicHelper.commaSeperatedStrToArray(oThis.params.name);
    if(oThis.params.kind) {
      let kinds = basicHelper.commaSeperatedStrToArray(oThis.params.kind);
      kinds = kinds.map(function(kind){
        let val = new ClientTransactionTypeModel().invertedKinds[kind];
        return Number(val);
      });
      oThis.where.kind = kinds;
    }

    let currencies = basicHelper.commaSeperatedStrToArray((oThis.params.currency || ''));

    if(currencies.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_currency_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(currencies[0] != '') oThis.where.currency_type = new ClientTransactionTypeModel().invertedCurrencyTypes[currencies[0]];

    let arbitrary_amount = basicHelper.commaSeperatedStrToArray((oThis.params.arbitrary_amount || ''));

    if(arbitrary_amount.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_amount_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(oThis.arbitrary_amount != '') oThis.arbitrary_amount = arbitrary_amount[0];

    let arbitrary_commission = basicHelper.commaSeperatedStrToArray((oThis.params.arbitrary_commission || ''));

    if(arbitrary_commission.length > 1) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_l_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_arbitrary_commission_filter'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if (oThis.arbitrary_commission != '') oThis.arbitrary_commission = arbitrary_commission[0];

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

      let amount = null;
      let arbitrary_amount = null;
      let arbitrary_commission = null;
      let actionEntityFormatter = null;
      let actionEntityFormatterRsp = null;
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

        actionEntityFormatter = new ActionEntityFormatterKlass({
          id: res.id,
          client_id: oThis.clientId,
          name: res.name,
          kind: res.kind,
          currency: res.currency_type,
          arbitrary_amount: arbitrary_amount,
          amount: amount,
          arbitrary_commission: arbitrary_commission,
          commission_percent: res.commission_percent.toString(10),
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
      let order_by = (oThis.order_by == 'name' ? 'name' : 'id')
      query.order_by(`${order_by} ${oThis.order}`);
    }

    const results = await query.fire();


    for (var i = 0; i < results.length; i++) {
      return_result.push(query.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);

  },

  /**
   * getClientTokens - Get client token data
   *
   * @returns {Promise}
   */
  getClientTokens: function(){

    const oThis = this;

    return new Promise(async function (onResolve, onReject) {

      const clientBrandedTokenCacheObj = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId});

      const clientBrandedTokenCacheResp = await clientBrandedTokenCacheObj.fetch();

      oThis.clientTokens = clientBrandedTokenCacheResp.data;

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

    const ostPrices = await new ostPriceCacheKlass().fetch();

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: 'actions',
        actions: oThis.transactionTypes,
        meta: {next_page_payload: {}},
        extra_entities: {
          client_tokens: oThis.clientTokens,
          price_points: ostPrices
        }
      }
    ));
  }
};

module.exports = List;
