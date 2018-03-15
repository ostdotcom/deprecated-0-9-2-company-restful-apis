"use strict";

const logMe = true
    , verboseLog = logMe && true
    , defaultTimeout = 30000
;

const PromiseContext = module.exports = function ( executor, options ) {
  const oThis = this;

  // Take Care of Options
  options = options || {};
  Object.assign(oThis, options);

  const wrappedExecutor = oThis.createWrappedExecutor( executor );
  oThis.createTimeout();
  oThis.promise = new Promise( oThis.wrappedExecutor );
  oThis.creationTs = Date.now();

};

PromiseContext.prototype = {
  constructor       : PromiseContext
  //  Use promise property to get promise instance.
  , promise             : null

  //  Pass timeoutInMilliSecs in options to set the timeout.
  //  If less than or equal to zero, timeout will not be observed.
  , timeoutInMilliSecs  : defaultTimeout

  //  To Auto-Resolve a promise on timeout, set resolvePromiseOnTimeout to true.
  //  It can be set using options parameter in constructor.
  , resolvePromiseOnTimeout: false

  // The value to be passed to resolve when the Promise has timedout.
  //  It can be set using options parameter in constructor.
  , resolvedValueOnTimeout: null

  , onResolved  : function ( resolvedValue, promiseContext ) {
    //  Triggered when callback is resolved.
    //  This callback method should be set by instance creator.
    //  It can be set using options parameter in constructor.
    verboseLog && console.log("Promise has been resolved with value", resolvedValue );
    verboseLog && promiseContext.logInfo();
  }
  , onRejected  : function ( rejectReason, promiseContext ) {
    //  Triggered when callback is rejected.
    //  This callback method should be set by instance creator.
    //  It can be set using options parameter in constructor.
    verboseLog && console.log("Promise has been rejected with reason", rejectReason );
    verboseLog && promiseContext.logInfo();
  }
  , onTimedout  : function ( promiseContext ) {
    //  Triggered when Promise failed to resolve/reject with-in time limit.
    //  Time-Limit can be set using 
    //  This callback method should be set by instance creator.
    //  It can be set using options parameter in constructor.
    verboseLog && console.log("Promise has timedout.");
    verboseLog && promiseContext.logInfo();
  }



  , wrappedExecutor : null
  , createWrappedExecutor: function ( executor ) {
      const oThis = this;

      //  The actual executor function that is passed on to the subscribers.
      oThis.wrappedExecutor = function (resolve, reject) {
        const wrappedResolve = oThis.createWrappedResolve( resolve );
        const wrappedReject  = oThis.createWrappedReject( reject );
        executor && executor( wrappedResolve, wrappedReject );
        oThis.executionTs = Date.now();
      };

      return oThis.wrappedExecutor;
  }


  , resolve  : null
  , createWrappedResolve: function ( resolve ) {
    const oThis = this;

    //  The actual resolve function that is passed on to the subscribers.
    oThis.resolve = function ( resolvedValue ) {
      if ( oThis.isResolved || oThis.isRejected ) { 
        console.trace("PromiseContext :: resolve invoked when promise has already been resolved/rejected."
          + "\n\t Ignoring resolve."
        );
        oThis.logInfo();
        return;
      }
      // Invoke resolve method. Don't bother about arguments, pass it on as is.
      resolve.apply(null, arguments);

      // Update the flags.
      oThis.isResolved  = true;

      // Trigger Callback if available.
      oThis.onResolved && oThis.onResolved( resolvedValue, oThis );

      // Clean Up
      oThis.cleanup();
    };

    return oThis.resolve;
  }

  , reject  : null
  , createWrappedReject: function ( reject ) {
    const oThis = this;

    // The actual reject function that is passed on to the subscribers.
    oThis.reject = function ( reason ) {
      if ( oThis.isResolved || oThis.isRejected ) { 
        console.trace("IMPORTANT :: PromiseContext :: reject invoked when promise has already been resolved/rejected."
          + "\n\t Ignoring reject"
        );
        oThis.logInfo();
        return;
      }
      // Invoke reject method. Don't bother about arguments, pass it on as is.
      reject.apply(null, arguments);

      // Update the flags.
      oThis.isRejected  = true;

      // Trigger Callback if available.
      oThis.onRejected && oThis.onRejected( reason, oThis );

      // Clean Up
      oThis.cleanup();
    };

    return oThis.reject;
  }

  , timeout: function () {
    const oThis = this;
    console.log("PromiseContext :: default timeout invoked. (No timeout set).");
  }
  , createTimeout  : function () {
    const oThis = this;

    const timeoutInMilliSecs = oThis.timeoutInMilliSecs = Number( oThis.timeoutInMilliSecs );
    oThis.timeout = function () {
      if ( oThis.isResolved || oThis.isRejected || oThis.hasTimedout ) {
        // The Promise has been taken care off.
        return;
      }

      // Trigger Callback if available. Do it first so that something can be done about it from outside.
      if ( oThis.onTimedout ) {
        oThis.onTimedout( oThis );
      }

      if ( oThis.resolvePromiseOnTimeout ) {
        logMe && console.log("PromiseContext :: a promise has timedout. Forcefully Resolving it.");
        oThis.resolve( oThis.resolvedValueOnTimeout );
      } else {
        logMe && console.log("PromiseContext :: a promise has timedout. Forcefully Rejecting it.");
        oThis.reject("Promise TimedOut");
      }


      // Update the flags.
      oThis.hasTimedout = true;



      // IMPORTANT: DO NOT CLEAN UP HERE.
      // The code using this class may want to retry.
    };

    // Set the timeout if needed.
    if ( !isNaN( timeoutInMilliSecs ) && timeoutInMilliSecs > 0 ) {
      // Observe self.
      setTimeout( oThis.timeout, timeoutInMilliSecs );
    }
  }


  
  , isResolved    : false
  , isRejected    : false
  , hasTimedout   : false
  , executionTs   : 0
  , creationTs    : 0
  , clenupTs      : 0

  , cleanup : function () {
    const oThis = this;

    oThis.wrappedExecutor = null;
    oThis.promise  = null;
    oThis.resolve  = null;
    oThis.reject   = null;
    oThis.timeout  = null;

    // Note when the clean up was done.
    oThis.clenupTs = Date.now();
  }

  , logInfo : function () {
    const oThis = this;

    console.log(" PromiseContext Info :: "
      , "isResolved:"   , oThis.isResolved
      , "isRejected:"   , oThis.isRejected
      , "hasTimedout:"  , oThis.hasTimedout
      , "creationTs:"   , oThis.creationTs
      , "executionTs:"  , oThis.executionTs
      , "clenupTs:"     , oThis.clenupTs
    );
  }
};

