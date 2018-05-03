"use strict";

const rootPrefix = '..'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const openStPayments = require('@openstfoundation/openst-payments')
    , SetWorkerKlass = openStPayments.services.workers.setWorker
;

const ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , GenerateEthAddressKlass = require(rootPrefix + '/app/services/address/generate')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

const addMoreWorkersKlass = function(params){

  const oThis = this;
  oThis.startClientId = params['startClientId'];
  oThis.endClientId = params['endClientId'];
  oThis.clientIds = params['clientIds'];
  oThis.newWorkersCnt = params['newWorkersCnt'];

  oThis.clientIdSymbolMap = {};
  oThis.clientIdSetWorkerAddressesMap = {};

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;
  oThis.deactivationHeight = basicHelper.convertToBigNumber(10).toPower(18).toString(10);

};

addMoreWorkersKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
        , r = null
    ;

    return oThis.asyncPerform()
        .catch(function (error) {

          var errorObj = null;

          // something unhandled happened
          logger.error('executables/add_more_workers.js::perform::catch');
          logger.error(error);

          if(responseHelper.isCustomResult(error)) {
            errorObj = error;
          } else {
            errorObj = responseHelper.error({
              internal_error_identifier: 'e_amw_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {error: error},
              error_config: errorConfig
            });
          }

          if (oThis.criticalChainInteractionLog) {
            new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
                oThis.criticalChainInteractionLog.id,
                {status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus], response_data: errorObj.toHash()},
                oThis.parentCriticalChainInteractionLogId,
                oThis.clientTokenId
            );
          }

          return errorObj;

        });

  },

  asyncPerform: async function() {

    const oThis = this;

    var r = oThis.setclientIds();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    var r = await oThis.setclientIdSymbolMap();

    if (r.isFailure()) {
      return Promise.reject(r);
    }
    
    var r = await oThis.generateWorkerAddresses();

    if (r.isFailure()) {
      return Promise.reject(r);
    }
    
    var r = await oThis.associateWorkerAddresses();
    return Promise.resolve(r);

  },

  setclientIds: function() {

    const oThis = this;

    if (oThis.clientIds && oThis.clientIds.length >0 ) {
      return responseHelper.successWithData({});
    }

    if (!oThis.startClientId || !oThis.endClientId) {
      return responseHelper.error({
        internal_error_identifier: 'e_amw_2',
        api_error_identifier: "invalid_params",
        error_config: errorConfig
      });
    }

    oThis.clientIds = [];

    for(var i=oThis.startClientId; i<=oThis.endClientId; i++) {
      oThis.clientIds.push(i);
    }

    logger.info('oThis.clientIds set: ', oThis.clientIds);
    return responseHelper.successWithData({});

  },

  generateWorkerAddresses: async function() {

    const oThis = this
        , dbFields = ['client_id', 'managed_address_id', 'status', 'created_at', 'updated_at']
        , currentTime = new Date();

    for(var j=0; j<oThis.clientIds.length; j++) {

      var clientId = oThis.clientIds[j]
          , managedAddressInsertData = []
      ;

      var generateEthAddress = new GenerateEthAddressKlass({
        addressType: managedAddressesConst.workerAddressType,
        clientId: clientId
      });

      for(var i=0; i<oThis.newWorkersCnt; i++) {

        var r = await generateEthAddress.perform();

        if (r.isFailure()) {
          return Promise.resolve(r);
        }

        const resultData = r.data[r.data.result_type][0];
        managedAddressInsertData.push(
          [
            clientId,
            resultData.id,
            new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus],
            currentTime,
            currentTime
          ]);
      }

      await new ClientWorkerManagedAddressIdModel().insertMultiple(dbFields, managedAddressInsertData).fire();

    }

    logger.info('waiting for addresses to be generated');

    var wait = function(){
      return new Promise(function(onResolve, onReject){
        setTimeout(function () {
          logger.info('addresses generated');
          onResolve(responseHelper.successWithData({}));
        }, 3000);
      });
    };

    return await wait();

  },

  setclientIdSymbolMap: async function() {

    const oThis = this
        , clientBrandedTokens = await new ClientBrandedTokenModel().getByClientIds(oThis.clientIds);

    var clientBrandedToken = null;
    
    for(var i=0; i<clientBrandedTokens.length; i++) {
      clientBrandedToken = clientBrandedTokens[i];
      oThis.clientIdSymbolMap[parseInt(clientBrandedToken.client_id)] = clientBrandedToken.symbol;
    }

    oThis.clientIds = Object.keys(oThis.clientIdSymbolMap); //replace ids as outside world might have passed invalid ids

    return responseHelper.successWithData({});
    
  },

  associateWorkerAddresses:  async function() {

    const oThis = this;

    var clientId = null;

    for(var j=0; j<oThis.clientIds.length; j++) {

      clientId = oThis.clientIds[j];

      logger.info('sending txs for clientId', clientId);

      var existingWorkerManagedAddresses = await new ClientWorkerManagedAddressIdModel().getInActiveByClientId(clientId)
          , managedAddressIdClientWorkerAddrIdMap = {}
          , workerAddressesIdToUpdateMap = {}
      ;

      for(var i=0; i<existingWorkerManagedAddresses.length; i++) {
        managedAddressIdClientWorkerAddrIdMap[parseInt(existingWorkerManagedAddresses[i].managed_address_id)] = existingWorkerManagedAddresses[i].id;
      }

      const managedAddresses = await new ManagedAddressModel().select('*')
          .where(['id in (?)', Object.keys(managedAddressIdClientWorkerAddrIdMap)]).fire();

      for(var i=0; i<managedAddresses.length; i++) {
        workerAddressesIdToUpdateMap[managedAddresses[i].ethereum_address] = managedAddressIdClientWorkerAddrIdMap[managedAddresses[i].id];
      }

      var workerAddrs = Object.keys(workerAddressesIdToUpdateMap)
          , promiseResolvers = []
          , promiseResponses = []
          , formattedPromiseResponses = {}
          , successWorkerAddrIds = []
          , setWorkerObj = null
          , promise = null
      ;

      for(var i=0; i<workerAddrs.length; i++) {

        setWorkerObj = new SetWorkerKlass({
          workers_contract_address: oThis.workerContractAddress,
          sender_address: oThis.senderAddress,
          sender_passphrase: oThis.senderPassphrase,
          worker_address: workerAddrs[i],
          deactivation_height: oThis.deactivationHeight,
          gas_price: oThis.gasPrice,
          chain_id: oThis.chainId,
          options: {returnType: 'txReceipt'}
        });

        promise = setWorkerObj.perform();

        promiseResolvers.push(promise);

      }

      promiseResponses = await Promise.all(promiseResolvers);

      for(var i=0; i<promiseResolvers.length; i++) {
        var r = promiseResponses[i];
        if (r.isFailure()) {
          logger.notify('l_sw_2', 'Set Worker Failed', r.toHash(), {clientId: clientId});
        } else {
          formattedPromiseResponses[workerAddressesIdToUpdateMap[workerAddrs[i]]] = r.data;
          successWorkerAddrIds.push(workerAddressesIdToUpdateMap[workerAddrs[i]]);
        }
      }

      if (successWorkerAddrIds.length == 0) {
        const errorRsp = responseHelper.error(
          {
            internal_error_identifier: 'e_amw_3',
            api_error_identifier: 'could_not_proceed',
            debug_options: {data: formattedPromiseResponses},
            error_config: errorConfig
          }
        );
        return Promise.reject(errorRsp);
      }

      await new ClientWorkerManagedAddressIdModel().markStatusActive(successWorkerAddrIds);

    }

    return responseHelper.successWithData(oThis.clientIdSetWorkerRsp);
    
  }

};

const obj = new addMoreWorkersKlass({startClientId: 1021, endClientId: 1021, newWorkersCnt: 4, clientIds: []});
obj.perform().then(logger.debug);