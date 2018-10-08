'use strict';

const commandMessage = {
  // Kind enum types starts

  // Mark to "Original" status.
  markBlockingToOriginalStatus: 1,

  // Check if any of the sibling worker is on status "Blocking", then mark on hold.
  goOnHold: 2,

  // Check if all the other worker process of the client is in normal status then got to normal status.
  goToOriginal: 3

  // Kind enum types ends
};

module.exports = commandMessage;
