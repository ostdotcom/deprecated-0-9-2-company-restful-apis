"use strict";

const rootPrefix = "../.."
  , openStPlatform = require('@openstfoundation/openst-platform')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , managedAddressesKlass = require(rootPrefix + '/app/models/managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  ;

const ApproveContractKlass = function(params){
  const oThis = this;

  oThis.approveAmount = basicHelper.convertToWei('10000000000000');

  oThis.approverUuid = params.approverUuid;
  oThis.brandedTokenContractAddress = params.token_erc20_address;
  oThis.contractToApprove = params.approvee_address;
  oThis.returnType = (params.return_type || 'txReceipt');

};

ApproveContractKlass.prototype = {

  perform: async function(){
    const oThis = this;

    var approveBTInput = {
      erc20_address: oThis.brandedTokenContractAddress,
      approverUuid: oThis.approverUuid,
      approvee_address: oThis.contractToApprove,
      to_approve_amount: oThis.approveAmount,
      options: {returnType: oThis.returnType}
    };

    var addressCachedObj = new ManagedAddressCacheKlass({'uuids': [oThis.approverUuid]})
      , approverAddressResp = await addressCachedObj.fetch();

    if(approverAddressResp.isFailure()) {
      logger.error(approverAddressResp.err);
      approverAddressResp['data'] = Object.assign({input_params: approveBTInput, error: "Failed while approving contract. " +
                                            JSON.stringify(approverAddressResp.err || {})});
      return Promise.resolve(approverAddressResp);
    }

    var userAddress = approverAddressResp.data[oThis.approverUuid];
    Object.assign(approveBTInput, {
      approver_address: userAddress.ethereum_address,
      approver_passphrase: userAddress.passphrase_d
    });

    const approveForBrandedToken = new openStPlatform.services.approve.brandedToken(approveBTInput);

    var approveTransactionHash = null,
      approveResponse = null;
    delete approveBTInput.approver_passphrase;
    try {
      approveResponse = await approveForBrandedToken.perform();
      approveTransactionHash = approveResponse.data.transactionReceipt.data.rawTransactionReceipt.transactionHash;
    } catch(err) {
      approveResponse = responseHelper.error("l_t_ac_2", err);
    }

    if (approveResponse.isFailure()) {
      approveResponse['data'] = Object.assign({input_params: approveBTInput, error: "Failed while approving contract. " + approveResponse.err});
      return Promise.resolve(approveResponse);
    }

    // Mark user as approved in database for future transactions.
    var managedAddress = new managedAddressesKlass();
    managedAddress.update(['properties = properties | ?',
      managedAddress.invertedProperties[managedAddressesConst.bTContractApproved]]).where({uuid: oThis.approverUuid}).fire();
    new ManagedAddressCacheKlass({'uuids': [oThis.approverUuid]}).clear();

    return Promise.resolve(responseHelper.successWithData({input_params: approveBTInput, transaction_hash: approveTransactionHash}));
  }

};

module.exports = ApproveContractKlass;