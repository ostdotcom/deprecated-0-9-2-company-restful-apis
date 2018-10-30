'use strict';

const cronProcesses = {
  // Cron processes enum types start
  executeTxCron: 'execute_transaction',

  onBoardingCron: 'on_boarding',

  factoryCron: 'factory',

  gethDownHandlerCron: 'geth_down',

  submittedHandlerCron: 'submitted_handler',

  queuedHandlerCron: 'queued_handler',

  // Cron processes enum types end

  // Status enum types start

  runningStatus: 'running',

  stoppedStatus: 'stopped',

  inactiveStatus: 'inactive'

  //Status enum types end
};

module.exports = cronProcesses;
