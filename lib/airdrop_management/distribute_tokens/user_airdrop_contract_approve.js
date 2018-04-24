"use strict";

/**
 * To speed up the execute transactions, pre-approval of the airdrop contract address by users to
 * spend their BTs is needed. This class handles this.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/user_airdrop_contract_approve
 *
 */

const rootPrefix = '../../..'
;

require(rootPrefix + '/module_overrides/index');

const uuid = require("uuid")
;

const responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , TransferStPrimeKlass = require(rootPrefix + '/lib/transactions/stPrime_transfer')
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
;

const approveAmount = basicHelper.convertToWei('1000000000000000')
;

/**
 * Constructor of user airdrop contract approve class. This class has the performer for pre-approve functionality.
 * Users need to approve airdrop contract address for spending their BTs. For this first necessary gas is given and
 * then afterwards the approve method of the branded token contract is called. These 2 steps need to be performed
 * once in the lifetime of the user.
 *
 * @constructor
 *
 * @param {number} params.client_branded_token_id - client branded token id
 * @param {number} params.airdrop_id - id of record in client_airdrops table
 *
 */
const UserAirdropContractApproveKlass = function (params) {
  const oThis = this
  ;

  oThis.airdropId = params.airdrop_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;

  oThis.clientAirdrop = null;
  oThis.clientBrandedToken = null;
  oThis.reserveAddressUuid = null;
};

