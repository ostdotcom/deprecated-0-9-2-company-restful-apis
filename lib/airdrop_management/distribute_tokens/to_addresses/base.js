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
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
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

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(async function(error) {
        logger.error("lib/airdrop_management/distribute_tokens/to_addresses/base.js::perform::catch");
        logger.error(error);

        if (responseHelper.isCustomResult(error)){
          return Promise.resolve(error);
        } else {
          return Promise.resolve(responseHelper.error({
            internal_error_identifier: 'am_dt_ta_b_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: {error: error},
            error_config: errorConfig
          }));
        }
      });
  },

  /**
   * Start the airdrop
   *
   * @returns {Promise<result>}
   */
  asyncPerform: async function () {

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
    ;

    // get branded token details
    const brandedTokenQueryResponse = await new ClientBrandedTokenModel().getById(oThis.clientAirdropObj.client_branded_token_id);
    oThis.clientBrandedTokenObj = brandedTokenQueryResponse[0];

    // get reserved address details
    const managedAddressQueryResponse = await new ManagedAddressModel().getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id]);
    const managedAddressObj = managedAddressQueryResponse[0];

    const fetchBalanceObj = new openStPlatform.services.balance.brandedToken(
      {address: managedAddressObj.ethereum_address, erc20_address: oThis.clientBrandedTokenObj.token_erc20_address}
    );

    const balanceResponse = await fetchBalanceObj.perform();

    if (balanceResponse.isFailure()) {
      logger.notify(
          'am_dt_ta_b_crab_1',
          "Error in fetching balance of Reserved Address for Airdrop ID - " + oThis.clientAirdropObj.id,
          balanceResponse,
          {clientId: oThis.client_id}
      );
      return Promise.reject(balanceResponse);
    }

    // Get total users for airdrop based on filter
    const results = await new ManagedAddressModel().getFilteredActiveUsersCount({
        client_id: oThis.client_id,
        property_unset_bit_value: oThis.propertyUnsetBitValue,
        property_set_bit_value: oThis.propertySetBitValue,
        uuids: oThis.uuids
      })
      , totalCount = results[0].total_count
      , airdropAmountInWei = oThis.clientAirdropObj.common_airdrop_amount_in_wei
      , totalBalanceInWei = balanceResponse.data.balance
    ;

    if (parseInt(totalCount) === 0){
      logger.error('am_dt_ta_b_crab_2', "No users found for airdrop list for airdropID - ", oThis.clientAirdropObj.id);
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'am_dt_ta_b_crab_2',
        api_error_identifier: 'no_users_found_for_airdrop_list',
        error_config: errorConfig
      }));
    }

    const totalBalanceInWeiBignNumber = basicHelper.convertToBigNumber(totalBalanceInWei)
      , totalCountBignNumber = basicHelper.convertToBigNumber(totalCount)
      , airdropAmountInWeiBignNumber = basicHelper.convertToBigNumber(airdropAmountInWei);

    if (totalBalanceInWeiBignNumber.lessThan(airdropAmountInWeiBignNumber.times(totalCountBignNumber))) {
      logger.error('am_dt_ta_b_crab_3', "Insufficient Balance of Reserved Address for airdropID - ", oThis.clientAirdropObj.id);
      return Promise.reject(responseHelper.error({
          internal_error_identifier: 'am_dt_ta_b_crab_3',
          api_error_identifier: 'insufficient_funds',
          error_config: errorConfig
        }));
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
    ;

    logger.info("Creating Airdrop Details for airdropID ", oThis.clientAirdropObj.id);

    const limitSize = 2000
      , queryParams = {
        client_id: oThis.client_id,
        limit: limitSize,
        offset: 0,
        property_unset_bit_value: oThis.propertyUnsetBitValue,
        property_set_bit_value: oThis.propertySetBitValue,
        uuids: oThis.uuids
      }
    ;

    // Create airdrop details in loop with limitSize
    while (true) {
      // fetch users for the run
      const managedAddressInsertData = []
        , results = await new ManagedAddressModel().getFilteredActiveUsersByLimitAndOffset(queryParams)
        , totalCount = results.length;

      if (totalCount === 0) break;

      // create insert rows
      for (var i = 0; i < totalCount; i++) {
        const sql_rows = [oThis.client_id, oThis.clientAirdropObj.id, results[i].id
          , oThis.clientAirdropObj.common_airdrop_amount_in_wei, oThis.clientAirdropObj.common_expiry_timestamp
          , new ClientAirdropDetailModel().invertedStatuses[clientAirdropDetailsConst.incompleteStatus]];

        managedAddressInsertData.push(sql_rows);
      }

      // bulk insert rows
      const queryResponse = await oThis._bulkInsertClientAirdropDetails(managedAddressInsertData);
      if (queryResponse.isFailure()) {
        logger.notify(
            'am_dt_ta_b_cad_1',
            "Error in bulkInsertClientAirdropDetails for Airdrop ID - " + oThis.clientAirdropObj.id,
            queryResponse.toHash(),
            queryParams
        );
        return Promise.reject(queryResponse);
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
      , fields = ['client_id', 'client_airdrop_id', 'managed_address_id', 'airdrop_amount_in_wei', 'expiry_timestamp', 'status']
    ;

    await new ClientAirdropDetailModel().insertMultiple(fields, sql_rows_array).fire();
    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = baseKlass;