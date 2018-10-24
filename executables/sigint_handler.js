'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const SigIntHandler = function() {
  const oThis = this;

  oThis.attachHandlers();
};

SigIntHandler.prototype = {
  attachHandlers: function() {
    const oThis = this;

    let handle = function() {
      const oThis = this; // Note, this is a process scope

      process.exit(1);
    };

    process.on('SIGINT', handle);
    process.on('SIGTERM', handle);
  }
};

module.exports = SigIntHandler;
