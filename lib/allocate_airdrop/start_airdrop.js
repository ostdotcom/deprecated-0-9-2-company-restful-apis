"use strict";

/**
 * Start allocating airdrop amount to users.
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const uuid = require('uuid')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , openSTNotification = require('@openstfoundation/openst-notification')
;


const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ManagedAddressesCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
;


const StartAllocateAirdropKlass = function (params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id || params.critical_interaction_log_id;
  oThis.parentCriticalInteractionLogId = parseInt(oThis.parentCriticalInteractionLogId);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.clientId = null;
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
      .catch(async function(error) {
        var errorObj = null;

        if(responseHelper.isCustomResult(error)) {
          errorObj = error;
        } else {
          // something unhandled happened
          logger.error('lib/allocate_airdrop/start_airdrop.js::perform::catch');
          logger.error(error);

          errorObj = responseHelper.error("l_aa_sa_1", "Unhandled result", null, {error: error}, {sendErrorEmail: true});

        }

        if (oThis.criticalChainInteractionLog) {
          await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
            oThis.criticalChainInteractionLogId,
            {
              status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
              response_data: errorObj.toHash(),
            },
            oThis.parentCriticalInteractionLogId,
            oThis.clientTokenId
          ).catch(function (err) {
            logger.error('lib/allocate_airdrop/start_airdrop.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(err);
          });
        }

        return errorObj;

      });
  },

  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateInput();

    await oThis.validateIncompleteRequests();

    await oThis.validateReserveBalance();

    await oThis.insertDb();

    return Promise.resolve(responseHelper.successWithData({airdrop_uuid: oThis.airdropUuid}))
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function () {

    const oThis = this
      , criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ])
      , criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId]
      , parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId]
    ;

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
        "l_aa_sa_2", "criticalChainInteractionLog not found",
        null, {}, {sendErrorEmail: false}
      );
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
        "l_aa_sa_2", "parentCriticalChainInteractionLog not found",
        null, {}, {sendErrorEmail: false}
      );
      return Promise.reject(errorRsp);
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Validate Input parameters
   *
   * Sets clientBrandedToken
   * @return {Promise<any>}
   */
  validateInput: async function () {
    const oThis = this;

    const airdropParams = oThis.parentCriticalChainInteractionLog.inputParams.airdrop_params;

    if (!airdropParams) {
      return Promise.reject(responseHelper.error("l_aa_sa_3", "Required params missing", null, {},
        {sendErrorEmail: false}));
    }

    oThis.amount = airdropParams.airdrop_amount;
    oThis.listType = airdropParams.airdrop_user_list_type;

    if (isNaN(oThis.amount) || oThis.amount <= 0) {
      return Promise.reject(responseHelper.error("l_aa_sa_4", "Invalid amount", "", [{amount: 'Invalid amount'}],
        {sendErrorEmail: false}));
    }

    if (![clientAirdropConst.allAddressesAirdropListType,
        clientAirdropConst.neverAirdroppedAddressesAirdropListType].includes(oThis.listType)) {
      return Promise.reject(responseHelper.error("l_aa_sa_5", "Invalid List type to airdrop users", "",
        [{airdrop_list_type: 'Invalid List type to airdrop users'}], {sendErrorEmail: false}));
    }

    const btCache = new BTCacheKlass({clientId: oThis.clientId})
      , btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(responseHelper.error("l_aa_sa_6", "Invalid Token Symbol", null, {}, {sendErrorEmail: false}));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.reject(responseHelper.error("l_aa_sa_7", "Invalid client id", null, {}, {sendErrorEmail: false}));
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

    var obj = new ClientAirdropModel();
    const clientAirdrops = await new ClientAirdropModel().select('*').where(['client_id=?', oThis.clientId]);
    if (clientAirdrops.length > 0) {
      for (var i = 0; i < clientAirdrops.length; i++) {
        if ([clientAirdropConst.incompleteStatus, clientAirdropConst.processingStatus].includes(obj.statuses[clientAirdrops[i].status])) {
          return Promise.reject(responseHelper.error("l_aa_sa_8", "Airdrop requests are in-process", null, {},
            {sendErrorEmail: false}));
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

    const addrResponse = await new ManagedAddressesCacheKlass(
      {'uuids': [oThis.clientBrandedToken.reserve_address_uuid]}).fetch();

    if (addrResponse.isFailure()) {
      return Promise.reject(addrResponse);
    }

    const reserveAddressObj = addrResponse.data[oThis.clientBrandedToken.reserve_address_uuid];

    const brandedTokenBalanceResponse = await new openStPlatform.services.balance.brandedToken(
      {
        address: reserveAddressObj.ethereum_address,
        erc20_address: oThis.clientBrandedToken.token_erc20_address
      }).perform();

    if (brandedTokenBalanceResponse.isFailure()) {
      return Promise.reject(responseHelper.error("l_aa_sa_9", "Something went wrong.", null, {},
        {sendErrorEmail: false}));
    }

    const getFilteredActiveUsersCountParams = {client_id: oThis.clientId};

    if (oThis.listType == clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      getFilteredActiveUsersCountParams['property_unset_bit_value'] = new ManagedAddressModel()
        .invertedProperties[managedAddressesConst.airdropGrantProperty]
    }

    const getFilteredActiveUsersCountResponse = await new ManagedAddressModel()
      .getFilteredActiveUsersCount(getFilteredActiveUsersCountParams);

    if (!getFilteredActiveUsersCountResponse[0] || getFilteredActiveUsersCountResponse[0].total_count == 0) {
      return Promise.reject(responseHelper.error("l_aa_sa_10", "No users found to airdrop for this list type", "",
        [{airdrop_list_type: 'No users found to airdrop for this list type'}], {sendErrorEmail: false}));
    }

    const amountInWei = basicHelper.convertToWei(oThis.amount);
    if (amountInWei.mul(getFilteredActiveUsersCountResponse[0].total_count).toNumber() > brandedTokenBalanceResponse.data.balance) {
      return Promise.reject(
        responseHelper.error(
          "l_aa_sa_11",
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

    const clientAirdropCreateResponse = await new ClientAirdropModel().create({
      airdrop_uuid: oThis.airdropUuid, client_id: oThis.clientId,
      client_branded_token_id: oThis.clientBrandedToken.id,
      common_airdrop_amount_in_wei: basicHelper.convertToWei(oThis.amount).toNumber(),
      airdrop_list_type: oThis.listType,
      status: clientAirdropConst.incompleteStatus
    });

    // Publish Airdrop event
    await openSTNotification.publishEvent.perform(
      {
        topics: ['airdrop.start.'+ coreConstants.PACKAGE_NAME],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            client_airdrop_id: clientAirdropCreateResponse.insertId,
            critical_chain_interaction_log_id: oThis.criticalInteractionLogId
          }
        }
      }
    );
  }

};

module.exports = StartAllocateAirdropKlass;

