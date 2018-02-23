"use strict";

const clientAirdrop = {

  // Status enum types Start //

  incompleteStatus: 'incomplete',

  processingStatus: 'processing',

  completeStatus: 'complete',

  failedStatus: 'failed',

  // Status enum types Start //


  // Steps Complete enum types Start //

  userIdentifiedStepComplete: 'user_identified',

  tokensTransferedStepComplete: 'tokens_transfered',

  contractApprovedStepComplete: 'contract_approved',

  allocationDoneStepComplete: 'allocation_done',

  // Steps Complete enum types Start //

  // Airdrop List Type enum types Start //

  allAddressesAirdropListType: 'all_addresses',

  neverAirdroppedAddressesAirdropListType: 'never_airdropped_addresses',

  specificAddressesAirdropListType: 'specific_addresses',


  // Airdrop List Type enum types Start //

};

module.exports = clientAirdrop;