UserAirdropContractApproveKlass.prototype = {

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

          return responseHelper.error("l_am_dt_uaca_1", "Unhandled result", {}, {sendErrorEmail: false});
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

    await oThis._fetchClientAirdropRecord();

    await oThis._fetchClientBrandedTokenRecord();

    await oThis._fetchReserveAddressUuid();

    await oThis._approve();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Fetch client airdrop record
   *
   * @return {promise<result>}
   */
  _fetchClientAirdropRecord: async function () {
    const oThis = this
    ;

    const clientAirdropRecords = await new ClientAirdropModel().select('*').where(['id=?', oThis.airdropId]).fire();
    oThis.clientAirdrop = clientAirdropRecords[0];

    if (!oThis.clientAirdrop) {
      return Promise.reject(responseHelper.error('l_am_dt_uaca_2', 'client airdrop not found.', {}, {sendErrorEmail: false}));
    }

    if (oThis.clientAirdrop.client_branded_token_id != oThis.clientBrandedTokenId) {
      return Promise.reject(responseHelper.error('l_am_dt_uaca_3', 'invalid task params', {}, {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Fetch client branded token record
   *
   * @return {promise<result>}
   */
  _fetchClientBrandedTokenRecord: async function () {
    const oThis = this
    ;

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.clientBrandedTokenId]).fire();
    oThis.clientBrandedToken = clientBrandedTokenRecords[0];

    if (!oThis.clientBrandedToken) {
      return Promise.reject(responseHelper.error('l_am_dt_uaca_4', 'client branded token not found.', {}, {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Fetch reserve address uuid
   *
   * @return {promise<result>}
   */
  _fetchReserveAddressUuid: async function () {
    const oThis = this
    ;

    const manageAddressRecords = await new ManagedAddressModel().select('*')
      .where(['id=?', oThis.clientBrandedToken.reserve_managed_address_id]).fire();
    oThis.reserveAddressUuid = manageAddressRecords[0].uuid;

    if (!oThis.reserveAddressUuid) {
      return Promise.reject(responseHelper.error('l_am_dt_uaca_5', 'reserveAddressUuid not found.', {}, {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Approve
   *
   * @return {promise<result>}
   */
  _approve: async function () {
    const oThis = this
      , batchSize = 20
    ;

    var batchNo = 1;

    while (true) {

      const userManageAddressIds = []
        , shortlistedUuidsForApproval = []
        , offset = (batchNo - 1) * batchSize
      ;

      batchNo = batchNo + 1;

      const clientAirdropDetailRecords = await new ClientAirdropDetailModel()
        .select('*').where(['client_airdrop_id=?', oThis.airdropId])
        .offset(offset).limit(batchSize).fire();

      // end of batching
      if (clientAirdropDetailRecords.length <= 0) break;

      for (var i = 0; i < clientAirdropDetailRecords.length; i++) {
        const clientAirdropDetail = clientAirdropDetailRecords[i];

        //Process only users for whom airdrop is successfully completed.
        if ((new ClientAirdropDetailModel().statuses[clientAirdropDetail.status]) !==
          clientAirdropDetailsConst.completeStatus) continue;

        userManageAddressIds.push(clientAirdropDetail.managed_address_id);
      }

      if (userManageAddressIds.length <= 0) continue;

      const userRecords = await new ManagedAddressModel().select('*').where(['id in (?)', userManageAddressIds]).fire();
      if (userRecords.length <= 0) continue;

      for (var i = 0; i < userRecords.length; i++) {
        const userRecord = userRecords[i];

        //check if already approved - bitwise AND
        if ((userRecord.properties &
            (new ManagedAddressModel().invertedProperties[managedAddressesConst.bTContractApproved])) > 0) continue;

        shortlistedUuidsForApproval.push(userRecord.uuid);
      }

      // proceed to next batch if no one to approve
      if (shortlistedUuidsForApproval.length == 0) continue;

      // refill gas
      const fromUuidsForApproval = await oThis._refillGasForBatch(shortlistedUuidsForApproval);

      await oThis._approveForBatch(fromUuidsForApproval);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Refill for batch
   *
   * @return {promise<result>}
   */
  _refillGasForBatch: async function (fromUuids) {
    const oThis = this
      , promiseArray = []
      , fromUuidsForApproval = []
    ;

    for (var i = 0; i < fromUuids.length; i++) {
      const fromUuid = fromUuids[i];

      promiseArray.push(
        new Promise(async function (onResolve, onReject) {
          const transferSTPrimeParams = {
            sender_uuid: oThis.reserveAddressUuid,
            token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
            receiver_uuid: fromUuid,
            method_args: {name: 'approve', amount: approveAmount}
          };

          const refillGasResponse = await new TransferStPrimeKlass(transferSTPrimeParams).perform();
          if (!refillGasResponse || refillGasResponse.isFailure()) return onResolve();

          fromUuidsForApproval.push(fromUuid);

          const error = refillGasResponse.data['error']
            , transactionHash = refillGasResponse.data['transaction_hash']
            , refillStatus = (refillGasResponse.isFailure() ? transactionLogConst.failedStatus :
            transactionLogConst.completeStatus)
          ;

          return onResolve();
        })
      )
    }

    // wait for all gas refills to resolve
    await Promise.all(promiseArray);

    return Promise.resolve(fromUuidsForApproval);
  },

  /**
   * Approve for batch
   *
   * @return {promise<result>}
   */
  _approveForBatch: async function (fromUuids) {
    const oThis = this
      , promiseArray = []
    ;

    for (var i = 0; i < fromUuids.length; i++) {
      const fromUuid = fromUuids[i];
      promiseArray.push(
        new Promise(async function (onResolve, onReject) {
          const approveContractParams = {
            approverUuid: fromUuid,
            token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
            approvee_address: oThis.clientBrandedToken.airdrop_contract_addr,
            return_type: 'txReceipt'
          };

          logger.debug('approve info:', oThis.clientBrandedToken.airdrop_contract_addr);

          const approveResponse = await new ApproveContractKlass(approveContractParams).perform();
          if (!approveResponse || approveResponse.isFailure()) return onResolve();

          const error = approveResponse.data['error']
            , approveTransactionHash = approveResponse.data['transaction_hash']
            , approveStatus = (approveResponse.isFailure() ? transactionLogConst.failedStatus :
            transactionLogConst.completeStatus)
          ;

          onResolve();
        })
      )
    }

    await Promise.all(promiseArray);
    return Promise.resolve();
  }

};

module.exports = UserAirdropContractApproveKlass;
