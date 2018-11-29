'use strict';

const connectionWaitTimeout = {
  // Connection wait timeout for app server.
  appServer: 30,

  //Connection wait timeout for crons.
  crons: 3600,

  switchConnectionCrons: 5,

  switchConnectionAppServer: 5
};

module.exports = connectionWaitTimeout;
