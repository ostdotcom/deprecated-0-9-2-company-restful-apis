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

};

module.exports = notificationTopics;