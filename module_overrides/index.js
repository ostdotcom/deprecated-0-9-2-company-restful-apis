//IMPORTANT : ORDER OF REQUIRES MATTERS HERE. BE VERY CAREFUL.

const CustomWeb3EthPersonal = require('./web3-eth-personal')
  , CustomWeb3Eth = require('./web3-eth')
;

module.exports = {
  web3_eth_personal: CustomWeb3EthPersonal,
  web3_eth   : CustomWeb3Eth
};