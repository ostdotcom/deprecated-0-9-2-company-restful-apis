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
 * @param {number} params.page_no (optional) - page no
 * @param {number} params.order_by (optional) - order by
 * @param {number} params.order (optional) - order
 * @param {number} params.limit (optional) - limit
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
            internal_error_identifier: 's_am_l_1',
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

    let airdropsList = []
      , hasMore = false
    ;

    for (var i = 0; i < queryResponse.length; i++) {
      const record = queryResponse[i];

      if (i == oThis.limit) {
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
        page_no: oThis.pageNo + 1,
        limit: oThis.limit
      };

      if (oThis.airdropIdsString) {
        next_page_payload.id = oThis.airdropIdsString;
      }

      if (oThis.currentStatusForFiltering) {
        next_page_payload.current_status = oThis.currentStatusString;
      }

      if (!commonValidator.isVarNull(oThis.airdropped)) {
        next_page_payload.airdropped = oThis.airdropped;
      }

    }

    return Promise.resolve(responseHelper.successWithData({
      result_type: 'airdrops',
      airdrops: airdropsList,
      meta: {
        next_page_payload: next_page_payload
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

    let pageNoVas = commonValidator.validateAndSanitizePageNo(oThis.pageNo);

    if(!pageNoVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_am_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {}
      }));
    }
    oThis.pageNo = pageNoVas[1];

    let limitVas = commonValidator.validateAndSanitizeLimit(oThis.limit);

    if(!limitVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_am_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {}
      }));
    }
    oThis.limit = limitVas[1];

    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

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
        internal_error_identifier: 's_am_l_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = ListAirdropsKlass;