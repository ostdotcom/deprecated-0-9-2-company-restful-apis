'use strict';

const clientWorkerManagedAddressId = {
  // Status enum types Start //

  activeStatus: 'active',

  inactiveStatus: 'inactive',

  holdStatus: 'hold',

  blockingStatus: 'blocker',
  // This status also corresponds to activeStatus. It simply means that this process is blocking the start operation
  // of another queue.

  // Status enum types end //

  // Properties types Start //

  hasStPrimeBalanceProperty: 'has_st_prime_balance',

  initialGasTransferredProperty: 'initial_gas_transferred'

  // Properties types end //
};

module.exports = clientWorkerManagedAddressId;
