'use strict';

/*
*
*
* Usage :  node executables/one_timers/test_payments_mysql_connections.js
*
* This script will insert a new salt id in managed_addresses_salt.
*
*
* */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  configStrategy = require(rootPrefix + '/temp.json');

require(rootPrefix + '/lib/providers/payments');

const TestPaymentsMysqlConnections = {
  perform: async function() {
    const oThis = this;

    let promises = [];

    for (let i = 0; i < 1000; i++) {
      // await oThis.sleep(100);

      let ic = new InstanceComposer(configStrategy);
      let openStPayments = ic.getPaymentsProvider().getInstance();

      let modelObj = new openStPayments.services.models.airdrop();
      promises.push(modelObj.getByContractAddress('0x827e59Fe4Fc09A9B72c2215297F95ec129650893'));
    }

    let promiseResponses = await Promise.all(promises);

    for (let i = 0; i < promiseResponses.length; i++) {
      console.log(promiseResponses[i]);
    }

    process.exit(0);
  },

  sleep: function(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }
};

module.exports = TestPaymentsMysqlConnections;
TestPaymentsMysqlConnections.perform();
