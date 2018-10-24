'use strict';

const rootPrefix = '../..',
  OSTBase = require('@openstfoundation/openst-base'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  moUtils = require(rootPrefix + '/module_overrides/common/utils'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  SignRawTx = require(rootPrefix + '/module_overrides/common/sign_raw_tx'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  OstWeb3 = OSTBase.OstWeb3;

const ResendRawTx = function(rawTx, gethUrl) {
  const oThis = this;

  oThis.rawTx = rawTx;
  oThis.gethProvider = new OstWeb3.providers.WebsocketProvider(gethUrl);
  oThis.web3Instance = new web3InteractFactory.getInstance('utility', oThis.gethProvider).web3WsProvider;
};

ResendRawTx.prototype = {
  perform: async function() {
    const oThis = this;

    let host = moUtils.getHost(oThis.gethProvider),
      signRawTx = new SignRawTx(host, oThis.rawTx);

    let signTxRsp = await signRawTx.perform().catch(function(error) {
        logger.error('signRawTx error ::', error);
      }),
      serializedTx = signTxRsp.serializedTx;

    if (!serializedTx) {
      return Promise.resolve();
    }

    moUtils.submitTransactionToChain({
      web3Instance: oThis.web3Instance,
      signTxRsp: signTxRsp,
      onError: oThis.onError,
      onTxHash: oThis.onTxHash
    });
  },

  /**
   * On Error callback.
   *
   * @param err
   * @returns {Promise<any>}
   */
  onError: async function(err) {
    return Promise.resolve(
      responseHelper.error({
        internal_error_identifier: 'mo_c_rrt_1',
        api_error_identifier: 'internal_server_error',
        debug_options: { err },
        error_config: errorConfig
      })
    );
  },

  /**
   * On TxHash callback.
   *
   * @param txHash
   * @returns {Promise<any>}
   */
  onTxHash: async function(txHash) {
    return Promise.resolve(responseHelper.successWithData({ tx_hash: txHash }));
  }
};

module.exports = ResendRawTx;
