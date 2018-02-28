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

// Load Packages
const rootPrefix = '../../..'
  , fundClientAddressKlass = require(rootPrefix + '/app/services/address/fund_client_address')
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
      , batchSize = 10;

    // fetch all client ids
    const clientIds = [];

    const numerOfClients = clientIds.length;

    var currStart = 0;
    while(currStart < numerOfClients) {
      const batchedClientIds = clientIds.slice(currStart, currStart + batchSize);
      currStart = currStart + batchSize;

      const promiseArray = [];

      for(var i = 0; i < batchedClientIds.length; i++) {
        const fundClientAddressObj = new fundClientAddressKlass({client_id: batchedClientIds[i]});
        promiseArray.push(fundClientAddressObj.perform());
      }

      await Promise.all(promiseArray);
    }

    process.exit(0);
  }

};

// perform action
const FundUsersWithSTPrimeFromReserveObj = new FundUsersWithSTPrimeFromReserveKlass();
FundUsersWithSTPrimeFromReserveObj.perform();