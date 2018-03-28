"use strict"

const rootPrefix = "../.."
  , responseHelper = require(`${rootPrefix}/lib/formatter/response`)
  , logger = require(`${rootPrefix}/lib/logger/custom_console_logger`)
  , CriticalChainInteractionLogModel = require(`${rootPrefix}/app/models/critical_chain_interaction_log.js`)
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , GetReceiptKlass = require(`${rootPrefix}/app/services/transaction/get_receipt.js`)
  , basicHelper = require(rootPrefix + '/helpers/basic')
;


const GetTransferToStakerStatusKlass = function(params){
  const oThis = this;

  oThis.critical_log_id = params.critical_log_id;
  oThis.parent_id = params.parent_id;
  oThis.critical_chain_interaction_log = null;
  oThis.transaction_hash = null;
  oThis.st_prime_to_mint = null;
};

GetTransferToStakerStatusKlass.prototype = {

  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)) {
          return error;
        }

        logger.error(`${__filename}::perform::catch`);
        logger.error(error);

        return responseHelper.error("l_sam_vts_1", "Unhandled result", null, {}, {});
      });
  },

  asyncPerform: async function() {
    const oThis = this;
    let res;

    res = await oThis.validateAndSanitize();
    if (res.isFailure()) return Promise.resolve(res);

    res = await oThis.getStakerTransferStatus();
    if (res.isFailure()) return Promise.resolve(res);

    return Promise.resolve(responseHelper.successWithData({}));
  },

  validateAndSanitize: async function() {
    const oThis = this;
    let res;
    let criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    res = criticalChainInteractionLogObj.getByIds([oThis.critical_log_id])[0];

    if (!res) {
      return Promise.resolve(responseHelper.error("l_sam_vts_2", "Critical chain interaction log id not found"));
    }

    oThis.critical_chain_interaction_log = res;
    oThis.transaction_hash = oThis.critical_chain_interaction_log.transaction_hash;
    oThis.st_prime_to_mint = oThis.critical_chain_interaction_log.request_params.st_prime_to_mint;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  getStakerTransferStatus: async function() {
    const oThis = this;
    let res;


    let params = {
      transactionHash: oThis.transaction_hash,
      chain: criticalChainInteractionLogConst.valueChainType
    };

    res = new GetReceiptKlass(params).perform();
    if (res.isFailure() || !res.data) {
      oThis.critical_chain_interaction_log.status = criticalChainInteractionLogConst.failedStatus;
      oThis.critical_chain_interaction_log.response_data = JSON.stringify(res.toHash());
      return Promise.resolve(res);
    }

    res = await oThis.validateReceipt(res.data);
    if (res.isFailure()) {
      oThis.critical_chain_interaction_log.status = criticalChainInteractionLogConst.failedStatus;
      oThis.critical_chain_interaction_log.response_data = JSON.stringify(res.toHash());
      return Promise.resolve(res);
    }

    oThis.critical_chain_interaction_log.response_data = JSON.stringify(res.toHash());
    oThis.critical_chain_interaction_log.status = criticalChainInteractionLogConst.processedStatus;

    let criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    res = await criticalChainInteractionLogObj
      .update({
        status: oThis.critical_chain_interaction_log.status,
        response_data: oThis.critical_chain_interaction_log.response_data
      })
      .where({
        id: oThis.critical_log_id
      })
      .fire();

    if (res.isFailure()) return Promise.resolve(res);

    if (oThis.critical_chain_interaction_log.status == criticalChainInteractionLogConst.failedStatus){
      return Promise.resolve(responseHelper.error("l_sam_vts_6", "Transaction receipt failed"));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  validateReceipt: async function(tx_receipt_data){
    const oThis = this;
    let rawReceipt = tx_receipt_data.rawTransactionReceipt;
    let client_eth_address = oThis.critical_chain_interaction_log.request_params.client_eth_address.toLowerCase();

    if (client_eth_address != rawReceipt.from){
      return Promise.resolve(responseHelper.error("l_sam_vts_5", "Invalid From Address"));
    }

    if (rawReceipt.to.toLowerCase() != chainInteractionConstants.SIMPLE_TOKEN_CONTRACT_ADDR.toLowerCase()){
      return Promise.resolve(responseHelper.error("l_sam_vts_3", "Invalid To Address"));
    }

    let formatted_receipt = rawReceipt.formattedTransactionReceipt;

    let buffer = formatted_receipt.eventsData[0].events.filter((event) => {
      return event.name == '_to';
    });

    if (buffer[0]['value'].toLowerCase() != chainInteractionConstants.STAKER_ADDR.toLowerCase()){
      return Promise.resolve(responseHelper.error("l_sam_vts_4", "Invalid transfer To Address"));
    }

    buffer = formatted_receipt.eventsData[0].events.filter((event) => {
      return event.name = '_value';
    });

    let transfered_ost = basicHelper.convertToNormal(buffer[0].value);
    let ost_to_stake_to_mint_bt = transfered_ost - oThis.st_prime_to_mint;
    oThis.critical_chain_interaction_log.request_params.ost_to_stake_to_mint_bt = ost_to_stake_to_mint_bt;

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = GetTransferToStakerStatus;