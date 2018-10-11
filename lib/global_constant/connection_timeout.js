'use strict';

const connectionWaitTimeout = {
  // Connection wait timeout for app server.
  appServer: 2,

  // Connection wait timeout for cron machine.
  cron: 5
};

module.exports = connectionWaitTimeout;
