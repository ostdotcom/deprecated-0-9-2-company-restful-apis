"use strict";

const rootPrefix = '../../..'
  , uuid = require("uuid")
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , clientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details')
  , managedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , clientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , TransferStPrimeKlass = require(rootPrefix + '/lib/transactions/stPrime_transfer')
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
  , approveAmount = basicHelper.convertToWei('1000000000000000')
;

const UserAirdropContractApproveKlass = function (params) {
  const oThis = this;

  oThis.airdropId = params.airdrop_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;

  oThis.clientAirdrop = null;
  oThis.clientBrandedToken = null;
};

UserAirdropContractApproveKlass.prototype = {

  perform: function () {
    const oThis = this;

    var r;

    r = oThis.validateAndSanitize();
    if(r.isFailure()) return Promise.resolve(r);

    r = oThis.startApproval();
    if(r.isFailure()) return Promise.resolve(r);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  validateAndSanitize: async function () {
    const oThis = this
      , clientAirdropObjs = new clientAirdropModel.select('*').where(['id=?',oThis.airdropId]).fire()
    ;
    oThis.clientAirdrop = clientAirdropObjs[0];

    if(oThis.clientAirdrop.client_branded_token_id != oThis.clientBrandedTokenId){
      return Promise.resolve(responseHelper.error('l_am_dt_uaca_1', 'invalid task params', null, {}, {sendErrorEmail: false}));
    }

    const clientBTs = await new clientBrandedTokenModel().select('*').where(['id=?', oThis.clientBrandedTokenId]);
    oThis.clientBrandedToken = clientBTs[0];

    return Promise.resolve(responseHelper.successWithData({}));
  },

  startApproval: async function () {
    const oThis = this
      , clientAirdropDetails = await new clientAirdropDetailModel().select('*').where(['client_airdrop_id=?', oThis.airdropId]).fire()
    ;

    for(var i=0; i<clientAirdropDetails.length; i++){

      const clientAirdropDetail = clientAirdropDetails[i];

      //Process only users for whome airdrop is successfully completed.
      if((new clientAirdropDetailModel.statuses[clientAirdropDetail.status]) !== clientAirdropDetailsConst.completeStatus) continue;

      // Check if already approved.
      const manageAddresses = await new managedAddressModel().select('*').where(['id=?', clientAirdropDetail.managed_address_id]).fire()
        , userRecord = manageAddresses[0]
      ;

      //check if already approved
      if (userRecord.properties & (new managedAddressModel().invertedProperties[managedAddressesConst.bTContractApproved]) > 0) continue;

      // Start Approve now.
      await oThis.refillGasForUser(userRecord.uuid);

      await oThis.approveForBrandedToken(userRecord.uuid)

    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Refill gas for user if required for approving airdrop contract.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  refillGasForUser: async function(fromUuid){

    const oThis = this;

    var inputParams = {sender_uuid: oThis.clientBrandedToken.reserve_address_uuid,
      token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      receiver_uuid: fromUuid, method_args: {name: 'approve', amount: approveAmount}};

    var refillGasResponse = await new TransferStPrimeKlass(inputParams).perform();

    inputParams = refillGasResponse.data['input_params'];
    var error = refillGasResponse.data['error']
      , TransactionHash = refillGasResponse.data['transaction_hash'];
    var refillStatus = (refillGasResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    await oThis.createTransactionLog(uuid.v4(), inputParams, refillStatus, error, TransactionHash);

    return Promise.resolve(refillGasResponse);
  },

  /**
   * user approving airdrop contract for the transfer of branded token to other user.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  approveForBrandedToken: async function (fromUuid) {
    const oThis = this;

    var inputParams = {approverUuid: fromUuid, token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      approvee_address: oThis.clientBrandedToken.airdrop_contract_address, return_type: 'txReceipt'};

    var approveResponse = await new ApproveContractKlass(inputParams).perform();

    inputParams = approveResponse.data['input_params'];
    var error = approveResponse.data['error']
      , approveTransactionHash = approveResponse.data['transaction_hash'];
    var approveStatus = (approveResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    await oThis.createTransactionLog(uuid.v4(), inputParams, approveStatus, error, approveTransactionHash);

    return Promise.resolve(approveResponse);
  },

  /**
   * Create Entry in transaction logs
   *
   * @param uuid
   * @param inputParams
   * @param status
   * @param responseData
   */
  createTransactionLog: function (uuid, inputParams, status, responseData, transactionHash) {
    const oThis = this;

    var ipp = JSON.stringify(inputParams)
      , fpp = JSON.stringify(responseData);
    return new transactionLogModel().create({client_id: oThis.clientAirdrop.client_id, client_token_id: oThis.clientBrandedToken.id,
      input_params: ipp, chain_type: transactionLogConst.utilityChainType, status: status,
      transaction_uuid: uuid, process_uuid: uuid, formatted_receipt: fpp, transaction_hash: transactionHash});
  }

};

module.exports = UserAirdropContractApproveKlass;
