"use strict";

const logMe = true
    , verboseLog = logMe && true
    , defaultTimeout = 30000
;

const rootPrefix  = "../../executables/rmq_subscribers/"
    , PromiseContext = require(rootPrefix + "PromiseContext")
;

const Manager = module.exports = function ( promiseExecutor, options ) {
  const oThis = this;

  //Take Care of Options
  options = options || {};
  Object.assign(oThis, options);

  oThis.promiseExecutor = promiseExecutor || oThis.promiseExecutor;
  oThis.pendingPromises = oThis.pendingPromises || [];
  oThis.completedPromises = oThis.completedPromises || [];

  if ( !oThis.name ) {
    oThis.name = "PromiseQueueManager_" + Date.now();
  }
};


Manager.prototype = {
  constructor: Manager

  // Specify the name for easy identification in logs.
  , name: ""
  
  //Executor method to be passed on to Promise Constructor
  , promiseExecutor: null

  // resolvePromiseOnTimeout :: set this flag to false if you need custom handling.
  // By Default, the manager will resolve the Promise on time out.
  , resolvePromiseOnTimeout: true
  // The value to be passed to resolve when the Promise has timedout.
  , resolvedValueOnTimeout: null

  //  Pass timeoutInMilliSecs in options to set the timeout.
  //  If less than or equal to zero, timeout will not be observed.
  , timeoutInMilliSecs: defaultTimeout


  , onPromiseResolved: function ( resolvedValue, promiseContext ) {
    //onPromiseResolved will be executed when the any promise is resolved.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && console.log(oThis.name, " :: a promise has been resolved. resolvedValue:", resolvedValue);
  }

  , onPromiseRejected: function ( rejectReason, promiseContext ) {
    //onPromiseRejected will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && console.log(oThis.name, " :: a promise has been rejected. rejectReason: ", rejectReason);
  }

  , onPromiseTimedout: function ( promiseContext ) {
    //onPromiseTimedout will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && console.log(oThis.name, ":: a promise has timed out.");
  }

  , onPromiseCompleted: function ( promiseContext ) {
    //onPromiseCompleted will be executed when the any promise is removed from pendingPromise queue.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && console.log(oThis.name, ":: a promise has been completed.");
  }  

  //onAllPromisesCompleted will be executed when the last promise in pendingPromise is resolved/rejected.
  //This callback method should be set by instance creator.
  //It can be set using options parameter in constructor.
  //Ideally, you should set this inside SIGINT/SIGTERM handlers.
  
  , onAllPromisesCompleted: null

  , createPromise: function ( executorParams ) {
    //Call this method to create a new promise.

    const oThis = this;


    const executor        = oThis.promiseExecutor
        , pcOptions       = oThis.getPromiseContextOptions()
        , newPC           = new PromiseContext( executor, pcOptions, executorParams )
    ;


    oThis.createdCount ++;
    oThis.pendingPromises.push( newPC );

    return newPC.promise;
  }

  , getPendingCount: function () {
    const oThis = this;

    return oThis.pendingPromises.length;
  }

  , getCompletedCount: function () {
    const oThis = this;

    return oThis.completedCount;
  }


  // Arrays/Queues to hold Promise Context.
  , pendingPromises: null
  , completedPromises: null

  // Some Stats.
  , createdCount    : 0
  , resolvedCount   : 0
  , rejectedCount   : 0
  , timedOutCount   : 0
  , completedCount  : 0

  , pcOptions       : null
  , getPromiseContextOptions: function () {
    const oThis = this;

    oThis.pcOptions = oThis.pcOptions || {
      resolvePromiseOnTimeout   : oThis.resolvePromiseOnTimeout
      , resolvedValueOnTimeout  : oThis.resolvedValueOnTimeout
      , timeoutInMilliSecs      : oThis.timeoutInMilliSecs
      , onResolved  : function () {
        oThis._onResolved.apply(oThis, arguments);
      }
      , onRejected  : function () {
        oThis._onRejected.apply(oThis, arguments);
      }
      , onTimedout  : function () {
        oThis._onTimedout.apply(oThis, arguments);
      }
    };

    return oThis.pcOptions;
  }

  , _onResolved: function ( resolvedValue, promiseContext ) {
    const oThis = this;

    //Give a callback.
    //Dev-Note: Can this be inside settimeout ?
    if ( oThis.onPromiseResolved ) {
      oThis.onPromiseResolved.apply(oThis, arguments);
    }

    //Update the stats.
    oThis.resolvedCount ++;

    //Mark is Completed.
    oThis.markAsCompleted( promiseContext );
  }
  , _onRejected: function ( rejectReason, promiseContext ) {
    const oThis = this;

    //Give a callback.
    //Dev-Note: Can this be inside settimeout ?
    if ( oThis.onPromiseRejected ) {
      oThis.onPromiseRejected.apply(oThis, arguments);
    }

    //Update the stats.
    oThis.rejectedCount ++;

    //Mark is Completed.
    oThis.markAsCompleted( promiseContext );
  }
  , _onTimedout: function ( promiseContext ) {
    const oThis = this;

    //Update the stats.
    oThis.timedOutCount ++;

    //Give a callback.
    //Dev-Note: This callback should not be triggered inside setTimeout.
    //Give the instance creator a chance to do something with promiseContext.
    if ( oThis.onPromiseTimedout ) {
      oThis.onPromiseTimedout.apply(oThis, arguments);
    }    

  }
  , markAsCompleted: function ( promiseContext ) {
    const oThis = this;

    const pendingPromises   = oThis.pendingPromises
        , completedPromises = oThis.completedPromises
        , pcIndx = pendingPromises.indexOf( promiseContext )
    ;
    if ( pcIndx < 0 ) {
      console.trace(oThis.name + " :: markAsCompleted :: Could not find a promiseContext");
      console.dir( promiseContext );
      return;
    }

    //Remove it from queue.
    pendingPromises.splice(pcIndx, 1);
    oThis.completedCount ++;

    if ( oThis.onPromiseCompleted ) {
      oThis.onPromiseCompleted.apply(oThis, arguments);
    }

    if ( !pendingPromises.length && oThis.onAllPromisesCompleted ) {
      oThis.onAllPromisesCompleted();
    }
  }
  , isValid: function () {
    const oThis = this;

    const pendingCount    = oThis.getPendingCount()
        , createdCount    = oThis.createdCount
        , completedCount  = oThis.completedCount
        , resolvedCount   = oThis.resolvedCount
        , rejectedCount   = oThis.rejectedCount
    ;

    var isValid = ( completedCount === ( resolvedCount + rejectedCount ) );
    isValid = isValid && ( createdCount === ( pendingCount + completedCount ) );
    
    if ( isValid ) {
      logMe && console.log(oThis.name, ":: isValid :: Queue is valid.");
    } else {
      console.error("IMPORTANT ::", oThis.name , ":: validation failed!");
    }

    return isValid;
  }
  , logInfo: function () {
    const oThis = this;

    const pendingCount    = oThis.getPendingCount()
        , createdCount    = oThis.createdCount
        , completedCount  = oThis.completedCount
        , resolvedCount   = oThis.resolvedCount
        , rejectedCount   = oThis.rejectedCount
        , isValid         = oThis.isValid()
    ;

    console.log(oThis.name, ":: logInfo ::"
      , "createdCount:", createdCount
      , "pendingCount:", pendingCount
      , "completedCount:", completedCount
      , "resolvedCount:", resolvedCount
      , "rejectedCount:", rejectedCount
      , "isValid:", isValid
    );

  }

}

Manager.Examples = {
  allResolve : function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        resolve( len-- );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        console.log("Examples.allResolve :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise();
    }
  },

  allReject: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        reject( len-- );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        console.log("Examples.allReject :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise().catch( function ( reason ) {
        console.log("Examples.allReject :: promise catch triggered.");
      });
    }
  },

  allTimeout: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        reject( len-- );
      }, 10000);
    }
    , {
      onAllPromisesCompleted: function () {
        console.log("Examples.allResolve :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise().catch();
    }
  },

  executorWithParams: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject, params ) {
      //promiseExecutor
      setTimeout(function () {
        resolve( params );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        console.log("Examples.executorWithParams :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( cnt );
    }
  }
}