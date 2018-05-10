"use strict";

/**
 * Schedule new airdrop task.
 *
 * @module app/services/airdrop_management/start
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , AirdropEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/airdrop')
;

/**
 * List all the airdrops
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id (Mandatory) - client id
 *
 * @module app/services/airdrop_management/list
 */
const ListAirdropsKlass = function (params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
  oThis.airdropIdsString = params.id;
  oThis.airdropIdsForFiltering = [];
  
  oThis.currentStatusString = params.current_status;
  oThis.currentStatusForFiltering = [];
};

ListAirdropsKlass.prototype = {

  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);

        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          return responseHelper.error({
            internal_error_identifier: 's_am_l_3',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   *
   * Perform
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  asyncPerform: async function(){

    const oThis = this;

    await oThis.validateAndSanitize();

    const queryResponse = await new ClientAirdropModel().getByFilterAndPaginationParams({
      client_id: oThis.clientId,
      order_by: oThis.orderBy,
      order: oThis.order,
      offset: oThis.offset,
      limit: oThis.limit + 1,
      airdrop_uuids: oThis.airdropIdsForFiltering,
      current_statuses: oThis.currentStatusForFiltering
    });

    var airdropsList = []
      , hasMore = false
    ;

    for (var i = 0; i < queryResponse.length; i++) {
      const record = queryResponse[i];

      if (i === oThis.limit) {
        // as we fetched limit + 1, ignore that extra one
        hasMore = true;
        continue
      }

      const airdropEntityData = {
        id: record.airdrop_uuid,
        current_status: new ClientAirdropModel().statuses[record.status],
        steps_complete: new ClientAirdropModel().getAllBits('steps_complete', record.steps_complete)
      };

      const airdropEntityFormatter = new AirdropEntityFormatterKlass(airdropEntityData)
        , airdropEntityFormatterRsp = await airdropEntityFormatter.perform()
      ;

      airdropsList.push(airdropEntityFormatterRsp.data);

    }

    var next_page_payload = {};

    if (hasMore) {

      next_page_payload = {
        order_by: oThis.orderBy,
        order: oThis.order,
        page_no: oThis.pageNo + 1
      };

      if (!commonValidator.isVarNull(oThis.airdropped)) {
        next_page_payload.airdropped = oThis.airdropped;
      }

    }

    return Promise.resolve(responseHelper.successWithData({
      result_type: 'airdrops',
      'airdrops': airdropsList,
      meta: {
        next_page_payload: next_page_payload,
        total_no: 0
      }
    }));

  },

  /**
   *
   * Validate & Sanitize Params
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  validateAndSanitize: async function () {

    const oThis = this
      , errors_object = [];

    if (!oThis.limit) {
      oThis.limit = 10;
    } else {
      oThis.limit = parseInt(oThis.limit);
      if (oThis.limit < 1 || oThis.limit > 100) {
        errors_object.push('invalid_pagination_limit');
        oThis.limit = 10; // adding a dummy value here so that remaining validation run as expected
      }
    }

    if (!oThis.pageNo) {
      oThis.pageNo = 1;
      oThis.offset = 0
    } else if (parseInt(oThis.pageNo) < 1) {
      errors_object.push('invalid_page_no');
    } else {
      oThis.pageNo = parseInt(oThis.pageNo);
      oThis.offset = oThis.limit * (oThis.pageNo - 1)
    }

    if (!oThis.orderBy) {
      oThis.orderBy = 'created';
    } else if (!['created'].includes(oThis.orderBy.toLowerCase())) {
      errors_object.push('invalid_order_by_airdrop_list');
    }

    if (!oThis.order) {
      oThis.order = 'desc';
    } else if (!commonValidator.isValidOrderingString(oThis.order)) {
      errors_object.push('invalid_order');
    }

    if (oThis.airdropIdsString) {
      oThis.airdropIdsForFiltering = basicHelper.commaSeperatedStrToArray(oThis.airdropIdsString);
      if (oThis.airdropIdsForFiltering.length > 100) {
        errors_object.push('invalid_id_filter');
      }
    }

    if (oThis.currentStatusString) {
      oThis.currentStatusForFiltering = basicHelper.commaSeperatedStrToArray(oThis.currentStatusString);
      for(var i=0; i < oThis.currentStatusForFiltering.length; i++){
        if (![clientAirdropConst.incompleteStatus,clientAirdropConst.processingStatus,clientAirdropConst.completeStatus,
            clientAirdropConst.failedStatus].includes(oThis.currentStatusForFiltering[i])) {
          errors_object.push('invalid_current_status_airdrop_list');
        }
      }
    }

    if (errors_object.length > 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = ListAirdropsKlass;