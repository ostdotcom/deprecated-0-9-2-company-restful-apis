"use strict";

/**
 * Refill ST PRIME to required client addresses
 *
 * <br><br>Reserve funds following addresses with ST Prime:
 * <ol>
 *   <li>Airdrop fund manager address</li>
 *   <li>Worker address</li>
 * </ol>
 *
 * <br><br>Here we go in batches for client ids and for each client id, the respective reserve funds the respective
 * client addresses with ST Prime.
 *
 * @module executables/fund_addresses/by_reserve/st_prime
 */

const rootPrefix = '../../..'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Load Packages
const FundClientAddressKlass = require(rootPrefix + '/app/services/address/fund_client_address')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * constructor for fund addresses with ST PRIME from Reserve address
 *
 * @constructor
 */
const FundUsersWithSTPrimeFromReserveKlass = function () {};

FundUsersWithSTPrimeFromReserveKlass.prototype = {

  /**
   * Perform
   *
   */
  perform: async function () {

    const oThis = this
      , batchSize = 1
      , clientIds = []
      , clientObjects = await new ClientBrandedTokenModel().select("*").fire();

    for(var i=0; i<clientObjects.length; i++){
      const c_o = clientObjects[i];
      if(c_o.airdrop_contract_addr){
        clientIds.push(clientObjects[i].client_id);
      }
    }

    const numberOfClients = clientIds.length;

    var currStart = 0;
    while(currStart < numberOfClients) {
      const batchedClientIds = clientIds.slice(currStart, currStart + batchSize);
      currStart = currStart + batchSize;

      const promiseArray = [];

      logger.debug("Starting Fund ST' for client ids ", batchedClientIds);
      for(var i = 0; i < batchedClientIds.length; i++) {
        logger.debug("Funding ST' for client id ", batchedClientIds[i]);
        const fundClientAddressObj = new FundClientAddressKlass({client_id: batchedClientIds[i]});
        promiseArray.push(fundClientAddressObj.perform());
      }

      logger.info("Waiting for all promises");
      await Promise.all(promiseArray);
      logger.debug("Ended Fund ST' for client ids ", batchedClientIds);
    }

    logger.debug("Can exit now");
    process.exit(0);
  }

};

// perform action
const FundUsersWithSTPrimeFromReserveObj = new FundUsersWithSTPrimeFromReserveKlass();
FundUsersWithSTPrimeFromReserveObj.perform();