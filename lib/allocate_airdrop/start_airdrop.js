"use strict";

/**
 * Start allocating airdrop amount to users.
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const rootPrefix = '../../..'
  , uuid = require('uuid')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , openSTNotification = require('@openstfoundation/openst-notification')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ManagedAddressesCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , managedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;


const StartAllocateAirdropKlass = function (params) {
  const oThis = this;

  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.criticalInteractionLogId = params.critical_interaction_log_id;

  oThis.clientId = null;
  oThis.clientBrandedTokenId = null;
  oThis.amount = null;
  oThis.listType = null;
  oThis.clientBrandedToken = null;
  oThis.airdropUuid = null;
  oThis.tokenSymbol = null;

};

StartAllocateAirdropKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error("lib/allocate_airdrop/start_airdrop.js::perform::catch");
          logger.error(error);

          oThis.markCriticalLogFailure();
          return responseHelper.error("s_am_sa_7", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this;

    var r1 = await oThis.validateInput();
    if (r1.isFailure()) {
      await oThis.markCriticalLogFailure(r1);
      return Promise.resolve(r1);
    }

    var r2 = await oThis.validateIncompleteRequests();
    if (r2.isFailure()) {
      await oThis.markCriticalLogFailure(r2);
      return Promise.resolve(r2);
    }

    var r3 = await oThis.validateReserveBalance();
    if (r3.isFailure()) {
      await oThis.markCriticalLogFailure(r3);
      return Promise.resolve(r3);
    }

    oThis.insertDb();

    return Promise.resolve(responseHelper.successWithData({airdrop_uuid: oThis.airdropUuid}))
  },

  markCriticalLogFailure: async function (errResponse) {
    await new CriticalChainInteractionLogModel().update().where().fire();
  },

  /**
   * Validate Input parameters
   *
   * Sets clientBrandedToken
   * @return {Promise<any>}
   */
  validateInput: async function () {
    const oThis = this;
    var criticalInterectionLogs = {}
      , airdropParams = null;

    //Get airdrop params from critical logs table.
    const criticalInterectionLogRecords = await new CriticalChainInteractionLogModel().select('id, client_id, request_params')
      .where(['id in (?)', [oThis.parentCriticalInteractionLogId, oThis.criticalInteractionLogId]])
      .fire();

    for(var i=0; i<criticalInterectionLogRecords.length; i++){
      const criticalInterectionLogRecord = criticalInterectionLogRecords[i];
      criticalInterectionLogs[criticalInterectionLogRecord.id] = criticalInterectionLogRecord;
    }

    if(oThis.parentCriticalInteractionLogId){
      const criticalInterectionLog = criticalInterectionLogs[oThis.parentCriticalInteractionLogId];
      const inputParams = JSON.parse(criticalInterectionLog.input_params);
      airdropParams = inputParams.airdrop_params;
    }
    const criticalInterectionLog = criticalInterectionLogs[oThis.criticalInteractionLogId];

    if (!criticalInterectionLog) {
      return Promise.resolve(responseHelper.error("s_am_sa_1", "Invalid request", null, {},
        {sendErrorEmail: false}));
    }

    if(!airdropParams){
      const inputParams = JSON.parse(criticalInterectionLog.input_params);
      airdropParams = inputParams.airdrop_params;
    }

    if (!airdropParams) {
      return Promise.reject(responseHelper.error("s_am_sa_1", "Required params missing", null, {},
        {sendErrorEmail: false}));
    }

    oThis.clientId = criticalInterectionLog.client_id;
    oThis.clientBrandedTokenId = criticalInterectionLog.client_branded_token_id;
    oThis.amount = airdropParams.airdrop_amount;
    oThis.listType = airdropParams.airdrop_user_list_type;

    if (isNaN(oThis.amount) || oThis.amount <= 0) {
      return Promise.reject(responseHelper.error("s_am_sa_1", "Invalid amount", "", [{amount: 'Invalid amount'}]));
    }

    if (![clientAirdropConst.allAddressesAirdropListType,
        clientAirdropConst.neverAirdroppedAddressesAirdropListType].includes(oThis.listType)) {
      return Promise.reject(responseHelper.error("s_am_sa_2", "Invalid List type to airdrop users", "", [{airdrop_list_type: 'Invalid List type to airdrop users'}]));
    }

    const btCache = new BTCacheKlass({clientId: oThis.clientId})
      , btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(responseHelper.error("s_am_sa_3", "Invalid Token Symbol"));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.reject(responseHelper.error("s_am_sa_3", "Invalid client id"));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Validate whether any incomplete requests are in process
   *
   * @return {Promise<any>}
   */
  validateIncompleteRequests: async function () {
    const oThis = this;

    var obj = new clientAirdropModel();
    var clientAirdrops = await obj.getByClientId(oThis.clientId);
    if (clientAirdrops.length > 0) {
      for (var i = 0; i < clientAirdrops.length; i++) {
        if ([clientAirdropConst.incompleteStatus, clientAirdropConst.processingStatus].includes(obj.statuses[clientAirdrops[i].status])) {
          return Promise.resolve(responseHelper.error("s_am_sa_4", "Airdrop requests are in-process"));
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Reserve's branded token balance is more than airdrop total.
   *
   * @return {Promise<any>}
   */
  validateReserveBalance: async function () {
    const oThis = this;

    var macObj = new ManagedAddressesCacheKlass({'uuids': [oThis.clientBrandedToken.reserve_address_uuid]});
    var addr = await macObj.fetch();
    if (addr.isFailure()) {
      return Promise.resolve(addr);
    }

    var reserveAddressObj = addr.data[oThis.clientBrandedToken.reserve_address_uuid];

    const obj = new openStPlatform.services.balance.brandedToken(
      {'address': reserveAddressObj.ethereum_address, 'erc20_address': oThis.clientBrandedToken.token_erc20_address}
    );

    var resp = await obj.perform();
    if (resp.isFailure()) {
      return Promise.resolve(responseHelper.error("s_am_sa_5", "Something went wrong."));
    }

    var maObj = new managedAddressModel();
    var params = {client_id: oThis.clientId};
    if (oThis.listType == clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      params['property_unset_bit_value'] = maObj.invertedProperties[managedAddressesConst.airdropGrantProperty]
    }
    var response = await maObj.getFilteredActiveUsersCount(params);
    if (!response[0] || response[0].total_count == 0) {
      return Promise.resolve(responseHelper.error("s_am_sa_6", "No users found to airdrop for this list type", "", [{airdrop_list_type: 'No users found to airdrop for this list type'}]));
    }

    var amountInWei = basicHelper.convertToWei(oThis.amount);
    var totalAmountToAirdrop = (parseInt(response[0].total_count) * oThis.amount);
    if (amountInWei.mul(response[0].total_count).toNumber() > resp.data.balance) {
      return Promise.resolve(
        responseHelper.error(
          "s_am_sa_7",
          "Insufficient funds to airdrop users",
          "",
          [{amount: 'Available token amount is insufficient. Please mint more tokens or reduce the amount to complete the process.'}],
          {sendErrorEmail: false}
        )
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Insert in Database
   *
   * Sets @airdropUuid
   *
   */
  insertDb: async function () {
    const oThis = this;
    oThis.airdropUuid = uuid.v4();
    var obj = new clientAirdropModel();
    var resp = await obj.create({
      airdrop_uuid: oThis.airdropUuid, client_id: oThis.clientId,
      client_branded_token_id: oThis.clientBrandedToken.id,
      common_airdrop_amount_in_wei: basicHelper.convertToWei(oThis.amount).toNumber(),
      airdrop_list_type: oThis.listType,
      status: clientAirdropConst.incompleteStatus
    });

    // Publish Airdrop event
    openSTNotification.publishEvent.perform(
      {
        topics: ['airdrop.start.'+ coreConstants.PACKAGE_NAME],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            client_airdrop_id: resp.insertId
          }
        }
      }
    );
  }

};

module.exports = StartAllocateAirdropKlass;

