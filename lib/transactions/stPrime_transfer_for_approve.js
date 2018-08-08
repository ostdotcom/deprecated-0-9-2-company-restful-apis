'use strict';

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_multi_management/managedAddresses');

const TransferSTPrimeForApproveKlass = function(params) {
  const oThis = this;

  oThis.senderUuid = params.sender_uuid;
  oThis.receiverUuid = params.receiver_uuid;
  oThis.brandedTokenContractAddress = params.token_erc20_address;
  oThis.methodArgs = params.method_args;
};

TransferSTPrimeForApproveKlass.prototype = {
  perform: async function() {
    const oThis = this,
      ManagedAddressCacheKlass = oThis.ic().getManagedAddressCache();

    if (!oThis.brandedTokenContractAddress) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_t_spt_1',
          api_error_identifier: 'branded_token_contract_not_found',
          error_config: errorConfig
        })
      );
    }

    var addressCachedObj = new ManagedAddressCacheKlass({ uuids: [oThis.receiverUuid, oThis.senderUuid] }),
      addressResponse = await addressCachedObj.fetch();

    if (addressResponse.isFailure()) {
      addressResponse['data'] = Object.assign(
        { error: 'Failed while transferring st prime.' },
        addressResponse.toHash().err
      );
      return Promise.resolve(addressResponse);
    }

    var receiverAddress = addressResponse.data[oThis.receiverUuid];
    var estimateGasInput = {
      contract_name: 'brandedToken',
      contract_address: oThis.brandedTokenContractAddress,
      chain: 'utility',
      sender_address: receiverAddress.ethereum_address,
      method_name: 'approve',
      method_arguments: [receiverAddress.ethereum_address, oThis.methodArgs['amount']]
    };

    const platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    const estimateGasObj = new openSTPlaform.services.transaction.estimateGas(estimateGasInput);

    const estimateGasResponse = await estimateGasObj.perform();
    if (!estimateGasResponse || estimateGasResponse.isFailure()) {
      estimateGasResponse.data = Object.assign(
        { input_params: estimateGasInput, error: 'Failed while transferring st prime.' },
        estimateGasResponse.toHash().err
      );
      return Promise.resolve(estimateGasResponse);
    }

    const configStrategy = oThis.ic().configStrategy;

    const estimatedGasWei = basicHelper
      .convertToBigNumber(estimateGasResponse.data.gas_to_use)
      .plus(5000)
      .mul(basicHelper.convertToBigNumber(configStrategy.OST_UTILITY_GAS_PRICE));

    var senderAddress = addressResponse.data[oThis.senderUuid];
    const transferSTPrimeInput = {
      sender_address: senderAddress.ethereum_address,
      sender_passphrase: senderAddress.passphrase_d,
      recipient_address: receiverAddress.ethereum_address,
      amount_in_wei: estimatedGasWei.toString(10),
      options: { returnType: 'txReceipt', tag: '' }
    };

    var transferResponse = {},
      transferTransactionHash = null;

    const transferSTPrimeBalanceObj = new openSTPlaform.services.transaction.transfer.simpleTokenPrime(
      transferSTPrimeInput
    );
    delete transferSTPrimeInput.sender_passphrase;

    transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      transferResponse['data'] = Object.assign({
        input_params: transferSTPrimeInput,
        error: 'Failed while Transfering ST Prime. ' + transferResponse.toHash().err
      });
      return Promise.resolve(transferResponse);
    }

    var maxBalanceFetch = 20,
      fetchedBalance = basicHelper.convertToBigNumber(0);

    while (maxBalanceFetch--) {
      const stPrimeBalanceObj = new openSTPlaform.services.balance.simpleTokenPrime({
        address: receiverAddress.ethereum_address
      });

      const simpleTokenPrimeBalanceResponse = await stPrimeBalanceObj.perform();

      if (simpleTokenPrimeBalanceResponse.isFailure()) {
        logger.error('error while fetching ST Prime balance for address:', receiverAddress.ethereum_address);
        continue;
      }

      fetchedBalance = basicHelper.convertToBigNumber(simpleTokenPrimeBalanceResponse.data.balance);

      if (fetchedBalance.gte(estimatedGasWei)) {
        break;
      } else {
        logger.debug(
          'ST PRIME BALANCE:: less than the approve estimate gas for address:',
          receiverAddress.ethereum_address
        );
      }
    }

    if (fetchedBalance.lt(estimatedGasWei)) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_t_spt_2',
          api_error_identifier: 'st_prime_transfer_failed',
          error_config: errorConfig
        })
      );
    }

    transferTransactionHash = transferResponse.data.transaction_hash;

    logger.debug('refill gas tx hash::', transferTransactionHash);

    return Promise.resolve(
      responseHelper.successWithData({ input_params: transferSTPrimeInput, transaction_hash: transferTransactionHash })
    );
  }
};

InstanceComposer.registerShadowableClass(TransferSTPrimeForApproveKlass, 'getTransferSTPrimeForApproveClass');

module.exports = TransferSTPrimeForApproveKlass;
