"use strict";

const notificationTopics = {

  // onboarding topics START //

  onBoardingPropose: 'on_boarding.propose',

  onBoardingDeployAirdrop: 'on_boarding.deploy_airdrop',

  onBoardingSetWorkers: 'on_boarding.set_workers',

  onBoardingSetPriceOracle: 'on_boarding.set_price_oracle',

  onBoardingSetAcceptedMargin: 'on_boarding.set_accepted_margin',

  // onboarding topics STOP //

  // airdrop allocate tokens topics START //

  airdropAllocateTokens: 'airdrop_allocate_tokens',

  // airdrop allocate tokens topics STOP //

  // stake and mint topics START //

  stakeAndMintInitTransfer: 'stake_and_mint.init_transfer',

  stakeAndMintApprove: 'stake_and_mint.approve',

  stakeAndMintForSTPrime: 'stake_and_mint.st_prime',

  stakeAndMintForBT: 'stake_and_mint.bt',

  // stake and mint topics STOP //

  // stake and mint processor topics START //

  stakeAndMintProcessorAll: 'event.stake_and_mint_processor.#',

  processStakingOnVcStart: 'event.stake_and_mint_processor.process_staking_on_vc.start',
  processStakingOnVcDone: 'event.stake_and_mint_processor.process_staking_on_vc.done',
  processMintingOnUcStart: 'event.stake_and_mint_processor.process_minting_on_uc.start',
  processMintingOnUcDone: 'event.stake_and_mint_processor.process_minting_on_uc.done',
  claimTokenOnUcStart: 'event.stake_and_mint_processor.claim_token_on_uc.start',
  claimTokenOnUcDone: 'event.stake_and_mint_processor.claim_token_on_uc.done',

  // stake and mint processor topics END //

  // airdrop approve contract
  airdrop_approve_contract: 'airdrop.approve.contract'

};

module.exports = notificationTopics;