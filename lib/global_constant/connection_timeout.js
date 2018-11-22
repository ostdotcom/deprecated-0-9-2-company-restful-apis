'use strict';

const connectionWaitTimeout = {
  // Connection wait timeout for app server.
  appServer: 5,

  //Connection wait timeout for crons.
  crons: 3600
};

module.exports = connectionWaitTimeout;
