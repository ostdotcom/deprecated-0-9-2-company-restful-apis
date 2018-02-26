"use strict";

/**
 * Refill ST' to required service addresses
 *
 * @module executables/fund_addresses/st_prime
 */

// List of addresses refilled ST' by utility chain owner:
// * Staker
// * Redeemer
// * Utility Registrar
// * Utility Ops
// * Utility Deployer

// If utility chain owner's ST' goes down to a certain number, it will stake and mint ST'.
// And if it's ST balance goes down to a certain number, email will be sent.

// Similarly, ST' will be refilled by Reserve Address:
// * Airdrop fund manager address
// * Worker address

// If Reserve Address's ST' goes down to a certain number, message will be shown on dashboard.
// Email to be sent to stake and mint ST'?