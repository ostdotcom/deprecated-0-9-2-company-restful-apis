'use strict';

/**
 * Refill ST PRIME to client addresses.
 *
 * Reserve funds following addresses with ST Prime:
 * 1. Airdrop fund manager address
 * 2. Worker address
 *
 * NOTE - This script refills ST prime for clients present in active config group only,
 * clients from deactivated config strategy group_ids are ignored.
 *
 * Usage: node executables/fund_addresses/by_reserve/st_prime.js
 *
 * @module executables/fund_addresses/by_reserve/st_prime
 */

const rootPrefix = '../../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  ClientConfigStrategyModel = require(rootPrefix + '/app/models/client_config_strategies');

require(rootPrefix + '/app/services/address/fund_client_address');

/**
 * constructor for fund addresses with ST PRIME from Reserve address
 *
 * @constructor
 */
const FundUsersWithSTPrimeFromReserveKlass = function() {};

FundUsersWithSTPrimeFromReserveKlass.prototype = {
  /**
   * perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
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
  asyncPerform: async function() {
    const oThis = this;

    let distinctGroupIdsResponse = await new ConfigStrategyModel().getDistinctActiveGroupIds(),
      distinctGroupIdsArray = distinctGroupIdsResponse.data,
      indexOfNull = distinctGroupIdsArray.indexOf(null);

    distinctGroupIdsArray.splice(indexOfNull, 1);

    let configStrategyIds = [],
      whereClause = ['group_id IN (?)', distinctGroupIdsArray],
      strategyIdsQueryResponse = await new ConfigStrategyModel()
        .select('id')
        .where(whereClause)
        .fire();

    for (let index in strategyIdsQueryResponse) {
      configStrategyIds.push(strategyIdsQueryResponse[index].id);
    }

    let clientIds = [],
      clientIdQueryResponse = await new ClientConfigStrategyModel()
        .select(['client_id'])
        .where(['config_strategy_id IN (?)', configStrategyIds])
        .group_by('client_id')
        .fire();

    for (let index in clientIdQueryResponse) {
      clientIds.push(clientIdQueryResponse[index].client_id);
    }

    let batchSize = 25,
      batchNo = 1;

    while (true) {
      let offset = (batchNo - 1) * batchSize,
        batchedClientIds = clientIds.slice(offset, batchSize + offset);

      if (batchedClientIds.length === 0) break;

      logger.win(`starting checking for batch: ${batchNo} of clientIds: ${batchedClientIds}`);

      for (let i = 0; i < batchedClientIds.length; i++) {
        let clientId = batchedClientIds[i],
          configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
          getConfigStrategyRsp = await configStrategyHelper.get();

        if (getConfigStrategyRsp.isFailure()) {
          return Promise.reject(getConfigStrategyRsp);
        }

        const instanceComposer = new InstanceComposer(getConfigStrategyRsp.data),
          FundClientAddressKlass = instanceComposer.getFundClientAddressClass();

        console.log('* Funding ST prime for client id:', clientId);

        await new FundClientAddressKlass({ client_id: clientId, fund_workers: false }).perform();

        logger.win('* DONE with ST prime funding for client id:', clientId);
      }

      batchNo = batchNo + 1;
    }

    logger.step('* Exiting after all funding done.');
    process.exit(0);
  }
};

// perform action
new FundUsersWithSTPrimeFromReserveKlass().perform();
