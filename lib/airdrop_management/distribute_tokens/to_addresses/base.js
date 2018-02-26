"use strict";

/**
 *
 * Start adding airdrop details base class <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/base
 *
 */

const rootPrefix = '../../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , fetchBalancesKlass = require(rootPrefix + '/app/services/on_boarding/fetch_balances')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropDetailKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
;

/**
 * Start adding airdrop details base class constructor
 *
 * @constructor
 *
 */
const baseKlass = function () {};

baseKlass.prototype = {

  perform: async function () {

    const oThis = this;

    var r = null;

    r = await oThis._checkReserveAddressBalance();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._createAirdropDetails();
    if (r.isFailure()) return Promise.resolve(r);

    return responseHelper.successWithData({});

  },

  /**
   * Check Balance of reserved Address before starting this step.
   *
   * @return {promise<result>}
   *
   * Sets oThis.clientBrandedTokenObj
   */
  _checkReserveAddressBalance: async function () {

    const oThis = this
      , managedAddress = new ManagedAddressKlass()
      , clientBrandedToken = new ClientBrandedTokenKlass();

    oThis.clientBrandedTokenObj = await clientBrandedToken.getById(oThis.client_branded_token_id)[0];

    const managedAddressObj = await managedAddress.getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id])[0];

    const params = {balances_to_fetch: {utility: {address_uuid: managedAddressObj.uuid,
          balance_types: [oThis.clientBrandedTokenObj.symbol]}}, client_id: oThis.clientBrandedTokenObj.client_id};

    const fetchBalances = new fetchBalancesKlass(params)
      , balanceResponse = await fetchBalances.perform()
    ;

    if (balanceResponse.isFailure()) {
      logger.notify('am_dt_ta_b_crab_1', "Error in fetching balance of Reserved Address for Airdrop ID - " + oThis.clientAirdropObj.id, params);
      return Promise.resolve(balanceResponse);
    }

    const totalBalanceInWei = balanceResponse.data.balances[oThis.clientBrandedTokenObj.symbol];

    var results = await managedAddress.getFilteredActiveUsersCount({client_id: oThis.client_id, property_unset_bit_value: oThis.propertyUnsetBitValue})[0]
      , totalCount = results.total_count
      , airdropAmountInWei = oThis.clientAirdropObj.airdrop_amount_in_wei
    ;

    const totalBalanceInWeiBignNumber = basicHelper.convertToBigNumber(totalBalanceInWei)
      , totalCountBignNumber = basicHelper.convertToBigNumber(totalCount)
      , airdropAmountInWeiBignNumber = basicHelper.convertToBigNumber(airdropAmountInWei);


    if (totalBalanceInWeiBignNumber.lessThan(airdropAmountInWeiBignNumber.times(totalCountBignNumber)))
    {
      logger.error('am_dt_ta_b_crab_2', "Insufficient Balance of Reserved Address for airdropID", oThis.clientAirdropObj.id);
      return Promise.resolve(responseHelper.error('am_dt_ta_b_2', 'Insufficient Balance for airdrop'));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Create Airdrop Details in batches.
   *
   * @return {promise<result>}
   *
   */
  _createAirdropDetails: async function () {

    logger.info("Creating Airdrop Details for airdropID ", oThis.clientAirdropObj.id);

    const oThis = this
      , managedAddress = new ManagedAddressKlass();

    var results = null
      , continueLoop = true
      , limitSize = 2000
      , queryParams = {client_id: oThis.client_id, limit: limitSize, offset: 0, property_unset_bit_value: oThis.propertyUnsetBitValue}
      , managedAddressInsertData = []
    ;

    while (continueLoop) {
      results = await managedAddress.getFilteredActiveUsersByLimitAndOffset(queryParams);
      var totalCount = results.length;

      if (totalCount === 0) break;

      var currentDateTime = util.formatDbDate(new Date());

      for (var i = 0; i < totalCount; i++) {
        var sql_rows = [oThis.client_id, oThis.clientAirdropObj.id, results[i].id, oThis.clientAirdropObj.airdrop_amount_in_wei, oThis.clientAirdropObj.expiry_timestamp, clientAirdropDetailsConst.incompleteStatus];
        managedAddressInsertData.push(sql_rows);
      }

      var queryResponse = await oThis._bulkInsertClientAirdropDetails(managedAddressInsertData);
      if (queryResponse.isFailure()) {
        logger.notify('am_dt_ta_b_cad_1', "Error in bulkInsertClientAirdropDetails for Airdrop ID - " + oThis.clientAirdropObj.id, queryParams);
        return Promise.resolve(queryResponse);
      }

      if (totalCount < limitSize) break;

      managedAddressInsertData = [];
      queryParams.offset = queryParams.offset + limitSize;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Bulk insert user addresses in client airdrop details table
   *
   * @param {array} sql_rows_array - Array of array to be inserted
   *
   * @returns {Promise<any>}
   * @private
   */
  _bulkInsertClientAirdropDetails: async function (sql_rows_array) {

    const oThis = this
      , clientAirdropDetail = new clientAirdropDetailKlass()
      , fields = ['client_id', 'client_airdrop_id', 'managed_address_id', 'airdrop_amount_in_wei', 'expiry_timesatmp', 'status']
    ;

    const queryResponse = await clientAirdropDetail.bulkInsert(fields , sql_rows_array);

    if (queryResponse.isFailure()) {
      logger.notify('am_dt_ta_b_bicad_1', 'Error in bulkInsertClientAirdropDetails for airdrop id ' + oThis.clientAirdropObj.id, {queryResponse: queryResponse, sql_rows_array: sql_rows_array});
      return Promise.resolve(queryResponse);
    }
    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = baseKlass;