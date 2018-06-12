'use strict';

const openStPlatform = require('@openstfoundation/openst-platform')
    , openStorage = require('@openstfoundation/openst-storage')
;

const rootPrefix = '../..'
    , getBrandedTokenBalanceKlass = openStPlatform.services.balance.brandedToken
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
const SyncDdbBalancesWithChain = function (erc20AddressToAdressesMap) {

  const oThis = this
  ;

  oThis.erc20AddressToAdressesMap = erc20AddressToAdressesMap;

};

SyncDdbBalancesWithChain.prototype = {

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
              internal_error_identifier: 'e_drdm_sdbwc_1',
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
  asyncPerform: async function() {

    const oThis = this
        , erc20Addresses = Object.keys(oThis.erc20AddressToAdressesMap);

    for(let i=0; i<erc20Addresses.length; i++) {

      let erc20Address = erc20Addresses[i];

      await oThis._syncForClient(erc20Address, oThis.erc20AddressToAdressesMap[erc20Address]);

    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * for a client would check balances
   *
   * @returns {promise}
   */
  _syncForClient: async function(erc20_address, userAddresses) {

    const oThis = this
        , batchSize = 25
    ;

    logger.info(`starting for erc20_address: ${erc20_address}`);

    let batchNo = 1
        , tokenBalanceObj = new TokenBalanceModel({
              erc20_contract_address: erc20_address,
              ddb_service: ddbServiceObj,
              auto_scaling: autoscalingServiceObj
    });

    while (true) {

      let offset = (batchNo - 1) * batchSize
          , batcheduserAddresses = userAddresses.slice(offset, batchSize + offset)
      ;

      if (batcheduserAddresses.length === 0) break;

      let promises = [];

      for(let i=0; i<batcheduserAddresses.length; i++) {
        let promise = new getBrandedTokenBalanceKlass({
          address: batcheduserAddresses[i],
          erc20_address: erc20_address,
          use_cache: 0
        }).perform()
        promises.push(promise);
      }

      let promiseResponses = await Promise.all(promises);

      for(let i=0; i<batcheduserAddresses.length; i++) {

        let updateData = {
          ethereum_address: batcheduserAddresses[i],
          settle_amount: promiseResponses[i].data.balance
        };
        let updateRsp = await tokenBalanceObj.set(updateData);

        logger.info('updateData', updateData);
        logger.info('updateRsp', JSON.stringify(updateRsp.toHash()));

      }

      batchNo = batchNo + 1;

    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

// const jsonStr = '{"0x4F739d40dB7509Fac8789a9Ff7bd3f86132738E2":["0xdcb2ec51c8c4632ae0039befef861fd1de2cd616","0xb9f6d4c885e8653f66fbf4f1a87d2db0835c70e8","0x16b8e5c5cf4532969746d9c97c5c233b3647c105","0x06c18b69b13b38a2ed0d0c1146c2ed340ed4e7e5","0x8837741e2ede243927679e2b9c290243140dafc7","0x8187f120d3d2aa0fd32df04bc1cf8a148beadf1f","0x924efb75845b8a5b93e00f864391894360315bdb","0x79f720d773619edea6aa91ce9553983bf36ce87f","0xab3e3db1362b2b91663b22ff277f039eaf1b8cdb","0xfec3033dd1e9de348e13169ed7c53dd6e03b28a1","0xb5c0d3fc77ec5422c0a16cdf652c764d29df5961","0x53dd4f876e922877ba57921ee2f8200bc4ce9963","0x1cb5860593729a7ff4d0ca7d0bc101a4544b19a9"]}';
const jsonStr = '{}'
const object = new SyncDdbBalancesWithChain(JSON.parse(jsonStr));
object.perform().then(function(a) {console.log(JSON.stringify(a.toHash())); process.exit(1)}).catch(function(a) {console.log(JSON.stringify(a)); process.exit(1)});