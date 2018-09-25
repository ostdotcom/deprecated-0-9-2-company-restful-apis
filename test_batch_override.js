let rootPrefix = '.';
require(rootPrefix + '/module_overrides/index');

let Web3 = require('web3');
let web3 = new Web3('http://127.0.0.1:8545');
let coreConstants = require(rootPrefix + '/config/core_constants');

let passphrase = 'testtest';
let receiver = '0x4cce5b00fe9fabefd861dbde484a4e79b11eb153';
let amount = web3.utils.toWei('0.01');
let gasPrice = '0x12A05F200';
let gas = '30000';

let gethSpender = '0x419db5f6edf60a07778a6ffec811b2e851d0a788';
let remoteSpender = '0x4970b24f3fd61732CD98cC991b9bD545Ee716071';

coreConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP[gethSpender.toLowerCase()] = 1;

function testBatch(batch, spender) {
  //Unlock
  let senderUnlockRequest = web3.eth.personal.unlockAccount.request(spender, passphrase, 60000);
  batch.add(senderUnlockRequest, function(err, result) {
    err && console.error('!! Unlock Failed (spender):\n', err);
    result && console.log('Unlock Successful (spender):\n', result);
  });

  //Unlock - Non-White listed.
  let receiverUnlockRequest = web3.eth.personal.unlockAccount.request(receiver, passphrase, 60000);
  batch.add(receiverUnlockRequest, function(err, result) {
    err && console.error('!! Unlock Failed (receiver):\n', err);
    result && console.log('Unlock Successful (receiver):\n', result);
  });

  //Send
  let sendTxParams = {
    from: spender,
    to: receiver,
    value: amount,
    gasPrice: gasPrice,
    gas: gas
  };
  let sendTxRequest = web3.eth.sendTransaction.request(sendTxParams);

  let len = 6;
  while (len--) {
    batch.add(sendTxRequest, function(err, result) {
      err && console.error('!! sendTransaction Failed:\n', err);
      result && console.log('sendTransaction Successful:\n', result);
    });
  }

  batch.execute();
}

function testSingle(spender) {
  //Send
  let sendTxParams = {
    from: spender,
    to: receiver,
    value: amount,
    gasPrice: gasPrice,
    gas: gas
  };

  //Test web3.eth.personal.unlockAccount
  web3.eth.personal
    .unlockAccount(spender, passphrase, 60000, function(err, result) {
      err && console.error('!! Unlock Failed (spender)(using web3.eth.personal.unlockAccount):\n', err);
      result && console.log('Unlock Successful (spender)(using web3.eth.personal.unlockAccount):\n', result);
    })
    .then(function() {
      //Test web3.eth.sendTransaction
      return web3.eth.sendTransaction(sendTxParams, function(err, result) {
        err &&
          console.error('!! sendTransaction Failed (using web3.eth.sendTransaction. spender:', spender, '):\n', err);
        result &&
          console.log('sendTransaction Successful (using web3.eth.sendTransaction) spender:', spender, '):\n', result);
      });
    });
}

function testMe() {
  let batch1 = new web3.BatchRequest();
  testBatch(batch1, gethSpender);

  // let batch2 = new web3.eth.BatchRequest();
  // testBatch(batch2, remoteSpender);
  //
  // testSingle(gethSpender);
  // testSingle(remoteSpender);
}

testMe();

// web3.eth.personal.unlockAccount(spender, passphrase, 60000, function (err, result ) {
//   err && console.error("Unlock Failed:\n", err);
//   result && console.log("Unlock Successful:\n", result);
//   if ( err ) return;

//   testMe();
// });
