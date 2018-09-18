let rootPrefix = '.';
require(rootPrefix + '/module_overrides/index');

let Web3 = require('web3');
let web3 = new Web3('http://127.0.0.1:8545');
let coreConstants = require(rootPrefix + '/config/core_constants');

let spender = '0x5bd4d11c827770435d98caa234cdbdc2d62e178b';
let passphrase = 'testtest';
let receiver = '0x4cce5b00fe9fabefd861dbde484a4e79b11eb153';
let amount = web3.utils.toWei('0.01');
let gasPrice = '0x12A05F200';
let gas = '30000';

coreConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP[spender.toLowerCase()] = 1;

function testBatch(batch) {
  //Unlock
  let unlockRequest = web3.eth.personal.unlockAccount.request(spender, passphrase, 60000);
  batch.add(unlockRequest, function(err, result) {
    err && console.error('Unlock Failed:\n', err);
    result && console.log('Unlock Successful:\n', result);
  });

  //Send
  let sendTxRequest = web3.eth.sendTransaction.request({
    from: spender,
    to: receiver,
    value: amount,
    gasPrice: gasPrice,
    gas: gas
  });

  batch.add(sendTxRequest, function(err, result) {
    err && console.error('sendTransaction Failed:\n', err);
    result && console.log('sendTransaction Successful:\n', result);
  });

  batch.execute();
}

function testMe() {
  let batch1 = new web3.BatchRequest();
  testBatch(batch1);

  let batch2 = new web3.eth.BatchRequest();
  testBatch(batch2);
}

testMe();

// web3.eth.personal.unlockAccount(spender, passphrase, 60000, function (err, result ) {
//   err && console.error("Unlock Failed:\n", err);
//   result && console.log("Unlock Successful:\n", result);
//   if ( err ) return;

//   testMe();
// });
