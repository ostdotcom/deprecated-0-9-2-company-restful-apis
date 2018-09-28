//IMPORTANT: Unlike other Packages, this package cache does not need to be manipulated.
const basePackage = 'web3-core-requestmanager';

const BasePackage = require(basePackage);

const rootPrefix = '../..';

const Web3BatchManager = BasePackage.BatchManager;

// Please declare your require variable here.
let logger, moUtils, SignRawTx;

// NOTE :: Please define all your requires inside the function
function initRequires() {
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  moUtils = moUtils || require(rootPrefix + '/module_overrides/common/utils');
  SignRawTx = SignRawTx || require(rootPrefix + '/module_overrides/common/sign_raw_tx');
}

// Derived Class Definition/Implementation
const OstBatchManager = function() {
  let oThis = this;

  initRequires();

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = Web3BatchManager.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;
  //Do Stuff Here.

  return oThis;
};

let proto = {
  signRequest: async function(request) {
    const oBatch = this;
    request.tryCnt = request.tryCnt || 0; //Dont ever change this to 1.

    let rawTx = request.params[0];

    // hardcoded for now
    let provider = oBatch.getProvider(),
      host = moUtils.getHost(provider);
    request.signRawTx = request.signRawTx || new SignRawTx(host, rawTx);

    let serializedTx, err;

    request.tryCnt++;
    await request.signRawTx
      .perform()
      .then(function(result) {
        serializedTx = result;
        oBatch.sendSignedRequest(request, serializedTx);
      })
      .catch(function(reason) {
        logger.error('signRawTx error ::', reason);
        err = reason;
        request.callback && request.callback(err);
      });
  },

  //@Rachin/Kedar: Consider moving this logic to another class because batch should not create more instances of batch.
  sendSignedRequest: function(request, serializedTx) {
    const oBatch = this;
    let callback = request.callback;
    let newRequestObject = {
      method: 'eth_sendRawTransaction',
      params: ['0x' + serializedTx.toString('hex')]
    };

    let newBatch = new OstBatchManager(oBatch.requestManager);
    newBatch.add(newRequestObject, function(err, result) {
      if (result) {
        logger.info('calling request.signRawTx.markAsSuccess');
        request.signRawTx.markAsSuccess().catch(() => {
          logger.warn('signRawTx.markAsSuccess threw an error. Redis seems to be donw.');
          //Do Nothing. Callback has been triggered.
        });

        callback && callback(null, result);
        return;
      }

      //We have failed. Is it nonce too low ?
      if (!moUtils.isNonceTooLowError(err) || request.tryCnt >= moUtils.maxRetryCount) {
        logger.info('calling request.signRawTx.markAsFailure');
        request.signRawTx.markAsFailure().catch(() => {
          //Do Nothing. Callback has been triggered.
          logger.warn('signRawTx.markAsFailure threw an error. Redis seems to be donw.');
        });
        callback && callback(err, null);
        return;
      }

      //Nonce is too low and we can re-try.
      logger.info('calling request.signRawTx.markAsFailure(true)');
      request.signRawTx
        .markAsFailure(true)
        .then(() => {
          return oBatch.signRequest(request);
        })
        .catch(() => {
          logger.warn('signRawTx.markAsFailure( true ) threw an error. Redis OR Geth seems to be donw.');
          return callback(err, null);
        });
    });
    newBatch.execute();
  },

  getProvider: function() {
    const oBatch = this;
    return oBatch.requestManager.provider;
  },

  _unlockRequests: null,
  addUnlockRequest: function(request) {
    const oBatch = this;
    oBatch._unlockRequests = oBatch._unlockRequests || [];
    oBatch._unlockRequests.push(request);
  },

  triggerUnlockCallbacks: function() {
    const oBatch = this;
    if (!oBatch._unlockRequests || oBatch._unlockRequests.length) {
      return;
    }

    let cnt = 0,
      len = oBatch._unlockRequests.length;
    for (cnt = 0; cnt < len; cnt++) {
      let request = oBatch._unlockRequests[cnt];
      request.callback && request.callback(true);
    }
  },

  executeCompleted: function() {
    const oBatch = this;
    oBatch.triggerUnlockCallbacks();
  }
};

OstBatchManager.prototype = Object.create(Web3BatchManager.prototype);
OstBatchManager.prototype = Object.assign(OstBatchManager.prototype, proto);

//Override add method.
let orgAdd = Web3BatchManager.prototype.add;
OstBatchManager.prototype.add = function(request, cb) {
  const oBatch = this;
  if (!request.callback) {
    request.callback = cb;
  }

  switch (request.method) {
    case 'eth_sendTransaction':
      if (!moUtils.isUnlockable(request.params[0].from)) {
        return oBatch.signRequest(request);
      }
      break;
    case 'personal_unlockAccount':
      if (!moUtils.isUnlockable(request.params[0])) {
        return oBatch.addUnlockRequest(request);
      }
      break;
  }

  //This request can be added.
  orgAdd.apply(oBatch, arguments);
};
let orgExecute = Web3BatchManager.prototype.execute;
OstBatchManager.prototype.execute = function() {
  const oBatch = this;

  //1. Execute super method.
  orgExecute.apply(oBatch, arguments);

  //2. add a dummy request object (use super 'add' method);
  let batchCompleteCallback = function() {
    oBatch.executeCompleted();
  };
  orgAdd.call(oBatch, {}, batchCompleteCallback);
};

OstBatchManager.isOSTVersion = true;

//IMPORTANT: Unlike other Packages, this package cache does not need to be manipulated.
BasePackage.BatchManager = OstBatchManager;

module.exports = BasePackage;
