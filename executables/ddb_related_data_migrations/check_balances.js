'use strict';

const openStPlatform = require('@openstfoundation/openst-platform')
  , openStorage = require('@openstfoundation/openst-storage')
;

const rootPrefix = '../..'
  , getBrandedTokenBalanceKlass = openStPlatform.services.balance.brandedTokenFromChain
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , TokenBalanceModel = openStorage.TokenBalanceModel
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CheckBalances = function (params) {

  const oThis = this
  ;

  oThis.checkedAddressCount = 0;
  oThis.mismatchAddresses = {};
  oThis.mismatchAddressesCount = 0;
  oThis.clientIds = params.client_ids;

};

CheckBalances.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'e_drdm_cs_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  asyncPerform: async function () {

    const oThis = this
      , pageLimit = 100;

    let offset = 0;

    while (true) {

      let query = new ClientBrandedTokenModel().select('id, client_id, token_erc20_address').where('token_erc20_address IS NOT NULL');
      if (oThis.clientIds.length > 0) {
        query = query.where(["client_id in (?)", oThis.clientIds]);
      }
      var dbRows = await query.limit(pageLimit).offset(offset).fire();

      if (dbRows.length == 0) {
        return Promise.resolve(responseHelper.successWithData({
          mismatchAddresses: JSON.stringify(oThis.mismatchAddresses),
          checkedAddressCount: oThis.checkedAddressCount,
          mismatchAddressCount: oThis.mismatchAddressesCount,
          success_percent: ((oThis.checkedAddressCount - oThis.mismatchAddressesCount) / parseFloat(oThis.checkedAddressCount) * 100)
        }));
      }

      for (let i = 0; i < dbRows.length; i++) {
        await oThis._checkForClient(dbRows[i]);
      }

      offset += dbRows.length;

    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * for a client would check balances
   *
   * @returns {promise}
   */
  _checkForClient: async function (clientData) {

    const oThis = this
      , erc20_address = clientData['token_erc20_address']
    ;

    let dbRows = await new ManagedAddressModel().select('id, ethereum_address').where({client_id: clientData['client_id']}).fire();

    let batchNo = 1
      , batchSize = 25
      , mismatchAddresses = []
    ;

    while (true) {

      let offset = (batchNo - 1) * batchSize
        , batchedDbRows = dbRows.slice(offset, batchSize + offset)
      ;

      if (batchedDbRows.length === 0) break;

      logger.info(`starting checking for batch: ${batchNo} of clientId: ${clientData['client_id']}`);

      let addresses = []
        , promises = []
      ;

      for (let i = 0; i < batchedDbRows.length; i++) {
        addresses.push(batchedDbRows[i]['ethereum_address'].toLowerCase());
        let promise = new getBrandedTokenBalanceKlass({
          address: batchedDbRows[i]['ethereum_address'],
          erc20_address: erc20_address,
        }).perform();
        promises.push(promise);
      }

      // console.log('addresses for batch: ', batchNo, JSON.stringify(addresses));

      let promiseResponses = await Promise.all(promises);
      // console.log('promiseResponses', JSON.stringify(promiseResponses));

      let balancesFromDdbRsp = await new TokenBalanceModel({
        erc20_contract_address: erc20_address,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).getBalance({ethereum_addresses: addresses});

      // console.log('balancesFromDdbRsp', balancesFromDdbRsp);

      let balancesFromDdb = balancesFromDdbRsp.data;

      // console.log('balancesFromDdb', balancesFromDdb);

      for (let i = 0; i < addresses.length; i++) {

        // console.log('address', addresses[i]);

        let address = addresses[i]
          , balanceFromChain = promiseResponses[i].data.balance
          , balanceFromDdb = (balancesFromDdb[address] || {'settled_balance': '0'})['settled_balance']
        ;

        oThis.checkedAddressCount += 1;

        if (balanceFromChain != balanceFromDdb) {
          mismatchAddresses.push(address);
          oThis.mismatchAddressesCount += 1;
          logger.info(`balanceMismatch : contractAddress : ${erc20_address} userAddress: ${address} : balanceFromChain : ${balanceFromChain} : balanceFromDdb : ${balanceFromDdb}`);
        }

      }

      batchNo = batchNo + 1;

    }

    if (mismatchAddresses.length > 0) {
      oThis.mismatchAddresses[erc20_address] = mismatchAddresses;
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/ddb_related_data_migrations/check_balances.js client_ids_str');
};

const args = process.argv
  , clientIdsStr = args[2]
;

let clientIdsArray = [];

const validateAndSanitize = function () {

  if (clientIdsStr) {
    clientIdsArray = JSON.parse(clientIdsStr);
  }

};

// validate and sanitize the input params
validateAndSanitize();

const object = new CheckBalances({client_ids: clientIdsArray});
object.perform().then(function (a) {
  console.log(a.toHash());
  process.exit(1)
}).catch(function (a) {
  console.log(a);
  process.exit(1)
});