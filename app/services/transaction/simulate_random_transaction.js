"use strict";

/**
 * Simulate Random transaction for client
 *
 * @module /app/services/transaction/simulate_random_transaction
 */
const rootPrefix = "../../.."
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , ManagedAdressModel = require(rootPrefix + '/app/models/managed_address')
  , ClientUsersCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_users_count')
  , ClientTrxTypeCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type_count')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction')
  , EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  ;

/**
 * Simulate Random transaction
 *
 * @param {number} params.client_id - client id who is performing a transaction.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 *
 * @Constructor
 */
const simulateRandomTransactionKlass = function(params){

  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.prioritizeCompanyTxs = params.prioritize_company_txs;

  oThis.clientBrandedToken = {};
  oThis.randomTrxTypes = [];
  oThis.maxTxTypesToAttempt = 50;
  oThis.maxUsersToAttempt = 250;
  oThis.maxUserBtBalance = 0;

  oThis.conversionFactor = null;
  oThis.ostUSDPrice = null;
  oThis.randomUsers = [];
  
};

simulateRandomTransactionKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_tr_srt_10", "Unhandled result", null, [], {sendErrorEmail: false});
        }
      })
  },

  asyncPerform: async function(){

    const oThis = this;

    // Fetch client branded token
    var r = await oThis.fetchClientBrandedToken();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    // Fetch client branded token
    var r = await oThis.fetchConversionFactors();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    // Fetch Random users
    var r = await oThis.fetchRandomUsers();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    // Fetch Txs and Filter out some transaction kinds (if needed)
    var r = await oThis.fetchRandomTransactionTypes();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    // Fetch tx params
    var r = await oThis.fetchTxParams();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    var r = await oThis.sendTransaction(r.data);

    return Promise.resolve(r);

  },

  /**
   * Fetch client bt details
   *
   * @return {Promise<any>}
   */
  fetchClientBrandedToken: async function() {

    const oThis = this;
    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();

    if (cacheRsp.isFailure()) {
      return Promise.resolve(responseHelper.error("s_tr_srt_1", "Invalid Token Symbol", null, [], {sendErrorEmail: false}));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Fetch conversion factors
   *
   * @return {Promise<any>}
   */
  fetchConversionFactors:  async function() {

    const oThis = this;

    oThis.conversionFactor = basicHelper.convertToBigNumber(oThis.clientBrandedToken['conversion_factor']);

    const ostPrices = await new ostPriceCacheKlass().fetch();

    oThis.ostUSDPrice = basicHelper.convertToBigNumber(ostPrices['data']['OST']['USD']);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Fetch Random users from database which have enough balance to perform tx
   *
   * @return {Promise<any>}
   */
  fetchRandomUsers: async function(){

    const oThis = this;

    var countCacheObj = new ClientUsersCntCacheKlass({client_id: oThis.clientId});
    var resp = await countCacheObj.fetch();
    if(resp.isFailure() || parseInt(resp.data) <= 0){
      return Promise.resolve(responseHelper.error('s_tr_srt_1', 'No active users for client.', null, [],
        {sendErrorEmail: false}));
    }

    var users = await new ManagedAdressModel().getRandomActiveUsers(
        oThis.clientId, oThis.maxUsersToAttempt, parseInt(resp.data)
    );

    var usersCount = users.length;

    if(usersCount < 2){
      return Promise.resolve(responseHelper.error('s_tr_srt_2', 'No active users for client.', null, [],
        {sendErrorEmail: false}));
    }

    var userEthAddresses = [];
    for(var i=0; i<usersCount; i++) {
      userEthAddresses.push(users[i].ethereum_address);
    }

    /*********************** TODO: OPEN THIS RANDOM LOGIC ***************************
    // const economyUserBalance = new EconomyUserBalanceKlass({client_id: oThis.clientId, ethereum_addresses: userEthAddresses})
    //     , userBalancesResponse = await economyUserBalance.perform()
    // ;
    //
    // var balanceHashData = null
    //     , userBalance = null
    //     , user = null;
    //
    // if (userBalancesResponse.isFailure()) {
    //   return Promise.resolve(responseHelper.error('s_tr_srt_3', 'could not fetch balances', null, [],
    //      {sendErrorEmail: false}));
    // } else {
    //   balanceHashData = userBalancesResponse.data;
    // }
    //
    // for(var i=0; i<usersCount; i++) {
    //   user = users[i];
    //   userBalance = balanceHashData[user.ethereum_address];
    //   if (userBalance) {
    //     userBalance = basicHelper.convertToNormal(userBalance.tokenBalance)
    //   } else {
    //     userBalance = 0
    //   }
    //   if (userBalance.gt(oThis.maxUserBtBalance)) {
    //     oThis.maxUserBtBalance = userBalance;
    //   }
    //   user['bt_balance'] = userBalance;
    // }
     ************************ TODO: OPEN THIS RANDOM LOGIC ***************************************************/

    oThis.randomUsers = basicHelper.shuffleArray(users); // shuffle is important

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Fetch Random transaction type for client
   *
   * @return {Promise<any>}
   */
  fetchRandomTransactionTypes: async function(){

    const oThis = this;
    var countCacheObj = new ClientTrxTypeCntCacheKlass({clientId: oThis.clientId});
    var resp = await countCacheObj.fetch();
    if(resp.isFailure() || parseInt(resp.data) <= 0){
      return Promise.resolve(responseHelper.error('s_tr_srt_4', 'No active transactions for client.', null, [],
        {sendErrorEmail: false}));
    }

    var offset = (parseInt(resp.data) - oThis.maxTxTypesToAttempt + 1);
    offset = ((offset > 0) ? (Math.floor(Math.random() * offset)) : 0);

    var params = {
      clientId: oThis.clientId,
      limit: oThis.maxTxTypesToAttempt,
      offset: offset
    };

    var trxTypes = await new ClientTransactionTypeModel().getAll(params);

    if(!trxTypes[0]){
      return Promise.resolve(responseHelper.error('s_tr_srt_6', 'No active transactions for client.', null, [],
        {sendErrorEmail: false}));
    }

    if (oThis.prioritizeCompanyTxs) {

      var companyTxs = []
          , otherTxs = []
          , tx = null;

      // seperate company txs from others
      for(var i=0; i<trxTypes.length; i++) {

        tx = trxTypes[i];

        if (!oThis.canExecuteTxKind(tx)) {
          continue;
        }

        if (tx.kind === clientTxTypesConst.companyToUserKind) {
          companyTxs.push(tx);
        } else {
          otherTxs.push(tx);
        }

      }

      otherTxs = basicHelper.shuffleArray(trxTypes);
      companyTxs = basicHelper.shuffleArray(companyTxs);

      oThis.randomTrxTypes = companyTxs.concat(otherTxs);

    } else {

      var txs = [];

      for(var i=0; i<trxTypes.length; i++) {

        tx = trxTypes[i];

        if (!oThis.canExecuteTxKind(tx)) {
          continue;
        } else {
          txs.push(tx);
        }

      }

      if (txs.length > 0) {
        oThis.randomTrxTypes = basicHelper.shuffleArray(txs); // shuffle is important
      } else {
        oThis.randomTrxTypes = [trxTypes[0]]; // as all txs do not fulfil user balance condition. add first so that it fails
      }

    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * fetch tx params by looking at users & tx types and verifying balances
   *
   * @return {Promise<any>}
   */
  fetchTxParams: async function(){

    const oThis = this;

    var randomTrxType = null
        , txBtValue = null
        , txParams = {client_id: oThis.clientId, token_symbol: oThis.tokenSymbol}
        , randomFromUser = null
        , randomToUser = null;

    for(var i=0; i<oThis.randomTrxTypes.length; i++) {

      randomTrxType = oThis.randomTrxTypes[i];
      /*********************** TODO: OPEN THIS RANDOM LOGIC ***************************
      // txBtValue = oThis.getTxBtValue(randomTrxType);
     *********************** TODO: OPEN THIS RANDOM LOGIC ***************************/

      if (randomTrxType.kind === clientTxTypesConst.companyToUserKind) {

        // we could add a check here to fetch reserve balance
        txParams['transaction_kind'] = randomTrxType.name;
        txParams['from_uuid'] = oThis.clientBrandedToken['reserve_address_uuid'];
        txParams['to_uuid'] = oThis.randomUsers[0]['uuid'];
        break;

      } else {

        txParams['transaction_kind'] = randomTrxType.name;

        var breakOuterLoop = false;

        for(var j=0; j<oThis.randomUsers.length; j++) {

          randomFromUser = oThis.randomUsers[j];
          txParams['from_uuid'] = randomFromUser['uuid'];

          if (randomTrxType.kind === clientTxTypesConst.userToCompanyKind) {
            txParams['to_uuid'] = oThis.clientBrandedToken['reserve_address_uuid'];
          } else {
            randomToUser = oThis.randomUsers[j+1];
            if(!randomToUser) {
              randomToUser = oThis.randomUsers[0];
            }
            txParams['to_uuid'] = randomToUser['uuid'];
          }

          breakOuterLoop = true;

          /*********************** TODO: OPEN THIS RANDOM LOGIC ***************************
          // if (randomFromUser['bt_balance'] && randomFromUser['bt_balance'].gt(txBtValue)) {
          //   breakOuterLoop = true;
          //   break;
          // }
           *********************** TODO: OPEN THIS RANDOM LOGIC ***************************/

        }

        if (breakOuterLoop) {
          break;
        }

      }

    }

    return Promise.resolve(responseHelper.successWithData(txParams));

  },

  /**
   * Check if this tx can be executed
   *
   * @return {Boolean}
   */
  canExecuteTxKind: function(tx) {

    return true;

    /*********************** TODO: OPEN THIS RANDOM LOGIC ***************************
    // const oThis = this;
    //
    // return basicHelper.convertToBigNumber(oThis.getTxBtValue(tx)).lte(oThis.maxUserBtBalance);

     /*********************** TODO: OPEN THIS RANDOM LOGIC ***************************/

  },

  /**
   * Convert Bt to Fiat
   *
   * @return {BigNumber}
   */
  convertBtToFiat: function(txFiatValue) {
    const oThis = this;
    const txOstValue = txFiatValue.div(oThis.ostUSDPrice);
    return txOstValue.mul(oThis.conversionFactor);
  },

  /**
   * Get Tx BT Value
   *
   * @return {BigNumber}
   */
  getTxBtValue(tx) {

    const oThis = this;

    var txBtValue = null
        , txFiatValue = null
    ;

    if (tx.currency_type === clientTxTypesConst.btCurrencyType) {
      txBtValue = basicHelper.convertToNormal(tx.value_in_bt_wei);
    } else {
      txFiatValue = basicHelper.convertToBigNumber(tx.value_in_usd);
      txBtValue = oThis.convertBtToFiat(txFiatValue);
    }

    return txBtValue;

  },

  /**
   * Execute random transaction
   *
   * @return {Promise<any>}
   */
  sendTransaction: async function(txParams){

    const oThis = this;

    if(!txParams.from_uuid || !txParams.to_uuid){
      return Promise.resolve(responseHelper.error("s_tr_srt_8", "Something went wrong.", null, [],
        {sendErrorEmail: false}));
    }

    if(txParams.from_uuid === txParams.to_uuid){
      return Promise.resolve(responseHelper.error("s_tr_srt_9", "Something went wrong.", null, [],
        {sendErrorEmail: false}));
    }

    var obj = new executeTransactionKlass(txParams);
    var resp = await obj.perform();
    return Promise.resolve(resp);

  }

};

module.exports = simulateRandomTransactionKlass;