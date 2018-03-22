const rootPrefix = '..'
  , nonceManagerKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_manager')
  , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
  , FillUpMissingNonceKlass = require(rootPrefix + '/fire_brigade/fill_up_missing_nonce');
;


const FillUpMissingNonceRange = function(toAddress, chainKind) {
  const oThis = this
  ;
  oThis.toAddress = toAddress.toLowerCase();
  oThis.chainKind = chainKind;
  oThis.allPendingTasks = new Array();
  oThis.isProccessing = false;
  oThis.currentIndex = 0;
};

FillUpMissingNonceRange.prototype = {

  perform: async function() {
    const oThis = this
    ;

    const clearQueuedResponse = await nonceManagerKlass.prototype.clearAllMissingNonce(oThis.chainKind, oThis ,oThis.fillNonce);
    if (clearQueuedResponse.isFailure()) {
      logger.error("Unable to clear queued transactions: ", clearQueuedResponse);
    } else {
      logger.win("Cleared queued transactions successfully: ", clearQueuedResponse);
    }
  },
  
  fillNonce: function (address, nonce) {
    const oThis = this
      , params = {}
    ;
    params["from_address"] = address.toLowerCase();
    params["to_address"] = oThis.toAddress;
    params["chain_kind"] = oThis.chainKind;
    params["missing_nonce"] = parseInt(nonce);

    oThis.addToBatchProcess(params);
    //const fullUpNonceObject = new FillUpMissingNonceKlass(params);
    //fullUpNonceObject.perform();

    //console.log("fillNonce called: params: ",params);
  },

  addToBatchProcess: function (object) {
    const oThis = this;
    oThis.allPendingTasks.push(object);
    if (oThis.isProccessing == false) {
      oThis.isProccessing = true;
      oThis.batchProcess();
    }
    console.log("------oThis.allPendingTasks.length: ",oThis.allPendingTasks.length);
  },

  batchProcess: async function () {
    const oThis = this;
    const batchSize = 100;
    while (oThis.currentIndex < oThis.allPendingTasks.length) {
      const allPromises = new Array();
      for (var count = 0; count < batchSize && oThis.currentIndex < oThis.allPendingTasks.length ; count ++) {
        const params = oThis.allPendingTasks[oThis.currentIndex];
        const promiseObject = new Promise(async function (onResolve, onReject) {
          const fullUpNonceObject = new FillUpMissingNonceKlass(params);
          await fullUpNonceObject.perform();
          onResolve();
        });
        allPromises.push(promiseObject);
        oThis.currentIndex++;
      }

      await Promise.all(allPromises);
      console.log("=======================Batch complete======================");
    }
    oThis.isProccessing = false;
  }

};

module.exports = FillUpMissingNonceRange;


/*


Here is the code to run on console. Update toAddress and chainKind below.

var toAddress = '';
var chainKind = 'utility';

var rootPrefix = '.';
var FillUpMissingNonceRangeKlass = require(rootPrefix + '/fire_brigade/fill_up_missing_nonce_range');

var fillUpObject = new FillUpMissingNonceRangeKlass(toAddress, chainKind);
fillUpObject.perform().then(console.log);




// currupt on local
export OST_UTILITY_GETH_RPC_PROVIDERS='["http://127.0.0.1:9546"]'

  var fromAddress = '0x73bDD49Fd11729359453Ed9c4E45728418536a9C'
  var toAddress = '0xE36438f8410045F32bBAa0e2BecDCDbcfB214213';
  var chainKind = 'utility';

  var rootPrefix = '.';
  var FillUpMissingNonceRangeKlass = require(rootPrefix + '/fire_brigade/fill_up_missing_nonce_range');

  var fillUpObject = new FillUpMissingNonceRangeKlass(toAddress, chainKind);
  fillUpObject.perform().then(console.log);



var fromAddress = '0x73bDD49Fd11729359453Ed9c4E45728418536a9C';
var startNonce = 25000
for (var diff1 = 0; diff1 < 10; diff1++ ) {
  startNonce = startNonce+diff1;
  var diff = 5;
  for (var i = startNonce; i < startNonce+diff; i++ ) {
    fillUpObject.fillNonce(fromAddress, i);
  }
}




 */