'use strict';

const managedAddresses = {
  // Status enum types Start //

  activeStatus: 'active',

  inactiveStatus: 'inactive',

  // Status enum types Start //

  // Address types enum types Start //

  userAddressType: 'user',

  reserveAddressType: 'reserve',

  workerAddressType: 'worker',

  airdropHolderAddressType: 'airdrop_holder',

  internalChainIndenpendentAddressType: 'internal_chain_independent',

  // Address types enum types End //

  // Properties BitWise Keys Start //
  airdropGrantProperty: 'airdrop_granted',

  bTContractApproved: 'contract_approved'
};

module.exports = managedAddresses;
