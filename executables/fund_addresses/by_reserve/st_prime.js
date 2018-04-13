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
const FundUsersWithSTPrimeFromReserveKlass = function () {
};

FundUsersWithSTPrimeFromReserveKlass.prototype = {
  /**
   * perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        process.exit(1);
      });
  },

  /**
   * asyncPerform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const batchSize = 100
    ;

    var pageNo = 1;

    while (true) {
      const offset = (pageNo - 1) * batchSize;

      const clientBrandedTokenRecords = await new ClientBrandedTokenModel()
        .select(['airdrop_contract_addr', 'client_id'])
        .limit(batchSize)
        .offset(offset)
        .fire();

      if (clientBrandedTokenRecords.length == 0) break;

      pageNo = pageNo + 1;

      for (var i = 0; i < clientBrandedTokenRecords.length; i++) {
        if (!clientBrandedTokenRecords[i].airdrop_contract_addr) continue;

        const clientId = clientBrandedTokenRecords[i].client_id;

        logger.step('* Funding ST prime for client id:', clientId);

        await new FundClientAddressKlass({client_id: clientId}).perform();

        logger.win('* DONE with ST prime funding for client id:', clientId);
      }
    }

    logger.step('* Exiting after all funding done.');
    process.exit(0);
  }
};

// perform action
new FundUsersWithSTPrimeFromReserveKlass().perform();