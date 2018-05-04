"use strict";

/**
 * Call approve method of BT contract.<br><br>
 *
 * @module lib/transactions/approve_contract
 *
 */

const openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = "../.."
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

/**
 * Constructor
 *
 * @constructor
 *
 * @param {string} params.approverUuid - approver UUID
 * @param {string} params.token_erc20_address - token ERC20 address
 * @param {string} params.approvee_address - Approvee address
 * @param {string} params.return_type - Return type
 *
 */
const ApproveContractKlass = function (params) {
  const oThis = this;

  oThis.approveAmount = basicHelper.convertToWei('10000000000000').toString(10);
  oThis.approverUuid = params.approverUuid;
  oThis.brandedTokenContractAddress = params.token_erc20_address;
  oThis.contractToApprove = params.approvee_address;
  oThis.returnType = (params.return_type || 'txReceipt');

  oThis.approveBTInput = null;
  oThis.approveTransactionHash = null;
};

ApproveContractKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error({
            internal_error_identifier: 'l_t_ac_1',
            api_error_identifier: 'unhandled_catch_response',
            error_config: errorConfig
          });
        }
      });
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    oThis._setCommonInputParams();

    await oThis._fetchUserAddress();

    await oThis._approve();

    oThis._markBtContractApprovedProperty();

    return Promise.resolve(responseHelper.successWithData({
      input_params: oThis.approveBTInput,
      transaction_hash: oThis.approveTransactionHash
    }));
  },

  /**
   * Set common input params
   */
  _setCommonInputParams: function() {
    const oThis = this
    ;

    oThis.approveBTInput = {
      erc20_address: oThis.brandedTokenContractAddress,
      approverUuid: oThis.approverUuid,
      approvee_address: oThis.contractToApprove,
      to_approve_amount: oThis.approveAmount,
      options: {returnType: oThis.returnType}
    };
  },

  /**
   * Fetch user address
   *
   * @return {promise<result>}
   */
  _fetchUserAddress: async function() {
    const oThis = this
    ;

    const managedAddressCacheFetchResponse = await new ManagedAddressCacheKlass({'uuids': [oThis.approverUuid]}).fetch();

    if (managedAddressCacheFetchResponse.isFailure()) {
      logger.error(managedAddressCacheFetchResponse.err);
      managedAddressCacheFetchResponse.data = Object.assign({
        input_params: oThis.approveBTInput, error: "Failed while approving contract. " +
        JSON.stringify(managedAddressCacheFetchResponse.err || {})
      });
      return Promise.reject(managedAddressCacheFetchResponse);
    }

    const userAddress = managedAddressCacheFetchResponse.data[oThis.approverUuid];
    Object.assign(oThis.approveBTInput, {
      approver_address: userAddress.ethereum_address,
      approver_passphrase: userAddress.passphrase_d
    });

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Approve
   *
   * @return {promise<result>}
   */
  _approve: async function() {
    const oThis = this
    ;

    logger.debug('approve info:', 'platform service params:', oThis.approveBTInput);

    const approveResponse = await new openStPlatform.services.approve.brandedToken(oThis.approveBTInput).perform();

    if (approveResponse.isFailure()) {
      approveResponse.data = Object.assign({
        input_params: oThis.approveBTInput,
        error: "Failed while approving contract. " + JSON.stringify(approveResponse.err)
      });

      logger.debug('approve info:', 'failed approve response:', approveResponse);

      return Promise.reject(approveResponse);
    }

    logger.debug('approve info:', 'approve tx hash:', approveResponse.data.rawTransactionReceipt.transactionHash,
      'from addr:', approveResponse.data.rawTransactionReceipt.from,
      'status:', approveResponse.data.rawTransactionReceipt.status);

    oThis.approveTransactionHash = approveResponse.data.rawTransactionReceipt.transactionHash;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Mark BT Contract Approved Property
   *
   * @return {promise<result>}
   */
  _markBtContractApprovedProperty: function() {
    const oThis = this
    ;

    // Mark user as approved in database for future transactions.
    const bTContractApprovedIntProp = new ManagedAddressModel()
      .invertedProperties[managedAddressesConst.bTContractApproved];

    new ManagedAddressModel().update(['properties = properties | ?', bTContractApprovedIntProp])
      .where({uuid: oThis.approverUuid})
      .fire();

    new ManagedAddressCacheKlass({'uuids': [oThis.approverUuid]}).clear();
  }
};

module.exports = ApproveContractKlass;