"use strict";

/**
 *
 * Start adding airdrop details base class <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/base
 *
 */

// Load External Packages
const openStPlatform = require('@openstfoundation/openst-platform');

// Load Packages
const rootPrefix = '../../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , FetchBalancesKlass = require(rootPrefix + '/app/services/on_boarding/fetch_balances')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , ClientAirdropDetailKlass = require(rootPrefix + '/app/models/client_airdrop_details')
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
const baseKlass = function () {
};

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

    // get branded token details
    const brandedTokenQueryResponse = await clientBrandedToken.getById(oThis.clientAirdropObj.client_branded_token_id);
    oThis.clientBrandedTokenObj = brandedTokenQueryResponse[0];

    // get reserved address details
    const managedAddressQueryResponse = await managedAddress.getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id]);
    const managedAddressObj = managedAddressQueryResponse[0];

    const fetchBalanceObj = new openStPlatform.services.balance.brandedToken(
      {address: managedAddressObj.ethereum_address, erc20_address: oThis.clientBrandedTokenObj.token_erc20_address}
    );

    const balanceResponse = await fetchBalanceObj.perform();

    if (balanceResponse.isFailure()) {
      logger.notify('am_dt_ta_b_crab_1', "Error in fetching balance of Reserved Address for Airdrop ID - " + oThis.clientAirdropObj.id, balanceResponse);
      return Promise.resolve(balanceResponse);
    }

    // Get total users for airdrop based on filter
    const results = await managedAddress.getFilteredActiveUsersCount({
        client_id: oThis.client_id,
        property_unset_bit_value: oThis.propertyUnsetBitValue
      })
      , totalCount = results[0].total_count
      , airdropAmountInWei = oThis.clientAirdropObj.common_airdrop_amount_in_wei
      , totalBalanceInWei = balanceResponse.data.balance
    ;

    if (parseInt(totalCount) === 0){
      logger.error('am_dt_ta_b_crab_2', "No users found for airdrop list for airdropID - ", oThis.clientAirdropObj.id);
      return Promise.resolve(responseHelper.error("am_dt_ta_b_crab_2", "No users found for airdrop list"));
    }

    const totalBalanceInWeiBignNumber = basicHelper.convertToBigNumber(totalBalanceInWei)
      , totalCountBignNumber = basicHelper.convertToBigNumber(totalCount)
      , airdropAmountInWeiBignNumber = basicHelper.convertToBigNumber(airdropAmountInWei);

    if (totalBalanceInWeiBignNumber.lessThan(airdropAmountInWeiBignNumber.times(totalCountBignNumber))) {
      logger.error('am_dt_ta_b_crab_3', "Insufficient Balance of Reserved Address for airdropID - ", oThis.clientAirdropObj.id);
      return Promise.resolve(responseHelper.error('am_dt_ta_b_3', 'Insufficient Balance for airdrop'));
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

    const oThis = this
      , managedAddress = new ManagedAddressKlass()
      , clientAirdropDetail = new ClientAirdropDetailKlass()
    ;

    logger.info("Creating Airdrop Details for airdropID ", oThis.clientAirdropObj.id);

    const limitSize = 2000
      , queryParams = {
        client_id: oThis.client_id,
        limit: limitSize,
        offset: 0,
        property_unset_bit_value: oThis.propertyUnsetBitValue
      }
    ;

    // Create airdrop details in loop with limitSize
    while (true) {
      // fetch users for the run
      const managedAddressInsertData = []
        , results = await managedAddress.getFilteredActiveUsersByLimitAndOffset(queryParams)
        , totalCount = results.length;

      if (totalCount === 0) break;

      // create insert rows
      for (var i = 0; i < totalCount; i++) {
        const sql_rows = [oThis.client_id, oThis.clientAirdropObj.id, results[i].id,
          oThis.clientAirdropObj.common_airdrop_amount_in_wei, oThis.clientAirdropObj.common_expiry_timestamp,
          clientAirdropDetail.invertedStatuses[clientAirdropDetailsConst.incompleteStatus]];
        managedAddressInsertData.push(sql_rows);
      }

      // bulk insert rows
      const queryResponse = await oThis._bulkInsertClientAirdropDetails(managedAddressInsertData);
      if (queryResponse.isFailure()) {
        logger.notify('am_dt_ta_b_cad_1', "Error in bulkInsertClientAirdropDetails for Airdrop ID - " + oThis.clientAirdropObj.id, queryParams);
        return Promise.resolve(queryResponse);
      }

      if (totalCount < limitSize) break;

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
      , clientAirdropDetail = new ClientAirdropDetailKlass()
      ,
      fields = ['client_id', 'client_airdrop_id', 'managed_address_id', 'airdrop_amount_in_wei', 'expiry_timestamp', 'status']
    ;

    const queryResponse = await clientAirdropDetail.bulkInsert(fields, sql_rows_array);
    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = baseKlass;