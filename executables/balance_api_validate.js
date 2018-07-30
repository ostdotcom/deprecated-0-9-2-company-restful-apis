'use strict';

const rootPrefix = '..',
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  BalanceFetchKlass = require(rootPrefix + '/app/services/balances/fetch'),
  fs = require('fs');

const ValidateBalance = function() {};

ValidateBalance.prototype = {
  perform: async function() {
    let managedAddressModel = new ManagedAddressModel();

    let data = await managedAddressModel
      .select('client_id, uuid')
      .where('client_id is not null')
      .fire();

    for (let i = 0; i < data.length; i++) {
      let uuid = data[i].uuid;
      let clientId = data[i].client_id;

      let balanceFetchObj = new BalanceFetchKlass({ id: uuid, client_id: clientId });

      let balanceFetchResponse = await balanceFetchObj.perform();

      let a = balanceFetchResponse.data.token_balance, // available balance
        b = balanceFetchResponse.data.airdropped_balance,
        c = balanceFetchResponse.data.available_balance; // token balance

      if (!a.isEqualTo(b.plus(c))) {
        if (a && b && c) {
          fs.appendFileSync('results.txt', a + ' ' + b + ' ' + c + ' ' + uuid + ' ' + clientId + '\n');
        }
      }
    }
  }
};

let validateBalance = new ValidateBalance();
validateBalance.perform();
