//IMPORTANT : ORDER OF REQUIRES MATTERS HERE. BE VERY CAREFUL.

const rootPrefix = '..',
  CustomRequestManager = require(rootPrefix + '/module_overrides/web3_core_requestmanager'),
  CustomWeb3EthPersonal = require(rootPrefix + '/module_overrides/web3_eth_personal/index'),
  CustomWeb3Eth = require(rootPrefix + '/module_overrides/web3_eth/index');

module.exports = {
  web3_core_requestmanager: CustomRequestManager,
  web3_eth_personal: CustomWeb3EthPersonal,
  web3_eth: CustomWeb3Eth
};
