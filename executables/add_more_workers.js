"use strict";

const rootPrefix = ".."
    , clientWorkerAddressModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
    , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
    , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
    , clientBrandedTokenObj = new ClientBrandedTokenKlass()
    , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
    , SetWorkerKlass = require(rootPrefix + '/app/services/on_boarding/set_worker')
    , GenerateEthAddressKlass = require(rootPrefix + '/app/services/address/generate')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , fetchWorkerStatusesKlass = require(rootPrefix + '/app/services/airdrop_management/fetch_workers_statuses')
;

const addMoreWorkersKlass = function(params){

  const oThis = this;
  oThis.startClientId = params['startClientId'];
  oThis.endClientId = params['endClientId'];
  oThis.clientIds = params['clientIds'];
  oThis.newWorkersCnt = params['newWorkersCnt'];

  oThis.clientIdSymbolMap = {};
  oThis.clientIdSetWorkerRsp = {};

};

addMoreWorkersKlass.prototype = {

  perform: async function() {

    const oThis = this;

    var r = oThis.setclientIds();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    var r = await oThis.setclientIdSymbolMap();

    if (r.isFailure()) {
      return Promise.resolve(r);
    }
    
    var r = await oThis.generateWorkerAddresses();
    console.log(r);
    if (r.isFailure()) {
      return Promise.resolve(r);
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
      return responseHelper.error('e_a_w_1', 'Invalid params');
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
          , clientWorkerAddrObj = new clientWorkerAddressModel()
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
        managedAddressInsertData.push([clientId, resultData.id,
          clientWorkerAddrObj.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus], currentTime, currentTime]);
      }

      await clientWorkerAddrObj.bulkInsert(dbFields, managedAddressInsertData);

    }

    logger.info('waiting for addresses to be generated');

    var wait = function(){
      return new Promise(function(onResolve, onReject){
        setTimeout(function () {
          logger.info('addresses generated');
          onResolve(responseHelper.successWithData({}));
        }, 3000);
      });
    }

    return await wait();

  },

  setclientIdSymbolMap: async function() {

    const oThis = this
        , clientBrandedTokens = await clientBrandedTokenObj.getByClientIds(oThis.clientIds);

    var clientBrandedToken = null;
    
    for(var i=0; i<clientBrandedTokens.length; i++) {
      clientBrandedToken = clientBrandedTokens[i];
      oThis.clientIdSymbolMap[parseInt(clientBrandedToken.client_id)] = clientBrandedToken.symbol;
    }

    oThis.clientIds = Object.keys(oThis.clientIdSymbolMap); //replace ids as outside world might have passed invalid ids

    return responseHelper.successWithData({});
    
  },

  associateWorkerAddresses:  async function() {

    const oThis = this
        , clientIdsLength = oThis.clientIds.length
        , batchCnt = 1;

    var processedCnt = 0;

    while (processedCnt < clientIdsLength) {

      var promiseResolvers = []
          , promiseResponses = [];

      for(var i=processedCnt; i<processedCnt+batchCnt; i++) {

        var clientId = oThis.clientIds[i];
        if (!clientId) {
          break;
        }
        logger.info('sending txs for clientId', clientId);
        var setWorkerObj = new SetWorkerKlass({
          client_id: clientId,
          token_symbol: oThis.clientIdSymbolMap[clientId],
          wait_for_recipt: true
        });

        promiseResolvers.push(setWorkerObj.perform());

      }

      promiseResponses = await Promise.all(promiseResolvers);

      for(var i=0; i<promiseResponses.length; i++) {

        var trxHashesResponse = promiseResponses[i];
        if(trxHashesResponse.isSuccess()){
          const workerStatusesResponse = await new fetchWorkerStatusesKlass({transaction_records: trxHashesResponse.data}).perform();
          if(workerStatusesResponse.isSuccess()){
            logger.info('Workers are marked active for clientId', clientId);
            oThis.clientIdSetWorkerRsp[clientId] = workerStatusesResponse.data;
          }
        }
      }

      processedCnt = processedCnt + batchCnt;

    }

    return responseHelper.successWithData(oThis.clientIdSetWorkerRsp);
    
  }

};

const obj = new addMoreWorkersKlass({startClientId: 1001, endClientId: 1003, newWorkersCnt: 4, clientIds: []});
obj.perform().then(console.log);