PromiseContext.Examples = {
  simpleResolve   : function () {
    var p1 = new PromiseContext( function (resolve, reject) {
      // Lets call resolve in 2 secs
      setTimeout(function () {
        resolve("Examples.simpleResolve :: resolving p1");
      }, 2000);
    }, { timeoutInMilliSecs : 3000 });
  }
  , simpleReject  : function () {
    var p2 = new PromiseContext( function (resolve, reject) {
      // Lets call reject in 2 secs
      setTimeout(function () {
        reject("Examples.simpleReject :: rejecting p2");
      }, 2000);
    }, { timeoutInMilliSecs : 3000 });
  }
  , simpleTimeout: function () {
    var p3 = new PromiseContext( function (resolve, reject) {
      // Lets call resolve in 6 secs
      setTimeout(function () {
        resolve("p3 resolved");
      }, 6000);
    }, { timeoutInMilliSecs : 3000 
      , onTimedout: function ( promiseContext ) {
        console.log("Examples.simpleTimeout :: p3 timedout.");
      }
    });
  }
  , resolvePromiseOnTimeout: function () {
    var p4 = new PromiseContext( function (resolve, reject) {
      // Lets call resolve in 6 secs
      setTimeout(function () {
        resolve("p4 resolved");
      }, 6000);
    }, { 
      timeoutInMilliSecs : 3000 
      , resolvePromiseOnTimeout: true
      , onTimedout: function ( promiseContext ) {
        console.log("Examples.simpleTimeout :: p4 timedout.");
      }
    });
  }
};

